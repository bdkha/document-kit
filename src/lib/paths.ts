import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

/**
 * Gốc của kit. Local-first: ưu tiên env DOC_KIT_ROOT, nếu không thì suy ra từ vị trí
 * file build (dist/lib -> gốc repo). Cho phép FE/BE trỏ MCP vào bản clone/submodule.
 */
export function kitRoot(): string {
  const fromEnv = process.env.DOC_KIT_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);

  // dist/lib/paths.js -> ../../ = gốc repo
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export function featuresDir(): string {
  return path.join(kitRoot(), "features");
}

export function featureDir(id: string): string {
  return path.join(featuresDir(), id);
}

export function templatesDir(): string {
  return path.join(kitRoot(), "templates");
}

export function sharedDir(): string {
  return path.join(kitRoot(), "shared");
}

export function schemaPath(): string {
  return path.join(kitRoot(), ".doc-kit", "schema", "feature.schema.json");
}

/** Đường dẫn các file con của một feature. */
export function featureFiles(id: string) {
  const dir = featureDir(id);
  return {
    dir,
    yaml: path.join(dir, "feature.yaml"),
    raw: path.join(dir, "00-raw"),
    business: path.join(dir, "01-business-spec.md"),
    design: path.join(dir, "02-design-spec.md"),
    apiDir: path.join(dir, "03-api"),
    openapi: path.join(dir, "03-api", "openapi.yaml"),
    apiSpec: path.join(dir, "03-api", "api-spec.md"),
    feTasks: path.join(dir, "04-fe-tasks.md"),
    changelog: path.join(dir, "CHANGELOG.md"),
  };
}
