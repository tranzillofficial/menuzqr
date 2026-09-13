"use client";

import { useMemo } from "react";
import { useMenu } from "../MenuContext";
import { MenuImage } from "../MenuMedia";
import { CategoryNav, useActiveCategory } from "../CategoryNav";
import { useT } from "@/components/i18n/I18nProvider";
import { formatMoney, priceRange } from "@/lib/utils";

export function ModernMenu() {
  const { data, currency, showPrices, openProduct } = useMenu();
  const t = useT();
  const { restaurant, categories } = data;
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const active = useActiveCategory(categoryIds);

  return (
    <div className="min-h-screen bg-white pb-28 text-ink-900">
      <header className="relative">
        <div className="relative h-44 sm:h-56">
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
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-3xl px-4">
          <div className="-mt-12 flex items-end gap-4">
            {restaurant.logo_url ? (
              <MenuImage
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="size-24 shrink-0 border-4 border-white shadow-lg"
                rounded="rounded-3xl"
                sizes="96px"
                priority
              />
            ) : (
              <div className="grid size-24 shrink-0 place-items-center rounded-3xl border-4 border-white bg-ink-900 text-3xl font-bold text-white shadow-lg">
                {restaurant.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 pb-2">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {restaurant.name}
              </h1>
              {restaurant.address && (
                <p className="truncate text-sm text-ink-500">{restaurant.address}</p>
              )}
            </div>
          </div>

          {restaurant.description && (
            <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
              {restaurant.description}
            </p>
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
          <section key={category.id} id={category.id} className="scroll-mt-20 pt-9">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight">{category.name}</h2>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                {category.products.length} {t("menu.items")}
              </span>
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
                      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white text-start transition-all hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-lg"
                    >
                      <div className="relative">
                        <MenuImage
                          src={product.image_url}
                          alt={product.name}
                          className="aspect-[4/3] w-full shrink-0"
                          sizes="(max-width: 640px) 50vw, 240px"
                        />
                        {showPrices && (
                          <span className="ltr-nums absolute bottom-2 end-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold shadow-sm backdrop-blur">
                            {product.product_variants.length === 1
                              ? formatMoney(prices[0] ?? 0, currency)
                              : priceRange(prices, currency)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-3">
                        <p className="text-sm font-semibold leading-snug">{product.name}</p>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                            {product.description}
                          </p>
                        )}
                        <span className="mt-auto pt-2.5">
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-ink-900 text-white transition-transform group-hover:scale-110">
                            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10 5v10M5 10h10" strokeLinecap="round" />
                            </svg>
                          </span>
                        </span>
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
