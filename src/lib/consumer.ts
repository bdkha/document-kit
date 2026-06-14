import fs from "node:fs";
import path from "node:path";
import { kitRoot } from "./paths.js";
import { listFeatures, readFeatureMeta, writeFeatureMeta } from "./features.js";
import { featureFiles } from "./paths.js";

/**
 * PULL model: mỗi consumer (vd fe-web, fe-mobile) tự nhớ đã pull tới api version mấy
 * cho từng feature. "pending" = api.version hiện tại > version đã ack.
 *
 * State lưu ở file riêng của consumer (không nằm trong kit chung):
 *   --state <path>  >  env DOC_KIT_STATE  >  <kitRoot>/.doc-kit-state.local.json
 */

export interface ConsumerState {
  consumer?: string;
  acked: Record<string, number>; // featureId -> api version đã pull
}

export function statePath(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  if (process.env.DOC_KIT_STATE) return path.resolve(process.env.DOC_KIT_STATE);
  return path.join(kitRoot(), ".doc-kit-state.local.json");
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

/** Lấy đoạn changelog mới nhất (tới mục "## " kế tiếp). */
function latestChangelog(id: string): string {
  const doc = featureFiles(id).changelog;
  if (!fs.existsSync(doc)) return "";
  const lines = fs.readFileSync(doc, "utf8").split("\n");
  const start = lines.findIndex((l) => /^## /.test(l));
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return [lines[start], ...(end < 0 ? rest : rest.slice(0, end))].join("\n").trim();
}

export interface PendingItem {
  id: string;
  title: string;
  ackedVersion: number;
  currentVersion: number;
  changelog: string;
}

/** Feature có api version mới hơn version consumer đã ack. */
export function pendingChanges(explicit?: string): PendingItem[] {
  const state = readState(explicit);
  const out: PendingItem[] = [];
  for (const m of listFeatures()) {
    const current = m.api?.version ?? 0;
    if (current < 1) continue;
    const acked = state.acked[m.id] ?? 0;
    if (current > acked) {
      out.push({
        id: m.id,
        title: m.title,
        ackedVersion: acked,
        currentVersion: current,
        changelog: latestChangelog(m.id),
      });
    }
  }
  return out;
}

/** Consumer xác nhận đã pull feature tới api version hiện tại. */
export function ackPull(id: string, explicit?: string): { id: string; version: number } {
  const meta = readFeatureMeta(id); // throw nếu không có
  const version = meta.api?.version ?? 0;
  const state = readState(explicit);
  state.acked[id] = version;
  writeState(state, explicit);

  // Best-effort: nếu KHÔNG còn consumer nào đang chờ thì tắt cờ broadcast.
  // (cờ là hint dùng chung; với nhiều consumer, ack của 1 consumer vẫn tắt hint.)
  if (meta.api?.needs_fe_repull) {
    meta.api.needs_fe_repull = false;
    writeFeatureMeta(id, meta);
  }
  return { id, version };
}
