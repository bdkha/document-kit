import { findFeatures, getFeatureBundle, type ChangeEntry, type FeatureMeta, type Role } from "./features.js";
import { resolveRole } from "./consumer.js";

export interface TicketPlan {
  ticket: string;
  role: Role;
  feature: { id: string; title: string; status: string };
  /** Các change của đúng ticket này (rỗng = ticket feature mới, chưa có change cụ thể). */
  matchedChanges: ChangeEntry[];
  /** Mục spec bị đụng (union change.docs) — gợi ý scope plan. */
  docsTouched: string[];
  /** true nếu ticket là ticket feature (làm mới toàn bộ), không phải bảo trì. */
  isNewFeature: boolean;
  bundle: ReturnType<typeof getFeatureBundle>;
}

function matchTicket(meta: FeatureMeta, ticket: string): ChangeEntry[] {
  const t = ticket.toLowerCase();
  return (meta.changes ?? []).filter((c) => (c.tickets ?? []).some((x) => x.toLowerCase() === t));
}

/**
 * Tra theo TICKET → trả gói plan đã scope cho 1 role:
 *  - tìm feature chứa ticket,
 *  - lọc đúng các change của ticket (delta cần làm),
 *  - kèm context spec liên quan (reuse getFeatureBundle) để planner dựng plan.
 * Hoạt động cho cả task bảo trì (có change khớp) lẫn task feature mới (ticket type=feature).
 */
export function planForTicket(ticket: string, role?: string): TicketPlan[] {
  const r = resolveRole(role);
  const features = findFeatures({ ticket });
  return features.map((meta) => {
    const matchedChanges = matchTicket(meta, ticket);
    const docsTouched = [...new Set(matchedChanges.flatMap((c) => c.docs ?? []))];
    const isNewFeature =
      matchedChanges.length === 0 &&
      (meta.tickets ?? []).some(
        (t) => t.id.toLowerCase() === ticket.toLowerCase() && (t.type ?? "feature") === "feature",
      );
    return {
      ticket,
      role: r,
      feature: { id: meta.id, title: meta.title, status: meta.status },
      matchedChanges,
      docsTouched,
      isNewFeature,
      bundle: getFeatureBundle(meta.id),
    };
  });
}

/** Render gói plan thành markdown để planner (skill) nạp trực tiếp. */
export function renderTicketPlan(plans: TicketPlan[]): string {
  if (plans.length === 0) return "Không tìm thấy feature nào gắn ticket này.";
  const parts: string[] = [];
  for (const p of plans) {
    parts.push(`# Plan context cho ticket ${p.ticket} (role: ${p.role})`);
    parts.push(`Feature: ${p.feature.id} — ${p.feature.title} [${p.feature.status}]`);

    if (p.isNewFeature) {
      parts.push(`\n> Ticket FEATURE mới: lập plan từ TOÀN BỘ context bên dưới (AC + api-spec + design).`);
    } else if (p.matchedChanges.length) {
      parts.push(`\n## Δ Cần làm (đúng thay đổi của ticket — chỉ plan phần này)`);
      for (const c of p.matchedChanges) {
        parts.push(
          `- rev ${c.rev} [${c.type}] — ${c.note}  (impact: ${(c.impact ?? []).join("+")})` +
            (c.docs?.length ? `\n  docs: ${c.docs.join(", ")}` : ""),
        );
      }
      if (p.docsTouched.length) parts.push(`\nMục spec bị đụng: ${p.docsTouched.join(", ")}`);
    } else {
      parts.push(`\n> Không có change khớp ticket trong changes[]; dùng context đầy đủ bên dưới.`);
    }

    const b = p.bundle;
    parts.push("\n---\n## BUSINESS SPEC\n", b.business ?? "_(chưa có)_");
    parts.push("\n---\n## API SPEC\n", b.apiSpec ?? "_(BE chưa đẩy OpenAPI)_");
    if (p.role === "fe") parts.push("\n---\n## DESIGN SPEC\n", b.design ?? "_(chưa có)_");
    parts.push("\n---\n## CHANGELOG\n", b.changelog ?? "_(trống)_");
    parts.push("\n===\n");
  }
  parts.push(
    "Hướng dẫn lập plan: map mỗi task ↔ AC (business-spec) ↔ endpoint (api-spec)" +
      (plans[0].role === "fe" ? " ↔ screen/state (design-spec)" : "") +
      ". Với task bảo trì, chỉ scope theo phần Δ ở trên.",
  );
  return parts.join("\n");
}
