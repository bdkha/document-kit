#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  listFeatures,
  getFeatureBundle,
  readDoc,
  readFeatureMeta,
} from "../lib/features.js";
import { featureFiles, sharedDir } from "../lib/paths.js";
import { pushApi } from "../lib/push-api.js";
import path from "node:path";
import fs from "node:fs";

const server = new McpServer({ name: "document-kit", version: "0.1.0" });

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}
function fail(msg: string) {
  return { isError: true, content: [{ type: "text" as const, text: `Lỗi: ${msg}` }] };
}

// ── READ PATH ──────────────────────────────────────────────────────────────

server.tool(
  "list_features",
  "Liệt kê các feature trong kit (id, title, status, api version). Lọc theo status nếu cần.",
  { status: z.enum(["draft", "in-design", "in-dev", "ready", "done"]).optional() },
  async ({ status }) => {
    const items = listFeatures(status).map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      apiVersion: m.api?.version ?? 0,
      needsFeRepull: m.api?.needs_fe_repull ?? false,
      platforms: m.platforms ?? [],
    }));
    return text(JSON.stringify(items, null, 2));
  },
);

server.tool(
  "get_feature",
  "Lấy TRỌN GÓI context của 1 feature: metadata + business-spec + design-spec + api-spec + fe-tasks + changelog. FE dùng tool này để bắt đầu task.",
  { id: z.string().describe("feature id, vd F-001-user-onboarding") },
  async ({ id }) => {
    try {
      const b = getFeatureBundle(id);
      const parts: string[] = [];
      parts.push(`# Feature ${b.meta.id} — ${b.meta.title}`);
      parts.push("```yaml\n" + JSON.stringify(b.meta, null, 2) + "\n```");
      if (b.meta.api?.needs_fe_repull) {
        parts.push("> ⚠️ API vừa đổi (needs_fe_repull=true). Đọc kỹ api-spec + changelog trước khi làm.");
      }
      parts.push("\n---\n## BUSINESS SPEC\n", b.business ?? "_(chưa có)_");
      parts.push("\n---\n## API SPEC\n", b.apiSpec ?? "_(BE chưa đẩy OpenAPI)_");
      parts.push("\n---\n## DESIGN SPEC\n", b.design ?? "_(chưa có)_");
      parts.push("\n---\n## FE TASKS\n", b.feTasks ?? "_(chưa có)_");
      parts.push("\n---\n## CHANGELOG\n", b.changelog ?? "_(trống)_");
      return text(parts.join("\n"));
    } catch (e) {
      return fail((e as Error).message);
    }
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

// ── WRITE PATH ─────────────────────────────────────────────────────────────

server.tool(
  "push_api_doc",
  "BE đẩy OpenAPI (3.x) lên 1 feature. Bạn (AI) quyết định API nào thuộc feature qua paths/tags; " +
    "kit cắt deterministic + kéo theo $ref. Bỏ trống paths&tags = lấy nguyên spec. " +
    "Validate, ghi openapi.yaml, sinh api-spec.md, bump version, set cờ FE re-pull, ghi changelog.",
  {
    id: z.string().describe("feature id"),
    openapi: z.string().describe("nội dung OpenAPI dạng YAML hoặc JSON (có thể là spec cả service)"),
    paths: z
      .array(z.string())
      .optional()
      .describe('glob path thuộc feature, vd ["/onboarding/**"]. * = trong 1 segment, ** = nhiều segment.'),
    tags: z.array(z.string()).optional().describe('tag OpenAPI thuộc feature, vd ["onboarding"].'),
    note: z.string().optional().describe("ghi chú thay đổi cho changelog"),
  },
  async ({ id, openapi, paths, tags, note }) => {
    try {
      const res = pushApi(id, openapi, { note, paths, tags });
      return text(
        `✅ Đã đẩy API cho ${res.featureId}: v${res.apiVersion}, ${res.endpoints} endpoint.\n` +
          `Sinh api-spec.md, set needs_fe_repull=true.`,
      );
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
