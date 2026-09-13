"use client";

import { useMemo } from "react";
import { useMenu } from "../MenuContext";
import { MenuImage } from "../MenuMedia";
import { CategoryNav, useActiveCategory } from "../CategoryNav";
import { formatMoney, priceRange, splitIngredients } from "@/lib/utils";

export function MinimalMenu() {
  const { data, currency, showPrices, showIngredients, openProduct } = useMenu();
  const { restaurant, categories } = data;
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const active = useActiveCategory(categoryIds);

  return (
    <div className="min-h-screen bg-white pb-28 text-ink-900">
      <header className="mx-auto max-w-xl px-5 pt-10">
        <div className="flex items-center gap-3">
          {restaurant.logo_url && (
            <MenuImage
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="size-12 shrink-0"
              rounded="rounded-xl"
              sizes="48px"
              priority
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{restaurant.name}</h1>
            {restaurant.address && (
              <p className="truncate text-xs text-ink-500">{restaurant.address}</p>
            )}
          </div>
        </div>
        {restaurant.description && (
          <p className="mt-4 text-sm leading-relaxed text-ink-600">{restaurant.description}</p>
        )}
      </header>

      <div className="sticky top-0 z-20 mt-6 border-b border-ink-100 bg-white/95 backdrop-blur">
        <CategoryNav
          categories={categories}
          active={active}
          className="mx-auto max-w-xl px-5 py-3"
          itemClassName="border-b-2 border-transparent px-1 pb-1 text-sm text-ink-500"
          activeClassName="border-ink-900 text-ink-900 font-medium"
        />
      </div>

      <main className="mx-auto max-w-xl px-5">
        {categories.map((category) => (
          <section key={category.id} id={category.id} className="scroll-mt-20 pt-9">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
              {category.name}
            </h2>

            <ul className="mt-3 divide-y divide-ink-100">
              {category.products.map((product) => {
                const prices = product.product_variants.map((v) => Number(v.price));
                const ingredients = splitIngredients(product.ingredients);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      className="flex w-full items-start gap-3 py-4 text-start"
                    >
                      {product.image_url && (
                        <MenuImage
                          src={product.image_url}
                          alt={product.name}
                          className="size-14 shrink-0"
                          rounded="rounded-lg"
                          sizes="56px"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-[15px] font-medium leading-snug">{product.name}</h3>
                          {showPrices && (
                            <>
                              <span
                                className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-300"
                                aria-hidden="true"
                              />
                              <span className="text-[15px] font-medium tabular-nums">
                                {product.product_variants.length === 1
                                  ? formatMoney(prices[0] ?? 0, currency)
                                  : priceRange(prices, currency)}
                              </span>
                            </>
                          )}
                        </div>
                        {product.description && (
                          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                            {product.description}
                          </p>
                        )}
                        {showIngredients && ingredients.length > 0 && (
                          <p className="mt-1 text-xs text-ink-400">{ingredients.join(", ")}</p>
                        )}
                        {showPrices && product.product_variants.length > 1 && (
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-500">
                            {product.product_variants.map((v) => (
                              <span key={v.id} className="tabular-nums">
                                {v.name} {formatMoney(Number(v.price), currency)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
