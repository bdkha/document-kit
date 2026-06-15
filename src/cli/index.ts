#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadDocKitEnv } from "../lib/env.js";
import { createFeature, initWorkspace } from "../lib/scaffold.js";
import { listFeatures } from "../lib/features.js";
import { pushApi } from "../lib/push-api.js";
import { validateAll } from "../lib/validate.js";
import { pendingChanges, ackPull } from "../lib/consumer.js";
import { notifyLinear } from "../lib/notify-linear.js";

const HELP = `doc-kit — CLI cho Document Kit

Dùng:
  doc-kit init [thư-mục]                       Khởi tạo workspace docs cho 1 dự án
  doc-kit mcp                                  Chạy MCP server (stdio, local-first)
  doc-kit new "<Tên feature>"                 Tạo feature mới từ template
  doc-kit list [status]                       Liệt kê feature (lọc theo status nếu có)
  doc-kit push-api <feature-id> <openapi> [--ci] [--note "..."]
                   [--paths "/a/**,/b"] [--tags "t1,t2"]
                                              Đẩy OpenAPI lên 1 feature, sinh api-spec.md.
                                              --paths/--tags: cắt spec lớn về đúng feature.
  doc-kit pending [--state f] [--ci]          (FE) Feature có API mới hơn version đã pull
  doc-kit ack <feature-id> [--state f]        (FE) Xác nhận đã pull tới API version hiện tại
  doc-kit notify <feature-id> [--note "..."]  (BE/CI) Comment Linear báo API đổi (cần LINEAR_API_KEY)
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
        const repull = m.api?.needs_fe_repull ? "  ⚠️ FE re-pull" : "";
        console.log(`${m.id}  [${m.status}]  api v${apiV}${repull}  — ${m.title}`);
      }
      break;
    }

    case "push-api": {
      const id = rest[0];
      const file = rest[1];
      if (!id || !file) throw new Error("Dùng: doc-kit push-api <feature-id> <openapi-file>");
      if (!fs.existsSync(file)) throw new Error(`Không tìm thấy file OpenAPI: ${file}`);
      const content = fs.readFileSync(path.resolve(file), "utf8");
      const splitList = (v?: string) =>
        v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const res = pushApi(id, content, {
        note: arg("--note"),
        paths: splitList(arg("--paths")),
        tags: splitList(arg("--tags")),
      });
      if (ci) {
        console.log(JSON.stringify({ ok: true, ...res }, null, 2));
        break;
      }
      console.log(`✅ Đã đẩy API cho ${res.featureId}`);
      console.log(`   api version: v${res.apiVersion}  •  endpoints: ${res.endpoints}`);
      console.log(`   sinh: ${res.apiSpecPath}`);
      console.log(`   → đã set needs_fe_repull=true. FE nên get_feature lại.`);
      break;
    }

    case "pending": {
      const items = pendingChanges(arg("--state"));
      if (ci) {
        console.log(JSON.stringify(items, null, 2));
        break;
      }
      if (items.length === 0) {
        console.log("✅ Không có API mới cần pull.");
        break;
      }
      console.log(`Có ${items.length} feature API mới hơn bản bạn đã pull:\n`);
      for (const it of items) {
        console.log(`● ${it.id} — ${it.title}  (đã pull v${it.ackedVersion} → hiện v${it.currentVersion})`);
        if (it.changelog) console.log(it.changelog.split("\n").map((l) => "    " + l).join("\n"));
        console.log(`    → get_feature rồi: doc-kit ack ${it.id}\n`);
      }
      break;
    }

    case "ack": {
      const id = rest[0];
      if (!id) throw new Error("Dùng: doc-kit ack <feature-id>");
      const res = ackPull(id, arg("--state"));
      if (ci) console.log(JSON.stringify({ ok: true, ...res }, null, 2));
      else console.log(`✅ Đã ack ${res.id} ở api v${res.version}.`);
      break;
    }

    case "notify": {
      const id = rest[0];
      if (!id) throw new Error("Dùng: doc-kit notify <feature-id> [--note ...]");
      const res = await notifyLinear(id, { note: arg("--note") });
      if (ci) console.log(JSON.stringify(res, null, 2));
      else if (res.status === "sent") console.log(`✅ Đã comment Linear (${res.ticket}).`);
      else console.log(`⏭️  Bỏ qua notify: ${res.reason}`);
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
