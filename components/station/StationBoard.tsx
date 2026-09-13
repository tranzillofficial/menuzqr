"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icons";
import { useT } from "@/components/i18n/I18nProvider";
import {
  callWaiterForOrderAction,
  resolveWaiterRequestAction,
  updateOrderStatusAction,
} from "@/lib/actions/orders";
import { cn, formatMoney, relativeTime } from "@/lib/utils";
import type { MemberRole } from "@/lib/constants";
import type { OrderWithDetails, WaiterRequest } from "@/lib/types";

type Tab = "kitchen" | "service";

export function StationBoard({
  role,
  orders,
  calls,
  currency,
}: {
  role: MemberRole;
  orders: OrderWithDetails[];
  calls: WaiterRequest[];
  currency: string;
}) {
  const t = useT();
  const isManager = role === "owner" || role === "manager";
  const [tab, setTab] = useState<Tab>(role === "waiter" ? "service" : "kitchen");

  const showKitchen = role === "chef" || (isManager && tab === "kitchen");
  const showService = role === "waiter" || role === "staff" || (isManager && tab === "service");

  return (
    <div className="space-y-5">
      {isManager && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
          {(["kitchen", "service"] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === value ? "bg-white text-ink-900" : "text-white/60 hover:text-white"
              )}
            >
              {value === "kitchen" ? t("station.kitchen") : t("station.service")}
            </button>
          ))}
        </div>
      )}

      {showService && <ServiceView calls={calls} orders={orders} currency={currency} />}
      {showKitchen && <KitchenView orders={orders} currency={currency} />}
    </div>
  );
}

// ------------------------------------------------------------------ kitchen

function KitchenView({
  orders,
  currency,
}: {
  orders: OrderWithDetails[];
  currency: string;
}) {
  const t = useT();
  const incoming = orders.filter((o) => o.status === "pending" || o.status === "accepted");
  const cooking = orders.filter((o) => o.status === "preparing");
  const done = orders.filter((o) => o.status === "ready");

  return (
    <div className="space-y-6">
      <Section title={t("station.incoming")} count={incoming.length} tone="brand">
        {incoming.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            currency={currency}
            primary={{ label: t("station.startCooking"), status: "preparing", variant: "brand" }}
          />
        ))}
        <Empty show={incoming.length === 0} text={t("station.noIncoming")} />
      </Section>

      <Section title={t("station.cooking")} count={cooking.length} tone="amber">
        {cooking.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            currency={currency}
            primary={{ label: t("station.markReady"), status: "ready", variant: "emerald" }}
          />
        ))}
        <Empty show={cooking.length === 0} text={t("station.noCooking")} />
      </Section>

      <Section title={t("station.waitingPickup")} count={done.length} tone="emerald">
        {done.map((order) => (
          <OrderCard key={order.id} order={order} currency={currency} callWaiter />
        ))}
        <Empty show={done.length === 0} text={t("station.noReady")} />
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ service

function ServiceView({
  calls,
  orders,
  currency,
}: {
  calls: WaiterRequest[];
  orders: OrderWithDetails[];
  currency: string;
}) {
  const t = useT();
  const ready = orders.filter((o) => o.status === "ready");

  return (
    <div className="space-y-6">
      <Section title={t("station.calls")} count={calls.length} tone="brand">
        {calls.map((call) => (
          <CallCard key={call.id} call={call} />
        ))}
        <Empty show={calls.length === 0} text={t("station.noCalls")} />
      </Section>

      <Section title={t("station.readyToServe")} count={ready.length} tone="emerald">
        {ready.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            currency={currency}
            primary={{ label: t("station.delivered"), status: "completed", variant: "emerald" }}
          />
        ))}
        <Empty show={ready.length === 0} text={t("station.noReadyService")} />
      </Section>
    </div>
  );
}

// -------------------------------------------------------------------- parts

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "brand" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  const dot =
    tone === "brand" ? "bg-brand-500" : tone === "amber" ? "bg-amber-400" : "bg-emerald-400";

  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-white/60">
        <span className={cn("size-2 rounded-full", dot)} />
        {title}
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">{count}</span>
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Empty({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return (
    <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/40">
      {text}
    </p>
  );
}

function CallCard({ call }: { call: WaiterRequest }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  const table = call.restaurant_tables?.label ?? t("live.someTable");
  const orderNumber = call.orders?.order_number;

  return (
    <article
      className={cn(
        "rounded-2xl border p-4",
        call.origin === "staff"
          ? "border-emerald-400/30 bg-emerald-400/10"
          : "border-brand-400/30 bg-brand-500/10"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{call.origin === "staff" ? "🛎️" : "🔔"}</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">
            {call.origin === "staff" && orderNumber
              ? t("live.pickup", { number: orderNumber })
              : t("live.waiterCall", { table })}
          </p>
          <p className="mt-0.5 text-xs text-white/60">
            {call.origin === "staff" ? t("station.fromKitchen") : table} ·{" "}
            {relativeTime(call.created_at)}
          </p>
          {call.note && <p className="mt-1.5 text-sm text-white/80">{call.note}</p>}
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await resolveWaiterRequestAction(call.id);
            router.refresh();
          })
        }
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-ink-900 disabled:opacity-60"
      >
        <Icon.check className="size-4.5" />
        {t("station.onMyWay")}
      </button>
    </article>
  );
}

function OrderCard({
  order,
  currency,
  primary,
  callWaiter,
}: {
  order: OrderWithDetails;
  currency: string;
  primary?: { label: string; status: string; variant: "brand" | "emerald" };
  callWaiter?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [called, setCalled] = useState(false);

  const table = order.restaurant_tables?.label ?? t("live.someTable");

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">
            #{order.order_number} · {table}
          </p>
          <p className="mt-0.5 text-xs text-white/50">{relativeTime(order.created_at)}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-white/80">
          {formatMoney(order.total, currency)}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className="mt-px shrink-0 rounded-md bg-white/10 px-1.5 text-xs font-semibold leading-5">
              {item.quantity}×
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-white">{item.product_name}</span>
              {item.variant_name && (
                <span className="text-white/50"> · {item.variant_name}</span>
              )}
              {item.note && <span className="block text-xs text-amber-300">“{item.note}”</span>}
            </span>
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          {order.note}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {primary && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await updateOrderStatusAction(order.id, primary.status);
                router.refresh();
              })
            }
            className={cn(
              "flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60",
              primary.variant === "brand" ? "bg-brand-600" : "bg-emerald-600"
            )}
          >
            {primary.label}
          </button>
        )}

        {callWaiter && (
          <button
            type="button"
            disabled={pending || called}
            onClick={() =>
              start(async () => {
                await callWaiterForOrderAction(order.id);
                setCalled(true);
                router.refresh();
              })
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-ink-900 disabled:opacity-60"
          >
            <Icon.bell className="size-4.5" />
            {called ? t("station.waiterCalled") : t("station.callWaiter")}
          </button>
        )}
      </div>
    </article>
  );
}
