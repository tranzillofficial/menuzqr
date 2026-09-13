"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resolveWaiterRequestAction,
  updateOrderStatusAction,
} from "@/lib/actions/orders";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { formatMoney, formatTime, relativeTime } from "@/lib/utils";
import type { OrderWithDetails, WaiterRequest } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; value: OrderStatus }>> = {
  pending: { label: "Accept", value: "accepted" },
  accepted: { label: "Start preparing", value: "preparing" },
  preparing: { label: "Mark ready", value: "ready" },
  ready: { label: "Complete", value: "completed" },
};

const TONE: Record<OrderStatus, "brand" | "info" | "warning" | "success" | "neutral" | "danger"> = {
  pending: "brand",
  accepted: "info",
  preparing: "warning",
  ready: "success",
  completed: "neutral",
  cancelled: "danger",
};

export function OrdersBoard({
  orders,
  waiterRequests,
  currency,
}: {
  orders: OrderWithDetails[];
  waiterRequests: WaiterRequest[];
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "done">("open");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string } | null>) {
    startTransition(async () => {
      const result = await fn();
      if (result?.message) toast(result.message, result.ok ? "success" : "error");
      router.refresh();
    });
  }

  const openOrders = orders.filter((o) =>
    ["pending", "accepted", "preparing", "ready"].includes(o.status)
  );
  const doneOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const shown = tab === "open" ? openOrders : doneOrders;

  return (
    <div className="space-y-6">
      {waiterRequests.length > 0 && (
        <section className="rounded-2xl border border-brand-300 bg-brand-50 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-900">
            <span className="text-base">🔔</span>
            Waiter calls ({waiterRequests.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {waiterRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3"
              >
                <span className="font-medium text-ink-900">
                  {request.restaurant_tables?.label ?? "Table"}
                </span>
                <span className="text-sm text-ink-500">
                  needs a waiter · {relativeTime(request.created_at)}
                </span>
                <Button
                  size="sm"
                  className="ml-auto"
                  loading={pending}
                  onClick={() => run(() => resolveWaiterRequestAction(request.id))}
                >
                  <Icon.check className="size-3.5" />
                  Mark as handled
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
        {(
          [
            ["open", `Active (${openOrders.length})`],
            ["done", `History (${doneOrders.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === value ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={tab === "open" ? "🧾" : "📦"}
          title={tab === "open" ? "No active orders" : "No past orders yet"}
          description={
            tab === "open"
              ? "When a guest scans a table QR code and sends an order, it appears here instantly — with a sound."
              : "Completed and cancelled orders are kept here."
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((order) => {
            const next = NEXT_STATUS[order.status as OrderStatus];
            return (
              <li key={order.id} className="rounded-2xl border border-ink-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-ink-900">
                    #{order.order_number}
                  </span>
                  <span className="rounded-lg bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                    {order.restaurant_tables?.label ?? "No table"}
                  </span>
                  <Badge tone={TONE[order.status as OrderStatus]}>
                    {ORDER_STATUS_LABEL[order.status as OrderStatus]}
                  </Badge>
                  <span className="ml-auto text-xs text-ink-400">
                    {formatTime(order.created_at)}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {order.order_items.map((item) => (
                    <li key={item.id} className="flex gap-2 text-sm">
                      <span className="font-medium text-ink-900">{item.quantity}×</span>
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-900">{item.product_name}</span>
                        {item.variant_name && (
                          <span className="text-ink-500"> · {item.variant_name}</span>
                        )}
                        {item.note && (
                          <span className="mt-0.5 block text-xs italic text-brand-700">
                            “{item.note}”
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap text-ink-600">
                        {formatMoney(Number(item.line_total), order.currency || currency)}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.note && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <strong>Order note:</strong> {order.note}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                  <span className="text-sm font-semibold text-ink-900">
                    {formatMoney(Number(order.total), order.currency || currency)}
                  </span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {next && (
                      <Button
                        size="sm"
                        loading={pending}
                        onClick={() => run(() => updateOrderStatusAction(order.id, next.value))}
                      >
                        {next.label}
                      </Button>
                    )}
                    {!["completed", "cancelled"].includes(order.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => updateOrderStatusAction(order.id, "cancelled"))}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
