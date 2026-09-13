"use client";

import { useMemo } from "react";
import { useMenu } from "../MenuContext";
import { MenuImage } from "../MenuMedia";
import { CategoryNav, useActiveCategory } from "../CategoryNav";
import { formatMoney, priceRange } from "@/lib/utils";

export function ModernMenu() {
  const { data, currency, showPrices, openProduct } = useMenu();
  const { restaurant, categories } = data;
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const active = useActiveCategory(categoryIds);

  return (
    <div className="min-h-screen bg-white pb-28 text-ink-900">
      <header className="relative">
        <div className="relative h-40 sm:h-52">
          {restaurant.cover_url ? (
            <MenuImage
              src={restaurant.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
          )}
        </div>

        <div className="mx-auto max-w-3xl px-4">
          <div className="-mt-10 flex items-end gap-4">
            {restaurant.logo_url ? (
              <MenuImage
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="size-20 shrink-0 border-4 border-white shadow-md"
                rounded="rounded-2xl"
                sizes="80px"
                priority
              />
            ) : (
              <div className="grid size-20 shrink-0 place-items-center rounded-2xl border-4 border-white bg-ink-900 text-2xl font-bold text-white shadow-md">
                {restaurant.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">{restaurant.name}</h1>
              {restaurant.address && (
                <p className="truncate text-sm text-ink-500">{restaurant.address}</p>
              )}
            </div>
          </div>

          {restaurant.description && (
            <p className="mt-4 text-sm leading-relaxed text-ink-600">{restaurant.description}</p>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-5 border-b border-ink-100 bg-white/95 backdrop-blur">
        <CategoryNav
          categories={categories}
          active={active}
          className="mx-auto max-w-3xl px-4 py-3"
          itemClassName="rounded-full bg-ink-100 px-4 py-2 text-sm font-medium text-ink-600"
          activeClassName="bg-ink-900 text-white"
        />
      </div>

      <main className="mx-auto max-w-3xl px-4">
        {categories.map((category) => (
          <section key={category.id} id={category.id} className="scroll-mt-20 pt-8">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold tracking-tight">{category.name}</h2>
              <span className="text-xs text-ink-400">{category.products.length} items</span>
            </div>
            {category.description && (
              <p className="mt-1 text-sm text-ink-500">{category.description}</p>
            )}

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {category.products.map((product) => {
                const prices = product.product_variants.map((v) => Number(v.price));
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white text-left transition-shadow hover:shadow-lg"
                    >
                      <MenuImage
                        src={product.image_url}
                        alt={product.name}
                        className="aspect-[4/3] w-full shrink-0"
                        sizes="(max-width: 640px) 50vw, 240px"
                      />
                      <div className="flex flex-1 flex-col p-3">
                        <p className="text-sm font-semibold leading-snug">{product.name}</p>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                          {showPrices && (
                            <span className="text-sm font-bold">
                              {product.product_variants.length === 1
                                ? formatMoney(prices[0] ?? 0, currency)
                                : priceRange(prices, currency)}
                            </span>
                          )}
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-900 text-white transition-transform group-hover:scale-110">
                            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10 5v10M5 10h10" strokeLinecap="round" />
                            </svg>
                          </span>
                        </div>
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
