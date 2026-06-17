import fs from "node:fs";
import path from "node:path";
import { defaultStatePath } from "./paths.js";
import { listFeatures, readFeatureMeta, type ChangeEntry, type Role } from "./features.js";

/**
 * PULL model theo ROLE: mỗi consumer (vd fe-web, be-api) có 1 role (fe|be) và tự nhớ đã pull tới
 * REVISION (= feature.version) mấy cho từng feature. "pending" = có change `rev > acked` mà
 * `role ∈ change.impact`.
 *
 * State lưu ở file riêng của consumer (không nằm trong kit chung):
 *   --state <path>  >  env DOC_KIT_STATE  >  <contentRoot>/.doc-kit-state.local.json
 * Role:  --role <fe|be>  >  env DOC_KIT_ROLE  >  mặc định "fe".
 */

export interface ConsumerState {
  consumer?: string;
  /** Đã pull tới revision mấy, tách theo role: acked[role][featureId] = rev. */
  acked: Partial<Record<Role, Record<string, number>>>;
}

export function statePath(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  if (process.env.DOC_KIT_STATE) return path.resolve(process.env.DOC_KIT_STATE);
  return defaultStatePath();
}

export function resolveRole(explicit?: string): Role {
  const v = (explicit ?? process.env.DOC_KIT_ROLE ?? "fe").toLowerCase();
  return v === "be" ? "be" : "fe";
}

export function readState(explicit?: string): ConsumerState {
  const p = statePath(explicit);
  if (!fs.existsSync(p)) return { acked: {} };
  try {
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    return { consumer: s.consumer, acked: s.acked ?? {} };
  } catch {
    return { acked: {} };
  }
}

export function writeState(state: ConsumerState, explicit?: string): void {
  fs.writeFileSync(statePath(explicit), JSON.stringify(state, null, 2), "utf8");
}

export interface PendingItem {
  id: string;
  title: string;
  role: Role;
  ackedRev: number;
  currentRev: number;
  /** Các change kể từ bản đã ack mà có ảnh hưởng tới role này. */
  changes: ChangeEntry[];
}

/** Feature có change mới hơn revision đã ack VÀ ảnh hưởng tới role. */
export function pendingChanges(role?: string, explicit?: string): PendingItem[] {
  const r = resolveRole(role);
  const state = readState(explicit);
  const ackedMap = state.acked[r] ?? {};
  const out: PendingItem[] = [];
  for (const m of listFeatures()) {
    const currentRev = m.version ?? 0;
    const acked = ackedMap[m.id] ?? 0;
    const relevant = (m.changes ?? []).filter((c) => c.rev > acked && (c.impact ?? []).includes(r));
    if (relevant.length === 0) continue;
    out.push({
      id: m.id,
      title: m.title,
      role: r,
      ackedRev: acked,
      currentRev,
      changes: relevant,
    });
  }
  return out;
}

/** Consumer (theo role) xác nhận đã pull feature tới revision hiện tại. */
export function ackPull(id: string, role?: string, explicit?: string): { id: string; role: Role; rev: number } {
  const meta = readFeatureMeta(id); // throw nếu không có
  const r = resolveRole(role);
  const rev = meta.version ?? 0;
  const state = readState(explicit);
  if (!state.consumer && process.env.DOC_KIT_CONSUMER) state.consumer = process.env.DOC_KIT_CONSUMER;
  state.acked[r] = { ...(state.acked[r] ?? {}), [id]: rev };
  writeState(state, explicit);
  return { id, role: r, rev };
}
