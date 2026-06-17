import fs from "node:fs";
import yaml from "js-yaml";
import { featureFiles } from "./paths.js";
import { readFeatureMeta, writeFeatureMeta, type Role } from "./features.js";
import { openapiToMarkdown } from "./openapi-to-md.js";
import { sliceOpenApi, type Selector } from "./openapi-slice.js";
import { today, prependChangelogEntry, appendChange } from "./changelog.js";

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
  /** Vai cần hành động. Mặc định [fe] (BE đẩy API cho FE consume). */
  impact?: Role[];
  /** Ticket gây ra thay đổi API (gắn vào change entry để plan_for_ticket tìm được). */
  ticket?: string;
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
 *  - bump api.version + feature.version, ghi changes[] (type=api) + CHANGELOG, cập nhật feature.yaml
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
  const impact: Role[] = opts.impact && opts.impact.length ? opts.impact : ["fe"];

  // 1) Ghi source of truth (chuẩn hoá về yaml)
  fs.mkdirSync(f.apiDir, { recursive: true });
  fs.writeFileSync(f.openapi, yaml.dump(spec, { lineWidth: 120 }), "utf8");

  // 2) Sinh api-spec.md
  const md = openapiToMarkdown(spec, { featureId, apiVersion, updatedAt: date });
  fs.writeFileSync(f.apiSpec, md, "utf8");

  // 3) Cập nhật metadata: bump cả api.version (header api-spec) lẫn feature.version (revision chung)
  const endpoints = countEndpoints(spec);
  meta.api = { ...(meta.api ?? {}), version: apiVersion };
  meta.version = (meta.version ?? 1) + 1;
  meta.updated_at = date;
  // Nếu feature còn draft mà BE đã có API, đẩy tối thiểu sang in-dev
  if (meta.status === "draft" || meta.status === "in-design") meta.status = "in-dev";
  appendChange(meta, {
    rev: meta.version,
    date,
    type: "api",
    note: opts.note ? opts.note : `BE đẩy OpenAPI: ${endpoints} endpoint.`,
    tickets: opts.ticket ? [opts.ticket] : undefined,
    impact,
  });
  writeFeatureMeta(featureId, meta);

  // 4) Ghi CHANGELOG (bản người-đọc)
  const entry = [
    `## api v${apiVersion} — ${date}`,
    `- BE đẩy OpenAPI: ${endpoints} endpoint.`,
    opts.note ? `- Ghi chú: ${opts.note}` : null,
    `- Impact: ${impact.join(", ")}`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  prependChangelogEntry(f.changelog, entry, meta.title);

  return { featureId, apiVersion, endpoints, apiSpecPath: f.apiSpec };
}
