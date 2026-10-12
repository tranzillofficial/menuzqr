"use client";

import {featureEnabled} from "@/lib/business-features";
import { ProductBarcodeScanner } from "./ProductBarcodeScanner";
import { lookupProductBarcode } from "@/lib/actions/barcode";
import { moduleEnabled } from "@/lib/business-modules";
import { categoryPath, categoryDescendants } from "@/lib/category-tree";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteProductAction,
  moveProductAction,
  toggleProductAction,
} from "@/lib/actions/products";
import { ProductEditor } from "./ProductEditor";
import { SmartImage } from "@/components/ui/SmartImage";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { Select, Switch } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useI18n, useT } from "@/components/i18n/I18nProvider";
import { priceRange } from "@/lib/utils";
import type { Category, ProductWithVariants, Restaurant } from "@/lib/types";

export function ProductsManager({
  restaurant,
  categories,
  products, pagination,
}: {
  restaurant: Restaurant;
  categories: Category[];
  pagination?:{page:number;pageSize:number;total:number;query:string;category:string};
  products: ProductWithVariants[];
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const {locale}=useI18n();
  const ar=locale==="ar";
  const [editing, setEditing] = useState<ProductWithVariants | null | "new">(null);
  const [filter, setFilter] = useState(pagination?.category??"all");
  const [query, setQuery] = useState(pagination?.query??"");
  const [pending, startTransition] = useTransition();

  const categoryName = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  function navigate(nextPage=1,nextCategory=filter){const params=new URLSearchParams();params.set('page',String(nextPage));if(query.trim())params.set('q',query.trim());if(nextCategory!=='all')params.set('category',nextCategory);router.push(`/dashboard/products?${params}`,{scroll:false});}
  const visible = products.filter((product) => {
    if (filter === "uncategorised" && product.category_id) return false;
    if (filter !== "all" && filter !== "uncategorised" && !categoryDescendants(categories,filter).has(product.category_id ?? ""))
      return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return `${product.name} ${product.barcode ?? ""} ${product.description ?? ""}`.toLowerCase().includes(q);
    }
    return true;
  });

  function scanProduct(code: string) {
    startTransition(async () => {
      try {
        const result = await lookupProductBarcode(code);
        if (result.ok) setEditing(result.product);
        else toast(result.message, "error");
      } catch { toast(ar ? "تعذر الاتصال. حاول مرة أخرى." : "Connection failed. Please retry.", "error"); }
    });
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string } | null>) {
    startTransition(async () => {
      const result = await fn();
      if (result?.message) toast(result.message, result.ok ? "success" : "error");
      router.refresh();
    });
  }


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {moduleEnabled(restaurant,"catalog") && <LinkButton href="/dashboard/catalog" variant="secondary">{t("nav.catalog")}</LinkButton>}
        <Button onClick={() => setEditing("new")}>
          <Icon.plus className="size-4" />
          {t("products.add")}
        </Button>

        {featureEnabled(restaurant,"product_barcode") && <ProductBarcodeScanner onScan={scanProduct}/>}
        <div className="relative min-w-0 basis-full sm:basis-auto flex-1 sm:max-w-xs">
          <Icon.search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter" && query.trim()){e.preventDefault();if(featureEnabled(restaurant,"product_barcode")&&/^\d{8,}$/.test(query.trim()))scanProduct(query.trim());else if(pagination)navigate();}}}
            placeholder={ar ? "بحث بالاسم أو الباركود" : "Search name or barcode"}
            aria-label={t("products.searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {pagination&&<Button variant="secondary" onClick={()=>navigate()}>{ar?"بحث":"Search"}</Button>}
        <Select
          value={filter}
          onChange={(e) => {setFilter(e.target.value);if(pagination)navigate(1,e.target.value);}}
          aria-label={t("products.category")}
          className="h-11 w-full sm:w-auto py-0"
        >
          <option value="all">{t("products.allCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryPath(categories,c.id)}
            </option>
          ))}
          <option value="uncategorised">{t("products.uncategorised")}</option>
        </Select>
      </div>

      {pagination&&pagination.total>pagination.pageSize&&<nav aria-label={ar?'صفحات المنتجات':'Product pages'} className="flex items-center justify-center gap-3"><Button variant="secondary" disabled={pagination.page<=1} onClick={()=>navigate(pagination.page-1)}>{ar?'السابق':'Previous'}</Button><span className="text-sm">{pagination.page} / {Math.ceil(pagination.total/pagination.pageSize)}</span><Button variant="secondary" disabled={pagination.page*pagination.pageSize>=pagination.total} onClick={()=>navigate(pagination.page+1)}>{ar?'التالي':'Next'}</Button></nav>}
      {products.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title={t("products.emptyTitle")}
          description={t("products.emptyBody")}
          action={<Button onClick={() => setEditing("new")}>{t("products.emptyCta")}</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState title={t("common.nothingMatched")} />
      ) : (
        <ul className="space-y-2">
          {visible.map((product) => {
            const index = products.findIndex((p) => p.id === product.id);
            const prices = product.product_variants.map((v) => Number(v.price));
            return (
              <li
                key={product.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 sm:p-4"
              >
                <div className="hidden flex-col sm:flex">
                  <button
                    type="button"
                    aria-label={`Move ${product.name} up`}
                    disabled={index === 0 || pending || Boolean(query) || filter !== "all"}
                    onClick={() => run(() => moveProductAction(product.id, "up"))}
                    className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                  >
                    <Icon.arrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${product.name} down`}
                    disabled={
                      index === products.length - 1 || pending || Boolean(query) || filter !== "all"
                    }
                    onClick={() => run(() => moveProductAction(product.id, "down"))}
                    className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                  >
                    <Icon.arrowDown className="size-4" />
                  </button>
                </div>

                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                  {product.image_url ? (
                    <SmartImage src={product.image_url} alt="" sizes="112px" />
                  ) : (
                    <span className="grid h-full place-items-center text-ink-400">
                      <Icon.image className="size-5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 basis-[calc(100%-6rem)] sm:basis-0">
                  <p className="break-words font-medium text-ink-900">{product.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {product.category_id
                      ? categoryName[product.category_id]
                      : t("products.uncategorised")}{" "}
                    · {product.product_variants.length}
                    {product.barcode && <span className="mt-1 block font-mono" dir="ltr">{product.barcode}</span>}
                  </p>
                </div>

                <p className="ltr-nums me-auto whitespace-nowrap text-sm font-medium text-ink-900">
                  {priceRange(prices, restaurant.currency)}
                </p>

                <Switch
                  checked={product.is_active}
                  label={`Show ${product.name} on the menu`}
                  disabled={pending}
                  onChange={(v) => run(() => toggleProductAction(product.id, v))}
                />

                <button
                  type="button"
                  onClick={() => setEditing(product)}
                  aria-label={`Edit ${product.name}`}
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                >
                  <Icon.edit className="size-4" /><span className="text-xs">{t("common.edit")}</span>
                </button>

                <ConfirmButton
                  title={`Delete "${product.name}"?`}
                  message="This removes the product and all of its sizes. It cannot be undone."
                  confirmLabel="Delete product"
                  onConfirm={() => run(() => deleteProductAction(product.id))}
                  className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Icon.trash className="size-4" />
                </ConfirmButton>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <ProductEditor
          restaurant={restaurant}
          categories={categories}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
