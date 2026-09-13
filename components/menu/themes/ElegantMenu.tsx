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
        <div className="relative h-56 sm:h-72">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />
        </div>

        <div className="relative -mt-16 px-5 text-center">
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
          <h1 className="mt-4 font-serif text-4xl leading-tight">{restaurant.name}</h1>
          {restaurant.description && (
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#6d6257] text-balance-pretty">
              {restaurant.description}
            </p>
          )}
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-[#8a7c6d]">
            {restaurant.address && <span>{restaurant.address}</span>}
            {restaurant.address && restaurant.phone && <span aria-hidden="true">·</span>}
            {restaurant.phone && <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>}
          </div>
          <div className="mx-auto mt-6 flex items-center justify-center gap-3" aria-hidden="true">
            <span className="h-px w-12 bg-[#cdbfa9]" />
            <span className="size-1.5 rotate-45 bg-[#cdbfa9]" />
            <span className="h-px w-12 bg-[#cdbfa9]" />
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-6 border-y border-[#e6dcca] bg-[#faf7f2]/95 backdrop-blur">
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
          <section key={category.id} id={category.id} className="scroll-mt-20 pt-12">
            <div className="text-center">
              <h2 className="font-serif text-2xl tracking-wide">{category.name}</h2>
              {category.description && (
                <p className="mt-1.5 text-sm text-[#8a7c6d]">{category.description}</p>
              )}
            </div>

            <ul className="mt-7 space-y-8">
              {category.products.map((product) => {
                const prices = product.product_variants.map((v) => Number(v.price));
                const ingredients = splitIngredients(product.ingredients);
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      className="group block w-full text-left"
                    >
                      {product.image_url && (
                        <MenuImage
                          src={product.image_url}
                          alt={product.name}
                          className="aspect-[16/10] w-full shadow-sm transition-transform group-hover:scale-[1.01]"
                          rounded="rounded-2xl"
                        />
                      )}
                      <div className={product.image_url ? "mt-4" : ""}>
                        <div className="flex items-baseline gap-3">
                          <h3 className="font-serif text-xl">{product.name}</h3>
                          <span className="h-px flex-1 bg-[#e0d4c0]" aria-hidden="true" />
                          {showPrices && (
                            <span className="font-serif text-lg">
                              {product.product_variants.length === 1
                                ? formatMoney(prices[0] ?? 0, currency)
                                : priceRange(prices, currency)}
                            </span>
                          )}
                        </div>

                        {product.description && (
                          <p className="mt-2 text-sm leading-relaxed text-[#6d6257]">
                            {product.description}
                          </p>
                        )}

                        {showIngredients && ingredients.length > 0 && (
                          <p className="mt-2 text-xs uppercase tracking-wide text-[#a2937f]">
                            {ingredients.join(" · ")}
                          </p>
                        )}

                        {showPrices && product.product_variants.length > 1 && (
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#6d6257]">
                            {product.product_variants.map((v) => (
                              <span key={v.id}>
                                {v.name}{" "}
                                <span className="font-medium text-[#2b2520]">
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
