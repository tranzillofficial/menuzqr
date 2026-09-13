"use client";

import { useMemo } from "react";
import { useMenu } from "../MenuContext";
import { MenuImage } from "../MenuMedia";
import { CategoryNav, useActiveCategory } from "../CategoryNav";
import { formatMoney, priceRange, splitIngredients } from "@/lib/utils";

/** Dark, warm-metal menu for bars and evening venues. */
export function NoirMenu() {
  const { data, currency, showPrices, showIngredients, openProduct } = useMenu();
  const { restaurant, categories } = data;
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const active = useActiveCategory(categoryIds);

  return (
    <div className="min-h-screen bg-[#0b0b0d] pb-28 text-[#ece7dd]">
      <header className="relative">
        <div className="relative h-72">
          {restaurant.cover_url ? (
            <MenuImage
              src={restaurant.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full opacity-70"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#2b2118_0%,#0b0b0d_70%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/70 to-transparent" />
        </div>

        <div className="relative -mt-28 px-5 text-center">
          {restaurant.logo_url && (
            <MenuImage
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="mx-auto size-20 ring-1 ring-[#c9a227]/40"
              rounded="rounded-full"
              sizes="80px"
              priority
            />
          )}

          {restaurant.address && (
            <p className="mt-6 text-[11px] uppercase tracking-[0.42em] text-[#c9a227]">
              {restaurant.address}
            </p>
          )}

          <h1 className="mt-3 font-serif text-[2.5rem] leading-tight text-white">
            {restaurant.name}
          </h1>

          {restaurant.description && (
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#9b948a]">
              {restaurant.description}
            </p>
          )}

          <div className="mx-auto mt-7 h-px w-24 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-6 border-y border-white/10 bg-[#0b0b0d]/95 backdrop-blur">
        <CategoryNav
          categories={categories}
          active={active}
          className="mx-auto max-w-2xl px-4 py-3"
          itemClassName="rounded-full border border-white/15 px-4 py-1.5 text-xs uppercase tracking-[0.16em] text-[#9b948a]"
          activeClassName="border-[#c9a227] bg-[#c9a227] text-[#0b0b0d]"
        />
      </div>

      <main className="mx-auto max-w-2xl px-5">
        {categories.map((category) => (
          <section key={category.id} id={category.id} className="scroll-mt-20 pt-12">
            <div className="flex items-center gap-4">
              <h2 className="font-serif text-2xl text-[#c9a227]">{category.name}</h2>
              <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
            </div>
            {category.description && (
              <p className="mt-2 text-sm text-[#9b948a]">{category.description}</p>
            )}

            <ul className="mt-6 space-y-3">
              {category.products.map((product) => {
                const prices = product.product_variants.map((v) => Number(v.price));
                const ingredients = splitIngredients(product.ingredients);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      className="group flex w-full gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-start transition-colors hover:border-[#c9a227]/40 hover:bg-white/[0.06]"
                    >
                      {product.image_url && (
                        <MenuImage
                          src={product.image_url}
                          alt={product.name}
                          className="size-24 shrink-0"
                          rounded="rounded-xl"
                          sizes="96px"
                        />
                      )}

                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-baseline gap-3">
                          <h3 className="truncate text-[15px] font-medium text-white">
                            {product.name}
                          </h3>
                          {showPrices && (
                            <span className="ltr-nums ms-auto shrink-0 font-serif text-[15px] text-[#c9a227]">
                              {product.product_variants.length === 1
                                ? formatMoney(prices[0] ?? 0, currency)
                                : priceRange(prices, currency)}
                            </span>
                          )}
                        </div>

                        {product.description && (
                          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[#9b948a]">
                            {product.description}
                          </p>
                        )}

                        {showIngredients && ingredients.length > 0 && (
                          <p className="mt-1.5 truncate text-[10px] uppercase tracking-[0.14em] text-[#6f6a62]">
                            {ingredients.join(" · ")}
                          </p>
                        )}

                        {showPrices && product.product_variants.length > 1 && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#9b948a]">
                            {product.product_variants.map((v) => (
                              <span key={v.id} className="inline-flex items-baseline gap-1.5">
                                {v.name}
                                <span className="ltr-nums text-[#ece7dd]">
                                  {formatMoney(Number(v.price), currency)}
                                </span>
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
