import { featureFiles } from "./paths.js";
import { readFeatureMeta, writeFeatureMeta, type FeatureMeta, type Role } from "./features.js";
import { today, prependChangelogEntry, appendChange } from "./changelog.js";

export type MaintenanceType = "bugfix" | "improvement" | "chore";

const TYPE_LABEL: Record<MaintenanceType, string> = {
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
  type: MaintenanceType;
  note: string;
  /** Ticket bảo trì gắn vào feature.yaml.tickets[] (để find_feature tìm được). */
  ticket?: TicketRef;
  /** Vai cần hành động sau thay đổi (fe và/hoặc be). Mặc định cả hai (an toàn). */
  impact?: Role[];
  /** Mục spec bị đụng, vd ["01-business-spec.md#br-3"] — giúp scope plan. */
  docs?: string[];
}

export interface LogChangeResult {
  featureId: string;
  version: number;
  type: MaintenanceType;
  impact: Role[];
  changelogPath: string;
}

/** Thêm/cập nhật ticket trong tickets[] (dedupe theo system+id). */
function upsertTicket(meta: FeatureMeta, ticket: TicketRef, type: MaintenanceType): void {
  const system = ticket.system ?? "none";
  const tickets = meta.tickets ?? [];
  const existing = tickets.find(
    (t) => t.system === system && t.id.toLowerCase() === ticket.id.toLowerCase(),
  );
  if (existing) {
    existing.type = type;
    if (ticket.url) existing.url = ticket.url;
  } else {
    tickets.push({ system, id: ticket.id, url: ticket.url ?? "", type });
  }
  meta.tickets = tickets;
}

/**
 * Ghi nhận một thay đổi bảo trì (bug fix / cải tiến / chore) lên feature đã tồn tại:
 *  - bump feature.version (= revision; KHÔNG đổi status, KHÔNG đụng api.version)
 *  - append change có cấu trúc vào changes[] (rev + impact) → pending/plan suy từ đây
 *  - gắn ticket vào tickets[] (có type) để find_feature/plan_for_ticket tìm được
 *  - ghi entry CHANGELOG.md (bản người-đọc)
 *
 * Dành cho thay đổi nghiệp vụ/design/chore. Nếu thay đổi đụng API → dùng pushApi.
 */
export function logChange(featureId: string, opts: LogChangeOptions): LogChangeResult {
  const meta = readFeatureMeta(featureId); // throw nếu feature không tồn tại
  const f = featureFiles(featureId);
  const date = today();
  const impact: Role[] = opts.impact && opts.impact.length ? opts.impact : ["fe", "be"];

  meta.version = (meta.version ?? 1) + 1;
  meta.updated_at = date;
  // Giữ nguyên status: feature đã done vẫn done, chỉ bump version + ghi nhận thay đổi.

  if (opts.ticket) upsertTicket(meta, opts.ticket, opts.type);

  appendChange(meta, {
    rev: meta.version,
    date,
    type: opts.type,
    note: opts.note,
    tickets: opts.ticket ? [opts.ticket.id] : undefined,
    impact,
    docs: opts.docs && opts.docs.length ? opts.docs : undefined,
  });

  writeFeatureMeta(featureId, meta);

  const entry = [
    `## v${meta.version} — ${date} — ${opts.type}`,
    `- ${TYPE_LABEL[opts.type]}: ${opts.note}`,
    opts.ticket ? `- Ticket: ${opts.ticket.id}` : null,
    `- Impact: ${impact.join(", ")}`,
    opts.docs && opts.docs.length ? `- Docs: ${opts.docs.join(", ")}` : null,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  prependChangelogEntry(f.changelog, entry, meta.title);

  return { featureId, version: meta.version, type: opts.type, impact, changelogPath: f.changelog };
}
