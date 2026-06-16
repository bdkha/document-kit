/**
 * Đọc một trang Notion qua HTTP API và chuyển sang markdown (subset đủ dùng cho docs thô).
 * Cần env NOTION_API_KEY (integration token). Thu thập cả link inline/embed để trích Figma.
 *
 * Lưu ý: trang Notion phải được share cho integration tương ứng với token.
 */

interface AnyObj {
  [k: string]: any;
}

const API = "https://api.notion.com/v1";

function headers(): Record<string, string> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("Thiếu NOTION_API_KEY (đặt trong .env). Không đọc được Notion.");
  return {
    Authorization: `Bearer ${key}`,
    "Notion-Version": process.env.NOTION_VERSION ?? "2022-06-28",
    "Content-Type": "application/json",
  };
}

export function isNotionUrl(s: string): boolean {
  try {
    const h = new URL(s).hostname;
    return h.endsWith("notion.so") || h.endsWith("notion.site") || h === "notion.so";
  } catch {
    return false;
  }
}

/** Lấy id 32-hex từ URL Notion (bỏ dấu gạch). */
export function parsePageId(url: string): string | null {
  const deDashed = url.replace(/-/g, "");
  const m = deDashed.match(/[0-9a-f]{32}/i);
  return m ? m[0] : null;
}

async function notionGet(path: string): Promise<AnyObj> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  const json = (await res.json()) as AnyObj;
  if (!res.ok) {
    throw new Error(`Notion API ${res.status}: ${json.message ?? "lỗi không rõ"}`);
  }
  return json;
}

function richToMd(rich: AnyObj[] | undefined, links: Set<string>): string {
  if (!rich || rich.length === 0) return "";
  return rich
    .map((r) => {
      let t = r.plain_text ?? "";
      const ann = r.annotations ?? {};
      if (ann.code) t = `\`${t}\``;
      if (ann.bold) t = `**${t}**`;
      if (ann.italic) t = `*${t}*`;
      const href = r.href ?? r.text?.link?.url;
      if (href) {
        links.add(href);
        t = `[${t}](${href})`;
      }
      return t;
    })
    .join("");
}

async function listChildren(blockId: string): Promise<AnyObj[]> {
  const out: AnyObj[] = [];
  let cursor: string | undefined;
  do {
    const q = cursor ? `?start_cursor=${cursor}&page_size=100` : `?page_size=100`;
    const page = await notionGet(`/blocks/${blockId}/children${q}`);
    out.push(...(page.results ?? []));
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function renderBlocks(blocks: AnyObj[], links: Set<string>, depth = 0): Promise<string[]> {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  for (const b of blocks) {
    const type: string = b.type;
    const data: AnyObj = b[type] ?? {};
    const rt = (key = "rich_text") => richToMd(data[key], links);

    switch (type) {
      case "paragraph":
        lines.push(indent + rt());
        break;
      case "heading_1":
        lines.push(`# ${rt()}`);
        break;
      case "heading_2":
        lines.push(`## ${rt()}`);
        break;
      case "heading_3":
        lines.push(`### ${rt()}`);
        break;
      case "bulleted_list_item":
        lines.push(`${indent}- ${rt()}`);
        break;
      case "numbered_list_item":
        lines.push(`${indent}1. ${rt()}`);
        break;
      case "to_do":
        lines.push(`${indent}- [${data.checked ? "x" : " "}] ${rt()}`);
        break;
      case "quote":
        lines.push(`> ${rt()}`);
        break;
      case "callout":
        lines.push(`> ${data.icon?.emoji ?? "ℹ️"} ${rt()}`);
        break;
      case "toggle":
        lines.push(`${indent}- ${rt()}`);
        break;
      case "code":
        lines.push("```" + (data.language ?? ""), rt(), "```");
        break;
      case "divider":
        lines.push("---");
        break;
      case "child_page":
        lines.push(`${indent}- 📄 ${data.title ?? "(child page)"}`);
        break;
      case "bookmark":
      case "embed":
      case "link_preview": {
        const url = data.url;
        if (url) {
          links.add(url);
          lines.push(`${indent}- ${url}`);
        }
        break;
      }
      case "image":
      case "file":
      case "pdf":
      case "video": {
        const url = data.external?.url ?? data.file?.url;
        if (url) {
          links.add(url);
          lines.push(`${indent}- (${type}) ${url}`);
        }
        break;
      }
      default:
        if (data.rich_text) lines.push(indent + rt());
        break;
    }

    if (b.has_children) {
      const children = await listChildren(b.id);
      const childLines = await renderBlocks(children, links, depth + 1);
      lines.push(...childLines);
    }
  }
  return lines;
}

function extractTitle(page: AnyObj): string {
  const props: AnyObj = page.properties ?? {};
  for (const v of Object.values<AnyObj>(props)) {
    if (v?.type === "title") {
      const txt = (v.title ?? []).map((t: AnyObj) => t.plain_text).join("");
      if (txt) return txt;
    }
  }
  return "Notion page";
}

export interface NotionResult {
  title: string;
  markdown: string;
  links: string[];
}

/** Đọc trang Notion -> markdown + danh sách link tìm thấy. */
export async function fetchNotionMarkdown(pageId: string): Promise<NotionResult> {
  const links = new Set<string>();
  const page = await notionGet(`/pages/${pageId}`);
  const title = extractTitle(page);
  const blocks = await listChildren(pageId);
  const body = await renderBlocks(blocks, links);
  const markdown = [`# ${title}`, "", `> Nguồn: Notion page \`${pageId}\``, "", ...body, ""].join("\n");
  return { title, markdown, links: [...links] };
}
