import fs from "node:fs";
import path from "node:path";
import { featureFiles } from "./paths.js";
import { readFeatureMeta } from "./features.js";
import { isNotionUrl, parsePageId, fetchNotionMarkdown } from "./notion.js";
import { extractFigmaLinks, addFigmaLinks } from "./figma.js";

/**
 * Ingest "thứ gì đó" vào 00-raw/ của 1 feature, định tuyến theo loại:
 *  - file local      -> copy vào 00-raw/
 *  - link Notion      -> fetch nội dung -> lưu markdown + trích Figma link vào feature.yaml
 *  - link Figma       -> thêm vào feature.yaml.figma[]
 *  - link http khác   -> lưu file pointer
 */

export type RawKind = "file" | "notion" | "figma" | "link";

export interface AddRawItemResult {
  source: string;
  kind: RawKind;
  saved?: string; // đường dẫn tương đối trong 00-raw
  figmaAdded?: number;
  note?: string;
}

function isHttp(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function isFigmaUrl(s: string): boolean {
  return /^https?:\/\/(?:www\.)?figma\.com\//i.test(s);
}

function uniqueDest(dir: string, filename: string): string {
  let dest = path.join(dir, filename);
  if (!fs.existsSync(dest)) return dest;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let i = 1;
  do {
    dest = path.join(dir, `${base}-${i}${ext}`);
    i++;
  } while (fs.existsSync(dest));
  return dest;
}

export async function addRaw(
  featureId: string,
  sources: string[],
  opts: { withFigma?: boolean } = {},
): Promise<AddRawItemResult[]> {
  readFeatureMeta(featureId); // throw nếu feature không tồn tại
  const f = featureFiles(featureId);
  fs.mkdirSync(f.raw, { recursive: true });
  const withFigma = opts.withFigma !== false;
  const results: AddRawItemResult[] = [];

  for (const src of sources) {
    // 1) File local
    if (!isHttp(src) && fs.existsSync(src) && fs.statSync(src).isFile()) {
      const dest = uniqueDest(f.raw, path.basename(src));
      fs.copyFileSync(src, dest);
      results.push({ source: src, kind: "file", saved: path.basename(dest) });
      continue;
    }

    // 2) Link Figma -> đăng ký vào feature.yaml
    if (isFigmaUrl(src)) {
      const { added } = addFigmaLinks(featureId, [{ url: src }]);
      results.push({ source: src, kind: "figma", figmaAdded: added });
      continue;
    }

    // 3) Link Notion -> fetch -> lưu markdown + trích Figma
    if (isNotionUrl(src)) {
      const pageId = parsePageId(src);
      if (!pageId) {
        results.push({ source: src, kind: "notion", note: "không lấy được page id từ URL" });
        continue;
      }
      const { title, markdown, links } = await fetchNotionMarkdown(pageId);
      const dest = uniqueDest(f.raw, `notion-${pageId.slice(0, 8)}.md`);
      fs.writeFileSync(dest, markdown, "utf8");

      let figmaAdded = 0;
      if (withFigma) {
        const figmaUrls = [...new Set([...extractFigmaLinks(markdown), ...links.filter(isFigmaUrl)])];
        if (figmaUrls.length) {
          figmaAdded = addFigmaLinks(
            featureId,
            figmaUrls.map((url) => ({ url, name: title })),
          ).added;
        }
      }
      results.push({ source: src, kind: "notion", saved: path.basename(dest), figmaAdded });
      continue;
    }

    // 4) Link http khác -> lưu pointer
    if (isHttp(src)) {
      const dest = uniqueDest(f.raw, `link-${Date.now()}.md`);
      fs.writeFileSync(dest, `# Link nguồn\n\n${src}\n`, "utf8");
      results.push({ source: src, kind: "link", saved: path.basename(dest) });
      continue;
    }

    results.push({ source: src, kind: "file", note: "không tìm thấy file / không nhận dạng được URL" });
  }

  return results;
}
