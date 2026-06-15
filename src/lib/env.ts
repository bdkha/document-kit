import path from "node:path";
import { config } from "dotenv";
import { contentRoot } from "./paths.js";

let loaded = false;

/**
 * Nạp .env từ content root của dự án (một lần). Gọi ở đầu CLI/MCP.
 * MCP được Claude Code truyền DOC_KIT_ROOT qua env → contentRoot đúng ngay cả khi
 * chạy từ thư mục khác. CLI chạy trong repo docs → dò ngược tìm root.
 */
export function loadDocKitEnv(): void {
  if (loaded) return;
  loaded = true;
  config({ path: path.join(contentRoot(), ".env") });
}
