#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadDocKitEnv } from "../lib/env.js";

loadDocKitEnv();
import {
  listFeatures,
  findFeatures,
  renderFeatureBundle,
  readDoc,
  readFeatureMeta,
} from "../lib/features.js";
import { featureFiles, sharedDir } from "../lib/paths.js";
import { pushApi } from "../lib/push-api.js";
import { logChange } from "../lib/log-change.js";
import { planForTicket, renderTicketPlan } from "../lib/plan.js";
import { pendingChanges, ackPull } from "../lib/consumer.js";
import { addRaw } from "../lib/add-raw.js";
import { addFigmaLinks } from "../lib/figma.js";
import path from "node:path";
import fs from "node:fs";

const server = new McpServer({ name: "document-kit", version: "0.1.0" });

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}
function fail(msg: string) {
  return { isError: true, content: [{ type: "text" as const, text: `Lỗi: ${msg}` }] };
}

// ── READ PATH ─────────────────────────────────────────────

server.tool(
  "list_features",
  "Liệt kê các feature trong kit (id, title, status, api version). Lọc theo status nếu cần.",
  { status: z.enum(["draft", "in-design", "in-dev", "ready", "done"]).optional() },
  async ({ status }) => {
    const items = listFeatures(status).map((m) => {
      const last = (m.changes ?? [])[m.changes!.length - 1];
      return {
        id: m.id,
        title: m.title,
        status: m.status,
        version: m.version,
        apiVersion: m.api?.version ?? 0,
        lastChange: last ? { rev: last.rev, type: last.type, impact: last.impact } : null,
        platforms: m.platforms ?? [],
      };
    });
    return text(JSON.stringify(items, null, 2));
  },
);

server.tool(
  "get_feature",
  "Lấy TRỌN GÓI context của 1 feature: metadata + business-spec + design-spec + api-spec + fe-tasks + changelog. FE dùng tool này để bắt đầu task.",
  { id: z.string().describe("feature id, vd F-001-user-onboarding") },
  async ({ id }) => {
    try {
      return text(renderFeatureBundle(id));
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.tool(
  "find_feature",
  "Tìm feature theo ticket id (Linear/Jira/Redmine…), từ khoá (title/summary), hoặc status. Dùng khi planning để map ticket/branch → feature id rồi gọi get_feature.",
  {
    ticket: z.string().optional().describe("ticket id, vd ENG-123"),
    query: z.string().optional().describe("từ khoá trong title/summary"),
    status: z.enum(["draft", "in-design", "in-dev", "ready", "done"]).optional(),
  },
  async ({ ticket, query, status }) => {
    const items = findFeatures({ ticket, query, status }).map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      apiVersion: m.api?.version ?? 0,
      tickets: m.tickets ?? [],
    }));
    return text(items.length ? JSON.stringify(items, null, 2) : "Không tìm thấy feature khớp.");
  },
);

