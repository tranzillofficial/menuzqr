"use client";

import { useState } from "react";
import { callWaiterAction } from "@/lib/actions/orders";
import { useMenu } from "./MenuContext";

export function WaiterButton({
  slug,
  tableToken,
  variant = "dark",
}: {
  slug: string;
  tableToken: string;
  variant?: "dark" | "light";
}) {
  const { waiterEnabled, table, itemCount, orderingEnabled } = useMenu();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!waiterEnabled) return null;

  // Keep clear of the cart bar when it is on screen.
  const bottom = orderingEnabled && itemCount > 0 ? "bottom-24" : "bottom-4";

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`fixed right-4 ${bottom} z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-transform active:scale-95 ${
          variant === "light"
            ? "bg-white text-ink-900 ring-1 ring-ink-200"
            : "bg-ink-900 text-white"
        }`}
      >
        <span aria-hidden="true">🔔</span>
        Call waiter
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="animate-fade-in absolute inset-0 bg-black/50"
            onClick={() => setConfirming(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Call a waiter"
            className="animate-slide-up relative w-full max-w-sm rounded-2xl bg-white p-6 text-center text-ink-900 shadow-2xl"
          >
            {result ? (
              <>
                <div
                  className={`mx-auto mb-3 grid size-14 place-items-center rounded-full text-2xl ${
                    result.ok ? "bg-emerald-100" : "bg-red-100"
                  }`}
                >
                  {result.ok ? "✓" : "!"}
                </div>
                <p className="text-sm text-ink-700">{result.message}</p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setResult(null);
                  }}
                  className="mt-5 w-full rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-ink-100 text-2xl">
                  🔔
                </div>
                <h2 className="text-base font-semibold">Call a waiter?</h2>
                <p className="mt-1.5 text-sm text-ink-600">
                  We&apos;ll let the staff know that {table?.label ?? "your table"} needs help.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-xl border border-ink-200 px-4 py-3 text-sm font-medium text-ink-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      const response = await callWaiterAction(slug, tableToken);
                      setPending(false);
                      setResult(response);
                    }}
                    className="flex-1 rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-ink-400"
                  >
                    {pending ? "Calling…" : "Yes, call"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
