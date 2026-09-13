"use client";

import { useState } from "react";
import { useMenu } from "./MenuContext";
import { placeOrderAction } from "@/lib/actions/orders";
import { formatMoney } from "@/lib/utils";
import { useT } from "@/components/i18n/I18nProvider";

function sessionId() {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("mz-session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("mz-session", id);
    }
    return id;
  } catch {
    return "";
  }
}

export function CartBar({ slug, tableToken }: { slug: string; tableToken: string }) {
  const t = useT();
  const { itemCount, total, currency, orderingEnabled, setCartOpen } = useMenu();

  if (!orderingEnabled) return null;

  return (
    <>
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="animate-slide-up mx-auto flex w-full max-w-lg items-center gap-3 rounded-2xl bg-ink-900 px-5 py-4 text-white shadow-2xl transition-colors hover:bg-ink-800"
          >
            <span className="grid size-7 place-items-center rounded-full bg-white text-sm font-bold text-ink-900">
              {itemCount}
            </span>
            <span className="text-sm font-semibold">{t("menu.viewOrder")}</span>
            <span className="ms-auto text-sm font-semibold">{formatMoney(total, currency)}</span>
          </button>
        </div>
      )}
      {/* Rendered outside the bar so the confirmation screen survives clearing the cart. */}
      <CartSheet slug={slug} tableToken={tableToken} />
    </>
  );
}

function CartSheet({ slug, tableToken }: { slug: string; tableToken: string }) {
  const t = useT();
  const {
    cartOpen,
    setCartOpen,
    items,
    total,
    currency,
    setQuantity,
    removeItem,
    clearCart,
    table,
  } = useMenu();

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ number: number } | null>(null);

  if (!cartOpen) return null;

  async function submit() {
    setSubmitting(true);
    setError(null);
    const result = await placeOrderAction(
      slug,
      tableToken,
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, note: i.note })),
      note,
      sessionId()
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    clearCart();
    setNote("");
    setPlaced({ number: result.orderNumber });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade-in absolute inset-0 bg-black/50"
        onClick={() => {
          setCartOpen(false);
          setPlaced(null);
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your order"
        className="animate-slide-up relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white text-ink-900 shadow-2xl sm:rounded-3xl"
      >
        {placed ? (
          <div className="p-8 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-3xl">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-semibold">{t("menu.orderSent")}</h2>
            <p className="mt-1.5 text-sm text-ink-600">
              {t("menu.orderSentBody", { number: placed.number, table: table?.label ?? "" })}
            </p>
            <button
              type="button"
              onClick={() => {
                setPlaced(null);
                setCartOpen(false);
              }}
              className="mt-6 w-full rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white"
            >
              {t("menu.backToMenu")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">{t("menu.yourOrder")}</h2>
                {table && <p className="text-xs text-ink-500">{table.label}</p>}
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-500">{t("menu.emptyOrder")}</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {items.map((item) => (
                    <li key={item.key} className="flex gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-ink-500">{item.variantName}</p>
                        {item.note && (
                          <p className="mt-0.5 text-xs italic text-ink-500">“{item.note}”</p>
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          className="mt-1 text-xs text-red-600 underline-offset-2 hover:underline"
                        >
                          {t("common.remove")}
                        </button>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-semibold">
                          {formatMoney(item.unitPrice * item.quantity, currency)}
                        </span>
                        <div className="flex items-center rounded-lg border border-ink-200">
                          <button
                            type="button"
                            aria-label={`Decrease ${item.productName}`}
                            onClick={() => setQuantity(item.key, item.quantity - 1)}
                            className="px-2.5 py-1 text-ink-600"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Increase ${item.productName}`}
                            onClick={() => setQuantity(item.key, item.quantity + 1)}
                            className="px-2.5 py-1 text-ink-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {items.length > 0 && (
                <div className="mt-4">
                  <label htmlFor="order-note" className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {t("menu.noteForKitchen")}
                  </label>
                  <textarea
                    id="order-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={400}
                    rows={2}
                    placeholder={t("menu.notePlaceholder")}
                    className="mt-2 w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:border-ink-900 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {error && (
              <p className="mx-5 mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="border-t border-ink-100 p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-ink-500">{t("menu.total")}</span>
                <span className="text-lg font-semibold">{formatMoney(total, currency)}</span>
              </div>
              <button
                type="button"
                disabled={items.length === 0 || submitting}
                onClick={submit}
                className="w-full rounded-xl bg-ink-900 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-300"
              >
                {submitting ? t("menu.sending") : t("menu.placeOrder")}
              </button>
              <p className="mt-2 text-center text-xs text-ink-400">
                {t("menu.noAccountNote")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
