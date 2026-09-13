"use client";

import { useMemo } from "react";
import { useMenu } from "../MenuContext";
import { MenuImage } from "../MenuMedia";
import { CategoryNav, useActiveCategory } from "../CategoryNav";
import { formatMoney, priceRange, splitIngredients } from "@/lib/utils";

export function ElegantMenu() {
  const { data, currency, showPrices, showIngredients, openProduct } = useMenu();
  const { restaurant, categories } = data;
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const active = useActiveCategory(categoryIds);

  return (
    <div className="min-h-screen bg-[#faf7f2] pb-28 text-[#2b2520]">
      <header className="relative">
        <div className="relative h-64 sm:h-80">
          {restaurant.cover_url ? (
            <MenuImage
              src={restaurant.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#3a332b] to-[#6b5c48]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#faf7f2] via-black/30 to-black/25" />
        </div>

        <div className="relative -mt-20 px-5 text-center">
          {restaurant.logo_url && (
            <MenuImage
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="mx-auto size-24 border-4 border-[#faf7f2] shadow-lg"
              rounded="rounded-full"
              sizes="96px"
              priority
            />
          )}

          <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.1] tracking-tight">
            {restaurant.name}
          </h1>

          {restaurant.description && (
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[#6d6257] text-balance-pretty">
              {restaurant.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.14em] text-[#a2937f]">
            {restaurant.address && <span>{restaurant.address}</span>}
            {restaurant.address && restaurant.phone && <span aria-hidden="true">·</span>}
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="ltr-nums hover:text-[#6d6257]">
                {restaurant.phone}
              </a>
            )}
          </div>

          <div className="mx-auto mt-7 flex items-center justify-center gap-3" aria-hidden="true">
            <span className="h-px w-14 bg-gradient-to-r from-transparent to-[#cdbfa9]" />
            <span className="size-1.5 rotate-45 bg-[#cdbfa9]" />
            <span className="h-px w-14 bg-gradient-to-l from-transparent to-[#cdbfa9]" />
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-7 border-y border-[#e6dcca] bg-[#faf7f2]/95 backdrop-blur">
        <CategoryNav
          categories={categories}
          active={active}
          className="mx-auto max-w-2xl px-4 py-3"
          itemClassName="rounded-full border border-[#ddd0ba] px-4 py-1.5 font-serif text-sm text-[#6d6257]"
          activeClassName="border-[#2b2520] bg-[#2b2520] text-[#faf7f2]"
        />
      </div>

      <main className="mx-auto max-w-2xl px-5">
        {categories.map((category) => (
          <section key={category.id} id={category.id} className="scroll-mt-20 pt-14">
            <div className="text-center">
              <h2 className="font-serif text-[1.7rem] tracking-wide">{category.name}</h2>
              {category.description && (
                <p className="mt-2 text-sm text-[#8a7c6d]">{category.description}</p>
              )}
              <span
                aria-hidden="true"
                className="mx-auto mt-4 block h-px w-16 bg-[#d9cbb4]"
              />
            </div>

            <ul className="mt-8 space-y-10">
              {category.products.map((product) => {
                const prices = product.product_variants.map((v) => Number(v.price));
                const ingredients = splitIngredients(product.ingredients);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      className="group block w-full text-start"
                    >
                      {product.image_url && (
                        <MenuImage
                          src={product.image_url}
                          alt={product.name}
                          className="aspect-[16/10] w-full shadow-sm ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.01]"
                          rounded="rounded-2xl"
                        />
                      )}

                      <div className={product.image_url ? "mt-5" : ""}>
                        <div className="flex items-baseline gap-3">
                          <h3 className="font-serif text-xl leading-snug">{product.name}</h3>
                          <span
                            className="h-px flex-1 translate-y-[-3px] border-b border-dotted border-[#cfc0a6]"
                            aria-hidden="true"
                          />
                          {showPrices && (
                            <span className="ltr-nums font-serif text-lg">
                              {product.product_variants.length === 1
                                ? formatMoney(prices[0] ?? 0, currency)
                                : priceRange(prices, currency)}
                            </span>
                          )}
                        </div>

                        {product.description && (
                          <p className="mt-2 text-[15px] leading-relaxed text-[#6d6257]">
                            {product.description}
                          </p>
                        )}

                        {showIngredients && ingredients.length > 0 && (
                          <p className="mt-2.5 text-[11px] uppercase tracking-[0.12em] text-[#a2937f]">
                            {ingredients.join(" · ")}
                          </p>
                        )}

                        {showPrices && product.product_variants.length > 1 && (
                          <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[#6d6257]">
                            {product.product_variants.map((v) => (
                              <span key={v.id} className="inline-flex items-baseline gap-1.5">
                                {v.name}
                                <span className="ltr-nums font-medium text-[#2b2520]">
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
