import { readFeatureMeta } from "./features.js";
import type { NotifyResult } from "./notify-common.js";
import { notifyLinear } from "./notify-linear.js";
import { notifyRedmine } from "./notify-redmine.js";

/** Map system → notifier. Thêm hệ thống ticket mới ở đây. */
const NOTIFIERS: Record<string, (id: string, opts: { note?: string }) => Promise<NotifyResult>> = {
  linear: notifyLinear,
  redmine: notifyRedmine,
};

/**
 * Notify mọi ticket system mà feature có gắn (Linear, Redmine…). Mỗi system tự
 * skip nếu thiếu env/ticket. Trả mảng kết quả (rỗng nếu feature chưa gắn ticket nào
 * mà ta hỗ trợ notify).
 */
export async function notifyFeature(id: string, opts: { note?: string } = {}): Promise<NotifyResult[]> {
  const meta = readFeatureMeta(id);
  const systems = new Set(
    (meta.tickets ?? [])
      .filter((t) => t.id)
      .map((t) => t.system)
      .filter((s) => s in NOTIFIERS),
  );
  return Promise.all([...systems].map((s) => NOTIFIERS[s](id, opts)));
}
