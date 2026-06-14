import fs from "node:fs";
import yaml from "js-yaml";
import { featureFiles } from "./paths.js";
import { readFeatureMeta, writeFeatureMeta } from "./features.js";
import { openapiToMarkdown } from "./openapi-to-md.js";
import { sliceOpenApi, type Selector } from "./openapi-slice.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PushApiResult {
  featureId: string;
  apiVersion: number;
  endpoints: number;
  apiSpecPath: string;
}

export interface PushApiOptions {
  note?: string;
  /** Selector để cắt 1 OpenAPI lớn về đúng feature. Bỏ trống = lấy nguyên spec. */
  paths?: string[];
  tags?: string[];
}

function countEndpoints(spec: any): number {
  const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
  let n = 0;
  for (const item of Object.values<any>(spec.paths ?? {})) {
    for (const m of methods) if (item?.[m]) n++;
  }
  return n;
}

/**
 * Nhận nội dung OpenAPI (string yaml/json) cho một feature:
 *  - validate sơ bộ (có paths)
 *  - ghi openapi.yaml (source of truth)
 *  - sinh api-spec.md (AI-friendly)
 *  - bump api.version, set needs_fe_repull, ghi CHANGELOG, cập nhật feature.yaml
 */
export function pushApi(featureId: string, openapiContent: string, opts: PushApiOptions = {}): PushApiResult {
  const meta = readFeatureMeta(featureId); // throw nếu feature không tồn tại
  const f = featureFiles(featureId);

  let full: any;
  try {
    full = yaml.load(openapiContent); // js-yaml parse được cả JSON
  } catch (e) {
    throw new Error(`OpenAPI không parse được: ${(e as Error).message}`);
  }
  if (!full || typeof full !== "object") throw new Error("OpenAPI rỗng / không hợp lệ.");
  if (!full.openapi) throw new Error('Thiếu field "openapi" (phải là OpenAPI 3.x).');
  if (!full.paths || Object.keys(full.paths).length === 0) {
    throw new Error("OpenAPI không có endpoint nào (paths rỗng).");
  }

  // Cắt về đúng feature theo selector (do AI/người quyết định). Bỏ trống = nguyên spec.
  const selector: Selector = { paths: opts.paths, tags: opts.tags };
  const { spec } = sliceOpenApi(full, selector);

  const prevVersion = meta.api?.version ?? 0;
  const apiVersion = prevVersion + 1;
  const date = today();

  // 1) Ghi source of truth (chuẩn hoá về yaml)
  fs.mkdirSync(f.apiDir, { recursive: true });
  fs.writeFileSync(f.openapi, yaml.dump(spec, { lineWidth: 120 }), "utf8");

  // 2) Sinh api-spec.md
  const md = openapiToMarkdown(spec, { featureId, apiVersion, updatedAt: date });
  fs.writeFileSync(f.apiSpec, md, "utf8");

  // 3) Cập nhật metadata
  meta.api = { ...(meta.api ?? {}), version: apiVersion, needs_fe_repull: true };
  meta.updated_at = date;
  // Nếu feature còn draft mà BE đã có API, đẩy tối thiểu sang in-dev
  if (meta.status === "draft" || meta.status === "in-design") meta.status = "in-dev";
  writeFeatureMeta(featureId, meta);

  // 4) Ghi CHANGELOG
  const endpoints = countEndpoints(spec);
  const entry = [
    `## api v${apiVersion} — ${date}`,
    `- BE đẩy OpenAPI: ${endpoints} endpoint.`,
    opts.note ? `- Ghi chú: ${opts.note}` : null,
    `- ⚠️ FE cần re-pull: có (needs_fe_repull=true)`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const existing = fs.existsSync(f.changelog) ? fs.readFileSync(f.changelog, "utf8") : `# Changelog — ${meta.title}\n\n`;
  // Chèn entry ngay sau dòng tiêu đề đầu tiên
  const lines = existing.split("\n");
  const headerIdx = lines.findIndex((l) => l.startsWith("# "));
  const insertAt = headerIdx >= 0 ? headerIdx + 1 : 0;
  lines.splice(insertAt, 0, "", entry);
  fs.writeFileSync(f.changelog, lines.join("\n"), "utf8");

  return { featureId, apiVersion, endpoints, apiSpecPath: f.apiSpec };
}
