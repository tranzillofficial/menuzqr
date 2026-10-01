"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMenu } from "../MenuContext";
import { MenuImage } from "../MenuMedia";
import { CategoryNav, useActiveCategory } from "../CategoryNav";
import { formatMoney, priceRange } from "@/lib/utils";

/** The public showcase uses the restaurant's live products and variants. */
export function DemoMenu() {
  const { data, currency, showPrices, openProduct } = useMenu();
  const ar = data.restaurant.language === "ar";
  const [query, setQuery] = useState("");
  const categories = useMemo(() => data.categories.map(category => ({
    ...category,
    products: category.products.filter(product => `${product.name} ${product.description ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  })).filter(category => category.products.length), [data.categories, query]);
  const ids = useMemo(() => categories.map(category => category.id), [categories]);
  const active = useActiveCategory(ids);
  const count = categories.reduce((sum, category) => sum + category.products.length, 0);

  return <div className="min-h-screen bg-[#faf7f2] pb-12 text-[#27221e]">
    <header className="relative isolate overflow-hidden bg-[#211a15] text-white">
      {data.restaurant.cover_url && <div className="absolute inset-0"><MenuImage src={data.restaurant.cover_url} alt="" fit="cover" priority sizes="100vw" className="h-full w-full" /></div>}
      <div className="absolute inset-0 -z-0 bg-gradient-to-t from-[#211a15] via-[#211a15]/80 to-[#211a15]/45" />
      <div className="relative mx-auto max-w-6xl px-4 pb-9 pt-5 sm:px-6 sm:pb-14 sm:pt-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><MenuImage src={data.restaurant.logo_url} alt="" className="size-10 bg-white" rounded="rounded-xl" priority sizes="40px" /><span className="text-sm font-semibold">{data.restaurant.name}</span></div>
          <span className="shrink-0 rounded-full border border-white/25 bg-black/20 px-3 py-1.5 text-xs text-white/90">{ar ? "منيو تجريبي" : "Demo menu"}</span>
        </div>
        <div className="max-w-2xl pt-12 sm:pt-20">
          <p className="mb-3 text-sm font-medium text-[#ffbf8c]">{ar ? "اختار اللي على مزاجك" : "Find your next favourite"}</p>
          <h1 className="text-4xl font-bold leading-[1.35] tracking-tight sm:text-6xl">{ar ? <>أكلة حلوة.<br /><span className="text-[#ffad70]">وقهوة تكمّلها.</span></> : <>Good food.<br /><span className="text-[#ffad70]">Great coffee.</span></>}</h1>
          {data.restaurant.description && <p className="mt-4 max-w-lg text-sm leading-7 text-white/80 sm:text-base">{data.restaurant.description}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs"><a href={`#${data.categories[0]?.id ?? "products"}`} className="rounded-full bg-[#f47726] px-5 py-3 font-semibold text-white transition hover:bg-[#df6317]">{ar ? "شوف المنيو" : "Explore the menu"}<span aria-hidden="true" className="ms-2">↓</span></a><span className="text-white/70">{ar ? "صور وأسعار وتفاصيل كل اختيار" : "Photos, prices and every detail"}</span></div>
        </div>
      </div>
    </header>

    <div className="sticky top-0 z-20 border-b border-[#e8ded3] bg-[#faf7f2]/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        <label className="flex h-12 items-center gap-3 rounded-2xl border border-[#e5dbcf] bg-white px-4">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5 shrink-0 text-[#8c7b6c]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={ar ? "نفسك في إيه؟ دوّر في المنيو" : "What are you craving? Search the menu"} aria-label={ar ? "البحث في المنيو" : "Search the menu"} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#998a7c]" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label={ar ? "مسح البحث" : "Clear search"} className="grid size-8 place-items-center rounded-full text-[#766556] hover:bg-[#faf7f2]">×</button>}
        </label>
      </div>
      <CategoryNav categories={categories} active={active} className="mx-auto max-w-6xl px-4 py-3 sm:px-6" itemClassName="rounded-full border border-[#e5dbcf] bg-white px-4 py-2.5 text-sm font-medium text-[#746354]" activeClassName="!border-[#29211a] !bg-[#29211a] !text-white" />
    </div>

    <main id="products" className="mx-auto max-w-6xl px-4 sm:px-6">
      {!categories.length && <div className="py-14 text-center"><p className="text-lg font-semibold">{ar ? "مفيش نتائج بالاسم ده" : "No matches found"}</p><button type="button" onClick={() => setQuery("")} className="mt-3 text-sm text-[#bc5319]">{ar ? "اعرض المنيو كله" : "Show the whole menu"}</button></div>}
      {categories.map(category => <section key={category.id} id={category.id} className="scroll-mt-40 pt-8 sm:pt-10">
        <div className="mb-5 flex items-center gap-3"><span aria-hidden="true" className="h-6 w-1 rounded-full bg-[#e97229]" /><h2 className="text-xl font-bold sm:text-2xl">{category.name}</h2><span className="ms-auto rounded-full bg-[#eee6dc] px-3 py-1 text-xs text-[#776657]">{category.products.length} {ar ? "اختيارات" : "choices"}</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {category.products.map(product => {
            const prices = product.product_variants.map(variant => Number(variant.price));
            return <button key={product.id} type="button" onClick={() => openProduct(product)} aria-label={ar ? `تفاصيل ${product.name}` : `View ${product.name}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e8e0d7] bg-white text-start shadow-[0_3px_12px_#34251805] transition hover:-translate-y-1 hover:border-[#e4b791] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d66720]">
              <MenuImage src={product.image_url} alt={product.name} className="aspect-square w-full !bg-white" rounded="" sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 260px" />
              <div className="flex flex-1 flex-col p-3 sm:p-4"><h3 className="text-sm font-bold leading-6 sm:text-base">{product.name}</h3>{product.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#938274]">{product.description}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">{showPrices && prices.length > 0 && <span className="ltr-nums text-sm font-bold text-[#bb511a]">{prices.length === 1 ? formatMoney(prices[0], currency) : priceRange(prices, currency)}</span>}<span aria-hidden="true" className="ms-auto grid size-8 place-items-center rounded-full bg-[#fff2e7] text-xl text-[#bc551e]">+</span></div>
              </div>
            </button>;
          })}
        </div>
      </section>)}
      {count > 0 && <div className="mt-12 rounded-3xl bg-[#29211a] px-5 py-7 text-center text-white sm:p-10"><p className="text-xl font-bold">{ar ? "منيو مطعمك ممكن يبقى بالشكل ده" : "Your restaurant menu could look like this"}</p><p className="mt-2 text-sm leading-6 text-white/65">{ar ? "ضيف منتجاتك وصورك، واختار التصميم اللي يناسب مكانك." : "Add your products and photos, then pick the design for your venue."}</p><Link href="/signup" className="mt-5 inline-flex rounded-full bg-[#f47726] px-6 py-3 text-sm font-semibold transition hover:bg-[#df6317]">{ar ? "اعمل منيو لمطعمك" : "Create your restaurant menu"}</Link></div>}
      <p className="mt-6 text-center text-xs text-[#9e8d7e]">{ar ? "منيو تجريبي لعرض تجربة MenuzQR" : "A demo of the MenuzQR experience"}</p>
    </main>
  </div>;
}
