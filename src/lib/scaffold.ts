import fs from "node:fs";
import path from "node:path";
import { featureDir, featureFiles, templatesDir, scaffoldDir } from "./paths.js";
import { listFeatureIds } from "./features.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu tiếng Việt
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Số thứ tự feature tiếp theo, định dạng 3 chữ số. */
function nextFeatureNumber(prefix: string): string {
  const re = new RegExp(`^${prefix}-(\\d+)-`);
  const max = listFeatureIds().reduce((acc, id) => {
    const m = id.match(re);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return String(max + 1).padStart(3, "0");
}

function fillTemplate(content: string, vars: { id: string; title: string; date: string }): string {
  return content
    .replace(/F-000-slug/g, vars.id)
    .replace(/\{Tên feature\}/g, vars.title)
    .replace(/^title: Tên feature$/m, `title: ${vars.title}`)
    .replace(/"1970-01-01"/g, `"${vars.date}"`);
}

function copyTemplate(templateName: string, dest: string, vars: { id: string; title: string; date: string }): void {
  const src = path.join(templatesDir(), templateName);
  const raw = fs.readFileSync(src, "utf8");
  fs.writeFileSync(dest, fillTemplate(raw, vars), "utf8");
}

export interface NewFeatureResult {
  id: string;
  dir: string;
}

export interface InitResult {
  dir: string;
  files: string[];
}

/**
 * Khởi tạo workspace docs cho 1 dự án: copy scaffold/ vào target.
 * `_gitignore` (đặt vậy vì npm strip .gitignore) được đổi tên thành `.gitignore`.
 */
export function initWorkspace(targetDir?: string): InitResult {
  const dest = targetDir ? path.resolve(targetDir) : process.cwd();
  if (fs.existsSync(path.join(dest, ".doc-kit", "config.yaml"))) {
    throw new Error(`Đã là workspace docs rồi (có .doc-kit/config.yaml): ${dest}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(scaffoldDir(), dest, { recursive: true });

  const gi = path.join(dest, "_gitignore");
  if (fs.existsSync(gi)) fs.renameSync(gi, path.join(dest, ".gitignore"));

  return { dir: dest, files: fs.readdirSync(dest).sort() };
}

/** Tạo feature mới từ templates. Trả về id + đường dẫn. */
export function createFeature(title: string, opts: { prefix?: string } = {}): NewFeatureResult {
  const prefix = opts.prefix ?? "F";
  const num = nextFeatureNumber(prefix);
  const id = `${prefix}-${num}-${slugify(title)}`;
  const dir = featureDir(id);
  if (fs.existsSync(dir)) throw new Error(`Feature đã tồn tại: ${id}`);

  const f = featureFiles(id);
  const date = today();
  const vars = { id, title, date };

  fs.mkdirSync(f.raw, { recursive: true });
  fs.mkdirSync(f.apiDir, { recursive: true });

  copyTemplate("feature.yaml", f.yaml, vars);
  copyTemplate("01-business-spec.md", f.business, vars);
  copyTemplate("02-design-spec.md", f.design, vars);
  copyTemplate("04-fe-tasks.md", f.feTasks, vars);
  copyTemplate("CHANGELOG.md", f.changelog, vars);
  copyTemplate(path.join("00-raw", "README.md"), path.join(f.raw, "README.md"), vars);

  return { id, dir };
}
