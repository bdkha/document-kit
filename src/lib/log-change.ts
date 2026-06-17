import { featureFiles } from "./paths.js";
import { readFeatureMeta, writeFeatureMeta, type FeatureMeta } from "./features.js";
import { today, prependChangelogEntry } from "./changelog.js";

export type ChangeType = "bugfix" | "improvement" | "chore";

const TYPE_LABEL: Record<ChangeType, string> = {
  bugfix: "Fix",
  improvement: "Cải tiến",
  chore: "Chore",
};

export interface TicketRef {
  system?: string;
  id: string;
  url?: string;
}

export interface LogChangeOptions {
  type: ChangeType;
  note: string;
  /** Ticket bảo trì gắn vào feature.yaml.tickets[] (để find_feature tìm được). */
  ticket?: TicketRef;
  /** Đổi hành vi/API user-facing → set needs_fe_repull + cảnh báo trong CHANGELOG. */
  repull?: boolean;
}

export interface LogChangeResult {
  featureId: string;
  version: number;
  type: ChangeType;
  changelogPath: string;
}

/** Thêm/cập nhật ticket trong tickets[] (dedupe theo system+id). */
function upsertTicket(meta: FeatureMeta, ticket: TicketRef, type: ChangeType): void {
  const ticketType = type === "bugfix" ? "bugfix" : type === "improvement" ? "improvement" : "chore";
  const system = ticket.system ?? "none";
  const tickets = meta.tickets ?? [];
  const existing = tickets.find(
    (t) => t.system === system && t.id.toLowerCase() === ticket.id.toLowerCase(),
  );
  if (existing) {
    existing.type = ticketType;
    if (ticket.url) existing.url = ticket.url;
  } else {
    tickets.push({ system, id: ticket.id, url: ticket.url ?? "", type: ticketType });
  }
  meta.tickets = tickets;
}

/**
 * Ghi nhận một thay đổi bảo trì (bug fix / cải tiến / chore) lên feature đã tồn tại:
 *  - bump feature.version (KHÔNG đổi status, KHÔNG đụng api.version)
 *  - optionally set api.needs_fe_repull khi thay đổi hành vi user-facing
 *  - gắn ticket vào tickets[] (có type) để find_feature tìm được
 *  - ghi entry CHANGELOG có phân loại
 *
 * Dành cho thay đổi nghiệp vụ/design/chore. Nếu thay đổi đụng API → dùng pushApi.
 */
export function logChange(featureId: string, opts: LogChangeOptions): LogChangeResult {
  const meta = readFeatureMeta(featureId); // throw nếu feature không tồn tại
  const f = featureFiles(featureId);
  const date = today();

  meta.version = (meta.version ?? 1) + 1;
  meta.updated_at = date;
  // Giữ nguyên status: feature đã done vẫn done, chỉ bump version + CHANGELOG.

  if (opts.repull) {
    meta.api = { ...(meta.api ?? {}), needs_fe_repull: true };
  }

  if (opts.ticket) upsertTicket(meta, opts.ticket, opts.type);

  writeFeatureMeta(featureId, meta);

  const entry = [
    `## v${meta.version} — ${date} — ${opts.type}`,
    `- ${TYPE_LABEL[opts.type]}: ${opts.note}`,
    opts.ticket ? `- Ticket: ${opts.ticket.id}` : null,
    `- ⚠️ FE cần re-pull: ${opts.repull ? "có (needs_fe_repull=true)" : "không"}`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  prependChangelogEntry(f.changelog, entry, meta.title);

  return { featureId, version: meta.version, type: opts.type, changelogPath: f.changelog };
}
