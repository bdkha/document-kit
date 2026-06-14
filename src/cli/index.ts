#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createFeature } from "../lib/scaffold.js";
import { listFeatures } from "../lib/features.js";
import { pushApi } from "../lib/push-api.js";
import { validateAll } from "../lib/validate.js";

const HELP = `doc-kit — CLI cho Document Kit

Dùng:
  doc-kit new "<Tên feature>"                 Tạo feature mới từ template
  doc-kit list [status]                       Liệt kê feature (lọc theo status nếu có)
  doc-kit push-api <feature-id> <openapi> [--ci] [--note "..."]
                                              Đẩy OpenAPI lên 1 feature, sinh api-spec.md
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

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  const ci = has("--ci");

  switch (cmd) {
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
      const res = pushApi(id, content, { note: arg("--note") });
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

try {
  main();
} catch (e) {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
}
