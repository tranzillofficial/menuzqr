"use client";

import { useMemo } from "react";
import { useMenu } from "../MenuContext";
import { MenuImage } from "../MenuMedia";
import { CategoryNav, useActiveCategory } from "../CategoryNav";
import { formatMoney, priceRange, splitIngredients } from "@/lib/utils";

/** Bright and playful — juice bars, dessert shops, bakeries. */
export function MarketMenu() {
  const { data, currency, showPrices, showIngredients, openProduct } = useMenu();
  const { restaurant, categories } = data;
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const active = useActiveCategory(categoryIds);

  return (
    <div className="min-h-screen bg-[#fffbeb] pb-28 text-[#1c1917]">
      <header className="relative overflow-hidden rounded-b-[2.5rem] bg-[#0f766e]">
        {restaurant.cover_url && (
          <MenuImage
            src={restaurant.cover_url}
            alt=""
            className="absolute inset-0 h-full w-full opacity-25"
            sizes="100vw"
            priority
          />
        )}
        <div
          aria-hidden="true"
          className="absolute -end-16 -top-16 size-56 rounded-full bg-[#f59e0b]/30 blur-2xl"
        />

        <div className="relative px-6 pb-10 pt-12 text-center">
          {restaurant.logo_url && (
            <MenuImage
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="mx-auto size-20 border-4 border-white/90 shadow-lg"
              rounded="rounded-3xl"
              sizes="80px"
              priority
            />
          )}

          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white">
            {restaurant.name}
          </h1>

          {restaurant.description && (
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/85">
              {restaurant.description}
            </p>
          )}

          {restaurant.address && (
            <span className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
              {restaurant.address}
            </span>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-20 bg-[#fffbeb]/95 backdrop-blur">
        <CategoryNav
          categories={categories}
          active={active}
          className="mx-auto max-w-3xl px-4 py-3"
          itemClassName="rounded-2xl border-2 border-[#0f766e]/15 bg-white px-4 py-2 text-sm font-bold text-[#0f766e]"
          activeClassName="border-[#0f766e] bg-[#0f766e] text-white"
        />
      </div>

      <main className="mx-auto max-w-3xl px-4">
        {categories.map((category, index) => (
          <section key={category.id} id={category.id} className="scroll-mt-20 pt-8">
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: index % 2 === 0 ? "rgba(15,118,110,0.10)" : "rgba(245,158,11,0.16)",
              }}
            >
              <h2 className="text-lg font-extrabold tracking-tight">{category.name}</h2>
              {category.description && (
                <p className="truncate text-xs text-ink-600">{category.description}</p>
              )}
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {category.products.map((product) => {
                const prices = product.product_variants.map((v) => Number(v.price));
                const ingredients = splitIngredients(product.ingredients);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      className="group flex h-full w-full flex-col overflow-hidden rounded-3xl bg-white text-start shadow-[0_2px_0_rgba(15,118,110,0.15)] ring-1 ring-black/5 transition-transform hover:-translate-y-1"
                    >
                      <MenuImage
                        src={product.image_url}
                        alt={product.name}
                        className="aspect-square w-full shrink-0"
                        sizes="(max-width: 640px) 50vw, 240px"
                      />
                      <div className="flex flex-1 flex-col p-3.5">
                        <p className="text-sm font-bold leading-snug">{product.name}</p>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                            {product.description}
                          </p>
                        )}
                        {showIngredients && ingredients.length > 0 && (
                          <p className="mt-1.5 truncate text-[11px] text-ink-400">
                            {ingredients.join(" · ")}
                          </p>
                        )}
                        {showPrices && (
                          <span className="ltr-nums mt-3 inline-flex w-fit rounded-full bg-[#0f766e] px-3 py-1 text-xs font-bold text-white">
                            {product.product_variants.length === 1
                              ? formatMoney(prices[0] ?? 0, currency)
                              : priceRange(prices, currency)}
                          </span>
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
