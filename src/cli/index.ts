#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadDocKitEnv } from "../lib/env.js";
import { createFeature, initWorkspace } from "../lib/scaffold.js";
import { addRaw } from "../lib/add-raw.js";
import { addFigmaLinks } from "../lib/figma.js";
import { installSkills } from "../lib/install-skills.js";
import { listFeatures, findFeatures, renderFeatureBundle } from "../lib/features.js";
import { pushApi } from "../lib/push-api.js";
import { logChange, type MaintenanceType } from "../lib/log-change.js";
import { planForTicket, renderTicketPlan } from "../lib/plan.js";
import type { Role } from "../lib/features.js";
import { validateAll } from "../lib/validate.js";
import { pendingChanges, ackPull } from "../lib/consumer.js";
import { notifyFeature } from "../lib/notify.js";

/** Parse danh sách phân tách bằng dấu phẩy → mảng (bỏ rỗng). */
function splitList(v?: string): string[] | undefined {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
}
function parseRoles(v?: string): Role[] | undefined {
  const list = splitList(v)?.map((s) => s.toLowerCase()).filter((s): s is Role => s === "fe" || s === "be");
  return list && list.length ? list : undefined;
}

const HELP = `doc-kit — CLI cho Document Kit

Dùng:
  doc-kit init [thư-mục]                       Khởi tạo workspace docs cho 1 dự án
  doc-kit mcp                                  Chạy MCP server (stdio, local-first)
  doc-kit install-skills [--global] [dir]      Cài skills vào .claude/skills (project) hoặc
                                              ~/.claude/skills (--global) để Claude Code dùng
  doc-kit new "<Tên feature>"                 Tạo feature mới từ template
  doc-kit add-raw <feature-id> <path|url...>  Nạp docs thô vào 00-raw/ (file, link Notion,
                                              link Figma). Notion: fetch nội dung + trích Figma.
                                              [--no-figma] không tự thêm Figma link tìm thấy.
  doc-kit add-figma <feature-id> <url>        Thêm Figma link vào feature.yaml [--name "..."] [--node 1:23]
  doc-kit list [status]                       Liệt kê feature (lọc theo status nếu có)
  doc-kit context <feature-id>                In trọn gói context feature (cho planning)
  doc-kit find [--ticket X] [--query Y] [--status S]
                                              Tìm feature theo ticket/từ khoá/status
  doc-kit push-api <feature-id> <openapi> [--ci] [--note "..."]
                   [--paths "/a/**,/b"] [--tags "t1,t2"] [--impact fe,be] [--ticket X]
                                              Đẩy OpenAPI lên 1 feature, sinh api-spec.md.
                                              --paths/--tags: cắt spec lớn về đúng feature.
                                              --impact: vai cần pull lại (mặc định fe).
  doc-kit log-change <feature-id> --type bugfix|improvement|chore --note "..."
                     [--ticket ENG-123] [--impact fe,be] [--docs "01-business-spec.md#br-3"]
                                              Ghi 1 thay đổi bảo trì (bug fix/cải tiến) lên feature
                                              đã có: bump version + change[], gắn ticket, giữ status.
                                              --impact: vai cần hành động (mặc định fe,be).
  doc-kit plan --ticket <id> [--role fe|be]   Tra theo ticket → gói plan đã scope (delta change +
                                              spec liên quan) để planner dựng plan.
  doc-kit pending [--role fe|be] [--state f]  Feature có thay đổi mới (ảnh hưởng role) chưa pull
  doc-kit ack <feature-id> [--role fe|be]     Xác nhận role này đã pull tới revision hiện tại
  doc-kit notify <feature-id> [--note "..."]  (BE/CI) Báo API đổi vào ticket của feature
                                              (Linear: LINEAR_API_KEY; Redmine self-host: REDMINE_URL + REDMINE_API_KEY)
  doc-kit validate                            Validate toàn bộ kit (schema + cấu trúc)
  doc-kit help                                Hiện trợ giúp

Ghi chú:
  --ci    chế độ non-interactive: chỉ in JSON kết quả, exit code != 0 nếu lỗi.
`;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const ci = has("--ci");

  // MCP: uỷ quyền sang server (module tự connect khi import). Không nạp env trước
  // vì DOC_KIT_ROOT do client truyền qua env process.
  if (cmd === "mcp") {
    await import("../mcp/index.js");
    return;
  }

  loadDocKitEnv();

  switch (cmd) {
    case "init": {
      const { dir, files } = initWorkspace(rest.find((r) => !r.startsWith("--")));
      console.log(`✅ Đã khởi tạo workspace docs: ${dir}`);
      console.log(`   ${files.join(", ")}`);
      console.log(`   Bước tiếp: cp .env.example .env  →  doc-kit new "Feature đầu tiên"`);
      break;
    }

    case "add-raw": {
      const id = rest[0];
      const sources = rest.slice(1).filter((r) => !r.startsWith("--"));
      if (!id || sources.length === 0) {
        throw new Error('Dùng: doc-kit add-raw <feature-id> <path|url...> [--no-figma]');
      }
      const results = await addRaw(id, sources, { withFigma: !has("--no-figma") });
      if (ci) {
        console.log(JSON.stringify(results, null, 2));
        break;
      }
      for (const r of results) {
        const figma = r.figmaAdded ? `  (+${r.figmaAdded} Figma link)` : "";
        const where = r.saved ? `→ 00-raw/${r.saved}` : r.kind === "figma" ? "→ feature.yaml.figma[]" : "";
        console.log(`✅ [${r.kind}] ${r.source} ${where}${figma}${r.note ? `  ⚠️ ${r.note}` : ""}`);
      }
      console.log(`   Bước tiếp: dùng skill compile-feature để biên dịch.`);
      break;
    }

    case "add-figma": {
      const id = rest[0];
      const url = rest[1];
      if (!id || !url) throw new Error('Dùng: doc-kit add-figma <feature-id> <url> [--name "..."] [--node 1:23]');
      const { added, total } = addFigmaLinks(id, [{ url, name: arg("--name"), nodeId: arg("--node") }]);
      if (ci) console.log(JSON.stringify({ ok: true, added, total }, null, 2));
      else console.log(`✅ ${added ? "Đã thêm" : "Đã có (bỏ qua)"} Figma link. Tổng: ${total}.`);
      break;
    }

    case "install-skills": {
      const dir = rest.find((r) => !r.startsWith("--"));
      const { dest, installed } = installSkills({ global: has("--global"), dir });
      if (ci) {
        console.log(JSON.stringify({ ok: true, dest, installed }, null, 2));
        break;
      }
      console.log(`✅ Đã cài ${installed.length} skill vào: ${dest}`);
      console.log(`   ${installed.join(", ")}`);
      console.log(`   Mở project trong Claude Code → gõ /${installed[0] ?? "skill"} để dùng.`);
      break;
    }

    case "new": {
      const title = rest[0];
      if (!title) throw new Error('Thiếu tên feature. Vd: doc-kit new "User Onboarding"');
      const { id, dir } = createFeature(title);
      console.log(`✅ Đã tạo feature: ${id}`);
      console.log(`   ${dir}`);
      console.log(`   Bước tiếp: bỏ docs thô vào 00-raw/ rồi dùng skill compile-feature.`);
      break;
    }

    case "list": {
      const status = rest.find((r) => !r.startsWith("--"));
      const items = listFeatures(status);
      if (ci) {
        console.log(JSON.stringify(items, null, 2));
        break;
      }
      if (items.length === 0) {
        console.log("(chưa có feature nào)");
        break;
      }
      for (const m of items) {
        const apiV = m.api?.version ?? 0;
        const last = (m.changes ?? [])[(m.changes?.length ?? 0) - 1];
        const hint = last ? `  ←rev ${last.rev}[${last.type}] impact:${last.impact.join("+")}` : "";
        console.log(`${m.id}  [${m.status}]  rev ${m.version} · api v${apiV}${hint}  — ${m.title}`);
      }
      break;
    }

    case "context": {
      const id = rest.find((r) => !r.startsWith("--"));
      if (!id) throw new Error("Dùng: doc-kit context <feature-id>");
      console.log(renderFeatureBundle(id));
      break;
    }

    case "find": {
      const items = findFeatures({ ticket: arg("--ticket"), query: arg("--query"), status: arg("--status") });
      if (ci) {
        console.log(JSON.stringify(items, null, 2));
        break;
      }
      if (items.length === 0) {
        console.log("Không tìm thấy feature khớp.");
        break;
      }
      for (const m of items) {
        const tk = (m.tickets ?? []).map((t) => t.id).join(",");
        console.log(`${m.id}  [${m.status}]  api v${m.api?.version ?? 0}${tk ? `  (${tk})` : ""}  — ${m.title}`);
      }
      break;
    }

    case "push-api": {
      const id = rest[0];
      const file = rest[1];
      if (!id || !file) throw new Error("Dùng: doc-kit push-api <feature-id> <openapi-file>");
      if (!fs.existsSync(file)) throw new Error(`Không tìm thấy file OpenAPI: ${file}`);
      const content = fs.readFileSync(path.resolve(file), "utf8");
      const res = pushApi(id, content, {
        note: arg("--note"),
        paths: splitList(arg("--paths")),
        tags: splitList(arg("--tags")),
        impact: parseRoles(arg("--impact")),
        ticket: arg("--ticket"),
      });
      if (ci) {
        console.log(JSON.stringify({ ok: true, ...res }, null, 2));
        break;
      }
      console.log(`✅ Đã đẩy API cho ${res.featureId}`);
      console.log(`   api version: v${res.apiVersion}  •  endpoints: ${res.endpoints}`);
      console.log(`   sinh: ${res.apiSpecPath}`);
      console.log(`   → FE (và role bị impact) nên pull lại: doc-kit pending --role <fe|be>.`);
      break;
    }

    case "log-change": {
      const id = rest[0];
      if (!id) throw new Error('Dùng: doc-kit log-change <feature-id> --type bugfix|improvement|chore --note "..."');
      const type = arg("--type") as MaintenanceType | undefined;
      if (!type || !["bugfix", "improvement", "chore"].includes(type)) {
        throw new Error("--type bắt buộc, phải là một trong: bugfix | improvement | chore");
      }
      const note = arg("--note");
      if (!note) throw new Error('--note bắt buộc (mô tả thay đổi). Vd: --note "Sửa validate email"');
      const ticketId = arg("--ticket");
      const res = logChange(id, {
        type,
        note,
        ticket: ticketId ? { id: ticketId } : undefined,
        impact: parseRoles(arg("--impact")),
        docs: splitList(arg("--docs")),
      });
      if (ci) {
        console.log(JSON.stringify({ ok: true, ...res }, null, 2));
        break;
      }
      console.log(`✅ Đã ghi nhận thay đổi [${res.type}] cho ${res.featureId}`);
      console.log(`   rev v${res.version}  •  impact: ${res.impact.join(", ")}  •  CHANGELOG: ${res.changelogPath}`);
      console.log(`   → role bị impact pull lại: doc-kit pending --role <fe|be>.`);
      break;
    }

    case "plan": {
      const ticket = arg("--ticket");
      if (!ticket) throw new Error("Dùng: doc-kit plan --ticket <id> [--role fe|be]");
      const plans = planForTicket(ticket, arg("--role"));
      if (ci) {
        console.log(JSON.stringify(plans, null, 2));
        break;
      }
      console.log(renderTicketPlan(plans));
      break;
    }

    case "pending": {
      const items = pendingChanges(arg("--role"), arg("--state"));
      if (ci) {
        console.log(JSON.stringify(items, null, 2));
        break;
      }
      if (items.length === 0) {
        console.log("✅ Không có thay đổi mới cần pull cho role này.");
        break;
      }
      console.log(`Có ${items.length} feature có thay đổi mới (role ${items[0].role}):\n`);
      for (const it of items) {
        console.log(`● ${it.id} — ${it.title}  (đã pull rev ${it.ackedRev} → hiện rev ${it.currentRev})`);
        for (const c of it.changes) {
          console.log(`    - rev ${c.rev} [${c.type}] ${c.note}${c.docs?.length ? `  (docs: ${c.docs.join(", ")})` : ""}`);
        }
        console.log(`    → plan: doc-kit plan --ticket <id> --role ${it.role} ; xong: doc-kit ack ${it.id} --role ${it.role}\n`);
      }
      break;
    }

    case "ack": {
      const id = rest[0];
      if (!id) throw new Error("Dùng: doc-kit ack <feature-id> [--role fe|be]");
      const res = ackPull(id, arg("--role"), arg("--state"));
      if (ci) console.log(JSON.stringify({ ok: true, ...res }, null, 2));
      else console.log(`✅ Đã ack ${res.id} (role ${res.role}) tới rev ${res.rev}.`);
      break;
    }

    case "notify": {
      const id = rest[0];
      if (!id) throw new Error("Dùng: doc-kit notify <feature-id> [--note ...]");
      const results = await notifyFeature(id, { note: arg("--note") });
      if (ci) {
        console.log(JSON.stringify(results, null, 2));
        break;
      }
      if (results.length === 0) {
        console.log("⏭️  Bỏ qua notify: feature không có ticket hỗ trợ (linear/redmine).");
        break;
      }
      for (const res of results) {
        if (res.status === "sent") console.log(`✅ Đã báo ${res.system} (${res.ticket}).`);
        else console.log(`⏭️  Bỏ qua ${res.system}: ${res.reason}`);
      }
      break;
    }

    case "validate": {
      const { ok, results } = validateAll();
      if (ci) {
        console.log(JSON.stringify({ ok, results }, null, 2));
        if (!ok) process.exit(1);
        break;
      }
      if (results.length === 0) {
        console.log("✅ Kit hợp lệ, không có vấn đề.");
        break;
      }
      for (const r of results) {
        console.log(`\n● ${r.id}`);
        for (const e of r.errors) console.log(`   ❌ ${e}`);
        for (const w of r.warnings) console.log(`   ⚠️  ${w}`);
      }
      if (!ok) {
        console.log("\nCó lỗi schema/cấu trúc.");
        process.exit(1);
      }
      break;
    }

    case "help":
    case undefined:
      console.log(HELP);
      break;

    default:
      console.error(`Lệnh không rõ: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
