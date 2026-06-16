import { readFeatureMeta, writeFeatureMeta, type FeatureMeta } from "./features.js";

/**
 * Tiện ích Figma: parse node-id từ URL, trích link Figma trong text, append vào feature.yaml.
 */

export interface FigmaLink {
  name?: string;
  url: string;
  nodeId?: string;
}

/** Lấy node-id từ URL Figma (?node-id=1-23) và chuẩn hoá "1-23" -> "1:23". */
export function parseFigmaNodeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    const raw = u.searchParams.get("node-id");
    if (!raw) return undefined;
    return raw.replace(/-/g, ":");
  } catch {
    return undefined;
  }
}

const FIGMA_URL_RE = /https?:\/\/(?:www\.)?figma\.com\/(?:file|design|proto|board)\/[^\s)\]]+/gi;

/** Trích tất cả URL Figma xuất hiện trong text (markdown). */
export function extractFigmaLinks(text: string): string[] {
  const found = text.match(FIGMA_URL_RE) ?? [];
  // Bỏ dấu câu/markdown đuôi và trùng lặp
  const cleaned = found.map((u) => u.replace(/[).,]+$/, ""));
  return [...new Set(cleaned)];
}

function sameFigmaTarget(a: FigmaLink, b: FigmaLink): boolean {
  return a.url === b.url && (a.nodeId ?? "") === (b.nodeId ?? "");
}

/**
 * Append (các) link Figma vào feature.yaml.figma[], dedupe theo url+nodeId.
 * Trả về số link thực sự được thêm mới.
 */
export function addFigmaLinks(featureId: string, links: FigmaLink[]): { added: number; total: number } {
  const meta: FeatureMeta = readFeatureMeta(featureId);
  const existing = (meta.figma ?? []).filter((f) => f && f.url);
  let added = 0;

  for (const raw of links) {
    if (!raw.url) continue;
    const link: FigmaLink = {
      url: raw.url,
      nodeId: raw.nodeId ?? parseFigmaNodeId(raw.url),
      ...(raw.name ? { name: raw.name } : {}),
    };
    if (existing.some((e) => sameFigmaTarget(e, link))) continue;
    existing.push(link);
    added++;
  }

  meta.figma = existing;
  meta.updated_at = new Date().toISOString().slice(0, 10);
  writeFeatureMeta(featureId, meta);
  return { added, total: existing.length };
}
