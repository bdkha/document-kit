import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

/**
 * Hai gốc tách biệt khi đóng gói thành npm package:
 *
 *  - packageRoot: nơi asset của TOOL được ship (templates/, scaffold/, .doc-kit/schema).
 *    Suy ra từ vị trí file build (dist/lib -> ../../ = gốc package đã cài).
 *
 *  - contentRoot: nơi DOCS của dự án nằm (features/, shared/, .doc-kit/config.yaml, .env).
 *    Ưu tiên env DOC_KIT_ROOT; nếu không, dò ngược từ cwd tìm marker; cuối cùng = cwd.
 */

/** Gốc package (tool) — chứa asset shipped. */
export function packageRoot(): string {
  // dist/lib/paths.js -> ../../ = gốc package
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function hasContentMarker(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, ".doc-kit", "config.yaml")) ||
    fs.existsSync(path.join(dir, "features"))
  );
}

/** Gốc content (docs của dự án). */
export function contentRoot(): string {
  const fromEnv = process.env.DOC_KIT_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);

  // Dò ngược từ cwd tìm workspace docs.
  let dir = process.cwd();
  for (;;) {
    if (hasContentMarker(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// ── Asset của tool (packageRoot) ─────────────────────────────────────────────

export function templatesDir(): string {
  return path.join(packageRoot(), "templates");
}

export function scaffoldDir(): string {
  return path.join(packageRoot(), "scaffold");
}

/** Thư mục skills canonical được ship (trong scaffold/.claude/skills). */
export function skillsSourceDir(): string {
  return path.join(packageRoot(), "scaffold", ".claude", "skills");
}

export function schemaPath(): string {
  return path.join(packageRoot(), ".doc-kit", "schema", "feature.schema.json");
}

// ── Content của dự án (contentRoot) ──────────────────────────────────────────

export function featuresDir(): string {
  return path.join(contentRoot(), "features");
}

export function featureDir(id: string): string {
  return path.join(featuresDir(), id);
}

export function sharedDir(): string {
  return path.join(contentRoot(), "shared");
}

export function configPath(): string {
  return path.join(contentRoot(), ".doc-kit", "config.yaml");
}

export function defaultStatePath(): string {
  return path.join(contentRoot(), ".doc-kit-state.local.json");
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
