import { readFeatureMeta } from "./features.js";
import { buildNotifyBody, type NotifyResult } from "./notify-common.js";

/**
 * PUSH tuỳ chọn: thêm note vào issue Redmine đã map trong feature.yaml khi API đổi.
 *
 * Redmine thường **self-host**, nên base URL không cố định: lấy từ env `REDMINE_URL`
 * (vd https://redmine.cong-ty.vn). Auth qua API key cá nhân (`REDMINE_API_KEY`),
 * gửi bằng header `X-Redmine-API-Key`.
 *
 * Thiếu env, feature không có ticket Redmine, hoặc issue không tồn tại → skip (không lỗi).
 * Dùng global fetch (Node >= 18).
 */

/** Bỏ dấu "#" và khoảng trắng quanh id Redmine. "#123" / " 123 " -> "123". */
function parseIssueId(id: string): string | null {
  const m = id.trim().match(/^#?(\d+)$/);
  return m ? m[1] : null;
}

/** Bỏ "/" cuối base URL để ghép path sạch. */
function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Thêm note vào 1 issue Redmine. Trả false nếu HTTP không thành công. */
async function addIssueNote(
  baseUrl: string,
  issueId: string,
  notes: string,
  apiKey: string,
): Promise<boolean> {
  const res = await fetch(`${baseUrl}/issues/${issueId}.json`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Redmine-API-Key": apiKey,
    },
    body: JSON.stringify({ issue: { notes } }),
  });
  // Redmine trả 204 No Content khi cập nhật thành công.
  return res.ok;
}

/** Thêm note "API đã cập nhật" vào issue Redmine của 1 feature. */
export async function notifyRedmine(id: string, opts: { note?: string } = {}): Promise<NotifyResult> {
  const baseUrl = process.env.REDMINE_URL;
  const apiKey = process.env.REDMINE_API_KEY;
  if (!baseUrl) return { status: "skipped", system: "redmine", reason: "thiếu REDMINE_URL" };
  if (!apiKey) return { status: "skipped", system: "redmine", reason: "thiếu REDMINE_API_KEY" };

  const meta = readFeatureMeta(id);
  const ticket = meta.tickets?.find((t) => t.system === "redmine" && t.id);
  if (!ticket) return { status: "skipped", system: "redmine", reason: "feature không có ticket Redmine" };

  const issueId = parseIssueId(ticket.id);
  if (!issueId) {
    return { status: "skipped", system: "redmine", reason: `id Redmine không hợp lệ: ${ticket.id}` };
  }

  const ok = await addIssueNote(normalizeBaseUrl(baseUrl), issueId, buildNotifyBody(meta, opts.note), apiKey);
  return ok
    ? { status: "sent", system: "redmine", ticket: ticket.id }
    : { status: "skipped", system: "redmine", reason: `cập nhật issue Redmine #${issueId} thất bại` };
}
