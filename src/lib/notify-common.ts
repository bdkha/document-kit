import type { FeatureMeta } from "./features.js";

/** Kết quả notify cho 1 ticket/hệ thống. */
export interface NotifyResult {
  status: "sent" | "skipped";
  system: string;
  reason?: string;
  ticket?: string;
}

/**
 * Dựng nội dung comment "API đã cập nhật" dùng chung cho mọi ticket system.
 * Markdown cơ bản (Linear & Redmine cấu hình Markdown đều hiển thị được).
 */
export function buildNotifyBody(meta: FeatureMeta, note?: string): string {
  const apiV = meta.api?.version ?? 0;
  return [
    `🔄 **API docs cập nhật** cho feature \`${meta.id}\` — **${meta.title}**`,
    ``,
    `- API version: **v${apiV}**`,
    note ? `- Thay đổi: ${note}` : null,
    `- FE nên \`get_feature(${meta.id})\` lại rồi \`doc-kit ack ${meta.id}\`.`,
  ]
    .filter(Boolean)
    .join("\n");
}
