"use client";

import { useEffect, useState } from "react";
import { useMenu } from "./MenuContext";
import { MenuImage } from "./MenuMedia";
import { formatMoney, splitIngredients } from "@/lib/utils";

export function ProductSheet() {
  const {
    activeProduct,
    closeProduct,
    currency,
    showPrices,
    showIngredients,
    orderingEnabled,
    addItem,
  } = useMenu();

  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (activeProduct) {
      setVariantId(activeProduct.product_variants[0]?.id ?? null);
      setQuantity(1);
      setNote("");
    }
  }, [activeProduct]);

  useEffect(() => {
    if (!activeProduct) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeProduct();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [activeProduct, closeProduct]);

  if (!activeProduct) return null;

  const variants = activeProduct.product_variants;
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const ingredients = splitIngredients(activeProduct.ingredients);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade-in absolute inset-0 bg-black/50"
        onClick={closeProduct}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activeProduct.name}
        className="animate-slide-up relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white text-ink-900 shadow-2xl sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={closeProduct}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-ink-700 shadow backdrop-blur"
        >
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>

        <div className="overflow-y-auto">
          {activeProduct.image_url && (
            <MenuImage
              src={activeProduct.image_url}
              alt={activeProduct.name}
              className="aspect-[4/3] w-full"
              sizes="(max-width: 640px) 100vw, 512px"
              priority
            />
          )}

          <div className="space-y-5 p-5">
            <div>
              <h2 className="text-xl font-semibold">{activeProduct.name}</h2>
              {activeProduct.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                  {activeProduct.description}
                </p>
              )}
            </div>

            {showIngredients && ingredients.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Ingredients
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ingredients.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {variants.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {variants.length > 1 ? "Choose a size" : "Size"}
                </p>
                <div className="mt-2 space-y-2">
                  {variants.map((v) => {
                    const selected = v.id === variant?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVariantId(v.id)}
                        aria-pressed={selected}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                          selected
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 bg-white hover:border-ink-400"
                        }`}
                      >
                        <span className="text-sm font-medium">{v.name}</span>
                        {showPrices && (
                          <span className="text-sm font-semibold">
                            {formatMoney(Number(v.price), currency)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {orderingEnabled && (
              <div>
                <label
                  htmlFor="item-note"
                  className="text-xs font-semibold uppercase tracking-wide text-ink-400"
                >
                  Special request
                </label>
                <input
                  id="item-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="No onions, extra sauce…"
                  className="mt-2 w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:border-ink-900 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {orderingEnabled && variant && (
          <div className="flex items-center gap-3 border-t border-ink-100 bg-white p-4">
            <div className="flex items-center rounded-xl border border-ink-200">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3.5 py-2.5 text-lg leading-none text-ink-600 hover:text-ink-900"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="px-3.5 py-2.5 text-lg leading-none text-ink-600 hover:text-ink-900"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                addItem({
                  variantId: variant.id,
                  productId: activeProduct.id,
                  productName: activeProduct.name,
                  variantName: variant.name,
                  unitPrice: Number(variant.price),
                  quantity,
                  note,
                  imageUrl: activeProduct.image_url,
                });
                closeProduct();
              }}
              className="flex-1 rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
            >
              Add to order ·{" "}
              {formatMoney(Number(variant.price) * quantity, currency)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