const docTool = (name: string, key: "business" | "design" | "apiSpec", label: string) =>
  server.tool(
    name,
    `Lấy riêng ${label} của 1 feature.`,
    { id: z.string() },
    async ({ id }) => {
      try {
        const f = featureFiles(id);
        const file = key === "business" ? f.business : key === "design" ? f.design : f.apiSpec;
        const doc = readDoc(file);
        return doc === null ? fail(`${label} chưa có cho ${id}`) : text(doc);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

docTool("get_business_spec", "business", "business spec");
docTool("get_design_spec", "design", "design spec");
docTool("get_api_spec", "apiSpec", "api spec");

server.tool(
  "get_shared_doc",
  "Lấy tài liệu dùng chung: glossary | data-models | conventions.",
  { name: z.enum(["glossary", "data-models", "conventions"]) },
  async ({ name }) => {
    const doc = readDoc(path.join(sharedDir(), `${name}.md`));
    return doc === null ? fail(`Không có shared/${name}.md`) : text(doc);
  },
);

server.tool(
  "search_docs",
  "Tìm keyword trong toàn bộ doc của các feature (business/design/api/tasks). Trả về dòng khớp + feature.",
  { query: z.string().describe("từ khoá cần tìm (không phân biệt hoa thường)") },
  async ({ query }) => {
    const q = query.toLowerCase();
    const hits: string[] = [];
    for (const meta of listFeatures()) {
      const f = featureFiles(meta.id);
      for (const [label, file] of [
        ["business", f.business],
        ["design", f.design],
        ["api", f.apiSpec],
        ["tasks", f.feTasks],
      ] as const) {
        const doc = readDoc(file);
        if (!doc) continue;
        doc.split("\n").forEach((line, i) => {
          if (line.toLowerCase().includes(q)) {
            hits.push(`${meta.id} · ${label}:${i + 1} · ${line.trim().slice(0, 160)}`);
          }
        });
      }
    }
    return text(hits.length ? hits.join("\n") : `Không tìm thấy "${query}".`);
  },
);

server.tool(
  "pending_changes",
  "Liệt kê feature có thay đổi (rev) mới hơn bản role này đã pull VÀ ảnh hưởng tới role. " +
    "FE/BE gọi trước khi bắt đầu task để biết có delta cần xử lý không. role: fe|be (mặc định env DOC_KIT_ROLE hoặc fe).",
  { role: z.enum(["fe", "be"]).optional().describe("vai consumer; mặc định DOC_KIT_ROLE hoặc fe") },
  async ({ role }) => {
    const items = pendingChanges(role);
    if (items.length === 0) return text("Không có thay đổi mới cần pull cho role này.");
    return text(JSON.stringify(items, null, 2));
  },
);

server.tool(
  "ack_api_pull",
  "Xác nhận role này (fe|be) đã pull feature tới revision hiện tại (clear pending của role).",
  {
    id: z.string(),
    role: z.enum(["fe", "be"]).optional().describe("vai consumer; mặc định DOC_KIT_ROLE hoặc fe"),
  },
  async ({ id, role }) => {
    try {
      const res = ackPull(id, role);
      return text(`✅ Đã ack ${res.id} (role ${res.role}) tới rev ${res.rev}.`);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.tool(
  "plan_for_ticket",
  "Tra theo TICKET → trả gói plan đã scope cho 1 role: tìm feature chứa ticket, lọc đúng các thay đổi (delta) " +
    "của ticket trong changes[], kèm spec liên quan (business/api/design theo role) để dựng plan. " +
    "Dùng cho cả task bảo trì (có change khớp) lẫn feature mới (ticket type=feature → trả full context). role: fe|be.",
  {
    ticket: z.string().describe("ticket id, vd ENG-123"),
    role: z.enum(["fe", "be"]).optional().describe("vai consumer; mặc định DOC_KIT_ROLE hoặc fe"),
  },
  async ({ ticket, role }) => {
    const plans = planForTicket(ticket, role);
    return text(renderTicketPlan(plans));
  },
);

// ── WRITE PATH ──────────────────────────────────────────

server.tool(
  "push_api_doc",
  "BE đẩy OpenAPI (3.x) lên 1 feature. Bạn (AI) quyết định API nào thuộc feature qua paths/tags; " +
    "kit cắt deterministic + kéo theo $ref. Bỏ trống paths&tags = lấy nguyên spec. " +
    "Validate, ghi openapi.yaml, sinh api-spec.md, bump api.version + feature.version, ghi change[] (type=api) + changelog. " +
    "impact: vai cần pull lại (mặc định [fe]).",
  {
    id: z.string().describe("feature id"),
    openapi: z.string().describe("nội dung OpenAPI dạng YAML hoặc JSON (có thể là spec cả service)"),
    paths: z
      .array(z.string())
      .optional()
      .describe('glob path thuộc feature, vd ["/onboarding/**"]. * = trong 1 segment, ** = nhiều segment.'),
    tags: z.array(z.string()).optional().describe('tag OpenAPI thuộc feature, vd ["onboarding"].'),
    note: z.string().optional().describe("ghi chú thay đổi cho changelog"),
    impact: z.array(z.enum(["fe", "be"])).optional().describe("vai cần pull lại; mặc định [fe]"),
    ticket: z.string().optional().describe("ticket gây ra thay đổi API (gắn vào change để plan_for_ticket tìm được)"),
  },
  async ({ id, openapi, paths, tags, note, impact, ticket }) => {
    try {
      const res = pushApi(id, openapi, { note, paths, tags, impact, ticket });
      return text(
        `✅ Đã đẩy API cho ${res.featureId}: api v${res.apiVersion}, ${res.endpoints} endpoint.\n` +
          `Sinh api-spec.md, ghi change[]. Role bị impact nên pending_changes(role).`,
      );
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.tool(
  "log_change",
  "Ghi nhận 1 thay đổi BẢO TRÌ (bug fix / cải tiến / chore) lên feature ĐÃ TỒN TẠI — không phải feature mới. " +
    "Dùng sau khi đã sửa nghiệp vụ/design trực tiếp trong 01/02 (giữ template). Bump feature.version, ghi change[] có cấu trúc " +
    "(rev + impact) + CHANGELOG, gắn ticket vào tickets[], GIỮ NGUYÊN status. " +
    "impact = vai cần hành động ([fe], [be], hoặc [fe,be]) — BE cũng có thể cần sửa. docs = mục spec bị đụng (giúp scope plan). " +
    "Nếu thay đổi đụng API → dùng push_api_doc thay vì tool này.",
  {
    id: z.string().describe("feature id"),
    type: z.enum(["bugfix", "improvement", "chore"]).describe("loại thay đổi bảo trì"),
    note: z.string().describe("mô tả ngắn thay đổi (vào change[] + CHANGELOG)"),
    ticket: z.string().optional().describe("ticket id bảo trì, vd ENG-123"),
    impact: z.array(z.enum(["fe", "be"])).optional().describe("vai cần hành động; mặc định [fe,be]"),
    docs: z.array(z.string()).optional().describe('mục spec bị đụng, vd ["01-business-spec.md#br-3"]'),
  },
  async ({ id, type, note, ticket, impact, docs }) => {
    try {
      const res = logChange(id, { type, note, ticket: ticket ? { id: ticket } : undefined, impact, docs });
      return text(
        `✅ Đã ghi nhận [${res.type}] cho ${res.featureId}: rev v${res.version}, impact ${res.impact.join("+")}.\n` +
          `Ghi change[] + CHANGELOG. Status giữ nguyên. Role bị impact nên pending_changes(role).`,
      );
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.tool(
  "add_figma_link",
  "(BA) Thêm 1 Figma link vào feature.yaml.figma[] (dedupe, tự parse node-id từ URL). Link full-flow hoặc frame theo từng usecase/AC.",
  {
    id: z.string(),
    url: z.string().describe("URL Figma (có thể kèm ?node-id=...)"),
    name: z.string().optional().describe("tên gợi nhớ (vd 'Onboarding flow' hoặc 'AC-3 empty state')"),
    nodeId: z.string().optional(),
  },
  async ({ id, url, name, nodeId }) => {
    try {
      const { added, total } = addFigmaLinks(id, [{ url, name, nodeId }]);
      return text(`${added ? "✅ Đã thêm" : "Đã có (bỏ qua)"} Figma link. Tổng: ${total}.`);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.tool(
  "add_raw_url",
  "(BA) Nạp 1 URL vào 00-raw/ của feature. Notion → fetch nội dung (cần NOTION_API_KEY) + trích Figma link; Figma → thêm vào figma[]; URL khác → lưu pointer. Để fetch Notion bằng Notion MCP của bạn rồi dùng submit_raw nếu server không có token.",
  {
    id: z.string(),
    url: z.string(),
    withFigma: z.boolean().optional().describe("tự thêm Figma link tìm thấy trong nội dung (mặc định true)"),
  },
  async ({ id, url, withFigma }) => {
    try {
      const results = await addRaw(id, [url], { withFigma });
      return text(JSON.stringify(results, null, 2));
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.tool(
  "submit_raw",
  "BA ném 1 file docs thô vào inbox 00-raw/ của feature (text). Skill compile-feature sẽ biên dịch sau.",
  {
    id: z.string(),
    filename: z.string().describe("tên file, vd meeting-notes.md"),
    content: z.string(),
  },
  async ({ id, filename, content }) => {
    try {
      readFeatureMeta(id); // đảm bảo feature tồn tại
      const f = featureFiles(id);
      const safe = path.basename(filename);
      fs.mkdirSync(f.raw, { recursive: true });
      fs.writeFileSync(path.join(f.raw, safe), content, "utf8");
      return text(`✅ Đã lưu 00-raw/${safe} cho ${id}.`);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
