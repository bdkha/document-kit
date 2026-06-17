import { readFeatureMeta } from "./features.js";
import { buildNotifyBody, type NotifyResult } from "./notify-common.js";

/**
 * PUSH tuỳ chọn: comment vào ticket Linear đã map trong feature.yaml khi API đổi.
 * Cần env LINEAR_API_KEY. Nếu thiếu key hoặc feature không có ticket Linear → skip (không lỗi).
 *
 * Chạy được ở CI (sau push-api) hoặc gọi tay. Dùng global fetch (Node >= 18).
 */

const LINEAR_API = "https://api.linear.app/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>, apiKey: string): Promise<T> {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`Linear API: ${json.errors.map((e) => e.message).join("; ")}`);
  if (!json.data) throw new Error("Linear API: phản hồi rỗng.");
  return json.data;
}

/** Tách "ENG-123" -> { teamKey: "ENG", number: 123 }. */
function parseIdentifier(id: string): { teamKey: string; number: number } | null {
  const m = id.match(/^([A-Za-z]+)-(\d+)$/);
  return m ? { teamKey: m[1].toUpperCase(), number: parseInt(m[2], 10) } : null;
}

async function resolveIssueId(identifier: string, apiKey: string): Promise<string | null> {
  const parsed = parseIdentifier(identifier);
  if (!parsed) return null;
  const data = await gql<{ issues: { nodes: { id: string }[] } }>(
    `query($key:String!,$num:Float!){ issues(filter:{ team:{ key:{ eq:$key } }, number:{ eq:$num } }){ nodes{ id } } }`,
    { key: parsed.teamKey, num: parsed.number },
    apiKey,
  );
  return data.issues.nodes[0]?.id ?? null;
}

async function createComment(issueId: string, body: string, apiKey: string): Promise<boolean> {
  const data = await gql<{ commentCreate: { success: boolean } }>(
    `mutation($issueId:String!,$body:String!){ commentCreate(input:{ issueId:$issueId, body:$body }){ success } }`,
    { issueId, body },
    apiKey,
  );
  return data.commentCreate.success;
}

/** Comment "API đã cập nhật" vào ticket Linear của 1 feature. */
export async function notifyLinear(id: string, opts: { note?: string } = {}): Promise<NotifyResult> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) return { status: "skipped", system: "linear", reason: "thiếu LINEAR_API_KEY" };

  const meta = readFeatureMeta(id);
  const ticket = meta.tickets?.find((t) => t.system === "linear" && t.id);
  if (!ticket) return { status: "skipped", system: "linear", reason: "feature không có ticket Linear" };

  const issueId = await resolveIssueId(ticket.id, apiKey);
  if (!issueId) {
    return { status: "skipped", system: "linear", reason: `không tìm thấy issue Linear ${ticket.id}` };
  }

  const ok = await createComment(issueId, buildNotifyBody(meta, opts.note), apiKey);
  return ok
    ? { status: "sent", system: "linear", ticket: ticket.id }
    : { status: "skipped", system: "linear", reason: "commentCreate thất bại" };
}
