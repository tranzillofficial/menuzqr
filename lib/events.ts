import type { MemberRole } from "./constants";
import type { Translator } from "./i18n";

/**
 * A live event, as it travels from the server to every open screen.
 *
 * Deliberately language-neutral: the payload carries facts (table label, order
 * number) and each client renders them through its own dictionary, so an Arabic
 * dashboard and an English kitchen tablet both read correctly from one event.
 */
export const LIVE_EVENT_KINDS = [
  "order.new",
  "order.ready",
  "order.status",
  "waiter.call",
  "waiter.pickup",
] as const;

export type LiveEventKind = (typeof LIVE_EVENT_KINDS)[number];

export type LiveEvent = {
  /** Stable id, so the same event arriving twice (postgres_changes *and*
   *  broadcast) is only ever shown once. */
  id: string;
  kind: LiveEventKind;
  restaurantId: string;
  at: string;
  orderId?: string | null;
  orderNumber?: number | null;
  tableLabel?: string | null;
  total?: number | null;
  currency?: string | null;
  note?: string | null;
};

/** Who should be alerted (sound + notification) for each kind of event. */
export const EVENT_AUDIENCE: Record<LiveEventKind, MemberRole[]> = {
  "order.new": ["owner", "manager", "chef", "staff"],
  "order.ready": ["owner", "manager", "waiter", "staff"],
  "order.status": [],
  "waiter.call": ["owner", "manager", "waiter", "staff"],
  "waiter.pickup": ["owner", "manager", "waiter", "staff"],
};

export function shouldAlert(kind: LiveEventKind, role: MemberRole): boolean {
  return EVENT_AUDIENCE[kind]?.includes(role) ?? false;
}

/** Where clicking the notification should take each role. */
export function eventLink(kind: LiveEventKind, role: MemberRole): string {
  void kind;
  return role === "owner" || role === "manager" ? "/dashboard/orders" : "/station";
}

export const BROADCAST_EVENT = "menuzqr";

export function restaurantTopic(restaurantId: string): string {
  return `restaurant:${restaurantId}`;
}

// ------------------------------------------------------------------ copy

/** One place where an event becomes readable text, for toasts, the bell menu
 *  and the push notification body alike. */
export function describeEvent(
  event: LiveEvent,
  t: Translator
): { title: string; body: string; emoji: string } {
  const number = event.orderNumber ?? 0;
  const table = event.tableLabel ?? t("live.someTable");

  switch (event.kind) {
    case "order.new":
      return {
        emoji: "🧾",
        title: t("live.orderNew", { number }),
        body: t("live.orderNewBody", { table }),
      };
    case "order.ready":
      return {
        emoji: "✅",
        title: t("live.orderReady", { number }),
        body: t("live.orderReadyBody", { table }),
      };
    case "waiter.call":
      return {
        emoji: "🔔",
        title: t("live.waiterCall", { table }),
        body: t("live.waiterCallBody"),
      };
    case "waiter.pickup":
      return {
        emoji: "🛎️",
        title: t("live.pickup", { number }),
        body: t("live.pickupBody", { table }),
      };
    default:
      return {
        emoji: "•",
        title: t("live.updated"),
        body: t("live.updatedBody"),
      };
  }
}
