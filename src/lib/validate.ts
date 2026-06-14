import fs from "node:fs";
import { listFeatureIds, readFeatureMeta } from "./features.js";
import { validateFeatureMeta } from "./schema.js";
import { featureFiles } from "./paths.js";

export interface FeatureIssue {
  id: string;
  errors: string[];
  warnings: string[];
}

/** Validate toàn bộ feature: schema feature.yaml + id khớp thư mục + cảnh báo doc thiếu. */
export function validateAll(): { ok: boolean; results: FeatureIssue[] } {
  const results: FeatureIssue[] = [];

  for (const id of listFeatureIds()) {
    const errors: string[] = [];
    const warnings: string[] = [];

    let meta: ReturnType<typeof readFeatureMeta> | null = null;
    try {
      meta = readFeatureMeta(id);
    } catch (e) {
      errors.push(`Không đọc được feature.yaml: ${(e as Error).message}`);
    }

    if (meta) {
      const v = validateFeatureMeta(meta);
      if (!v.valid) errors.push(...v.errors.map((e) => `schema: ${e}`));
      if (meta.id !== id) errors.push(`id trong feature.yaml ("${meta.id}") khác tên thư mục ("${id}").`);

      const f = featureFiles(id);
      if (!fs.existsSync(f.business)) warnings.push("thiếu 01-business-spec.md");
      if (meta.api?.version && meta.api.version >= 1 && !fs.existsSync(f.apiSpec)) {
        warnings.push("api.version>=1 nhưng thiếu 03-api/api-spec.md");
      }
      if (meta.status !== "draft" && !fs.existsSync(f.openapi) && (meta.api?.version ?? 0) >= 1) {
        warnings.push("thiếu 03-api/openapi.yaml dù đã có api version");
      }
    }

    if (errors.length || warnings.length) results.push({ id, errors, warnings });
  }

  const ok = results.every((r) => r.errors.length === 0);
  return { ok, results };
}
