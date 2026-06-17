import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import matter from "gray-matter";
import { featuresDir, featureFiles } from "./paths.js";

export interface FeatureMeta {
  id: string;
  title: string;
  status: "draft" | "in-design" | "in-dev" | "ready" | "done";
  version: number;
  summary?: string;
  owners?: { ba?: string; fe?: string; be?: string };
  tickets?: { system: string; id: string; url?: string; type?: "feature" | "bugfix" | "improvement" | "chore" }[];
  figma?: { name?: string; url: string; nodeId?: string }[];
  api?: { version?: number; source?: string; needs_fe_repull?: boolean };
  platforms?: string[];
  updated_at: string;
}

/** Đọc + parse feature.yaml. Throw nếu không tồn tại. */
export function readFeatureMeta(id: string): FeatureMeta {
  const { yaml: yamlPath } = featureFiles(id);
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`Không tìm thấy feature "${id}" (${yamlPath})`);
  }
  return yaml.load(fs.readFileSync(yamlPath, "utf8")) as FeatureMeta;
}

/** Ghi feature.yaml. */
export function writeFeatureMeta(id: string, meta: FeatureMeta): void {
  const { yaml: yamlPath } = featureFiles(id);
  fs.writeFileSync(yamlPath, yaml.dump(meta, { lineWidth: 100 }), "utf8");
}

/** Liệt kê tất cả feature id (thư mục có feature.yaml). */
export function listFeatureIds(): string[] {
  const dir = featuresDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(dir, name, "feature.yaml")))
    .sort();
}

/** Liệt kê metadata feature, lọc theo status nếu có. */
export function listFeatures(status?: string): FeatureMeta[] {
  return listFeatureIds()
    .map((id) => {
      try {
        return readFeatureMeta(id);
      } catch {
        return null;
      }
    })
    .filter((m): m is FeatureMeta => m !== null)
    .filter((m) => (status ? m.status === status : true));
}

/** Đọc một file markdown của feature; trả null nếu chưa có. */
export function readDoc(absPath: string): string | null {
  if (!fs.existsSync(absPath)) return null;
  return fs.readFileSync(absPath, "utf8");
}

/** Đọc frontmatter + body của một doc markdown. */
export function readDocParsed(absPath: string): { data: Record<string, unknown>; body: string } | null {
  const raw = readDoc(absPath);
  if (raw === null) return null;
  const parsed = matter(raw);
  return { data: parsed.data, body: parsed.content };
}

/** Tìm feature theo ticket id / status / từ khoá (title+summary). */
export function findFeatures(opts: { ticket?: string; status?: string; query?: string }): FeatureMeta[] {
  const q = opts.query?.toLowerCase();
  return listFeatures(opts.status).filter((m) => {
    if (opts.ticket && !(m.tickets ?? []).some((t) => t.id?.toLowerCase() === opts.ticket!.toLowerCase())) {
      return false;
    }
    if (q) {
      const hay = `${m.id} ${m.title} ${m.summary ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Render trọn gói context một feature thành markdown (dùng cho MCP get_feature + CLI context). */
export function renderFeatureBundle(id: string): string {
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
  return parts.join("\n");
}

/** Trọn gói context một feature (dùng cho MCP get_feature). */
export function getFeatureBundle(id: string): {
  meta: FeatureMeta;
  business: string | null;
  design: string | null;
  apiSpec: string | null;
  feTasks: string | null;
  changelog: string | null;
} {
  const meta = readFeatureMeta(id);
  const f = featureFiles(id);
  return {
    meta,
    business: readDoc(f.business),
    design: readDoc(f.design),
    apiSpec: readDoc(f.apiSpec),
    feTasks: readDoc(f.feTasks),
    changelog: readDoc(f.changelog),
  };
}
