"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { featureEnabled } from "@/lib/business-features";
import { moduleEnabled } from "@/lib/business-modules";
import { categoryDescendants, categoryPath } from "@/lib/category-tree";
import { lookupProductBarcode } from "@/lib/actions/barcode";
import {
  deleteProductAction,
  moveProductAction,
  toggleProductAction,
} from "@/lib/actions/products";
import { ProductBarcodeScanner } from "./ProductBarcodeScanner";
import { ProductEditor } from "./ProductEditor";
import { CategoryPicker } from "./CategoryPicker";
import { SmartImage } from "@/components/ui/SmartImage";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { useI18n, useT } from "@/components/i18n/I18nProvider";
import { priceRange } from "@/lib/utils";
import type { Category, ProductWithVariants, Restaurant } from "@/lib/types";

function ProductActions({
  product,
  pending,
  edit,
  run,
  canUp,
  canDown,
}: {
  product: ProductWithVariants;
  pending: boolean;
  edit: () => void;
  run: (fn: () => Promise<{ ok: boolean; message?: string } | null>) => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const { locale } = useI18n();
  const ar = locale === "ar";
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !(e.target instanceof Element && e.target.closest('[role="dialog"]'))
      )
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    ref.current?.addEventListener("keydown", key);
    const node = ref.current;
    return () => {
      document.removeEventListener("pointerdown", close);
      node?.removeEventListener("keydown", key);
    };
  }, [open]);
  const item =
    "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[13px] hover:bg-ink-50 disabled:opacity-40";
  return (
    <div ref={ref} className={`relative ${open ? "z-20" : ""}`}>
      <button
        type="button"
        aria-label={`${ar ? "إجراءات" : "Actions for"} ${product.name}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setAbove(
            (ref.current?.getBoundingClientRect().bottom ?? 0) >
              window.innerHeight - 260,
          );
          setOpen((v) => !v);
        }}
        className="grid size-10 place-items-center rounded-xl border border-ink-100 bg-white text-ink-600 hover:bg-brand-50"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          className={`absolute end-0 w-48 rounded-xl border border-ink-100 bg-white p-1.5 shadow-xl ${above ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              edit();
            }}
          >
            <Icon.edit className="size-4" />
            {ar ? "تعديل المنتج" : "Edit product"}
          </button>
          <button
            type="button"
            className={item}
            disabled={pending}
            onClick={() => {
              setOpen(false);
              run(() => toggleProductAction(product.id, !product.is_active));
            }}
          >
            <Icon.eye className="size-4" />
            {product.is_active
              ? ar
                ? "إخفاء من المنيو"
                : "Hide from menu"
              : ar
                ? "إظهار في المنيو"
                : "Show on menu"}
          </button>
          <button
            type="button"
            className={item}
            disabled={pending || !canUp}
            onClick={() => {
              setOpen(false);
              run(() => moveProductAction(product.id, "up"));
            }}
          >
            <Icon.arrowUp className="size-4" />
            {ar ? "نقل لأعلى" : "Move up"}
          </button>
          <button
            type="button"
            className={item}
            disabled={pending || !canDown}
            onClick={() => {
              setOpen(false);
              run(() => moveProductAction(product.id, "down"));
            }}
          >
            <Icon.arrowDown className="size-4" />
            {ar ? "نقل لأسفل" : "Move down"}
          </button>
          <div className="my-1 border-t border-ink-100" />
          <ConfirmButton
            title={ar ? `حذف «${product.name}»؟` : `Delete “${product.name}”?`}
            message={
              ar
                ? "سيتم حذف المنتج ووحدات البيع الخاصة به. لا يمكن التراجع."
                : "This removes the product and its selling options. This cannot be undone."
            }
            confirmLabel={ar ? "حذف المنتج" : "Delete product"}
            disabled={pending}
            onConfirm={() => run(() => deleteProductAction(product.id))}
            className={`${item} text-red-600`}
          >
            <Icon.trash className="size-4" />
            {ar ? "حذف المنتج" : "Delete product"}
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

export function ProductsManager({
  restaurant,
  categories,
  products,
  pagination,
}: {
  restaurant: Restaurant;
  categories: Category[];
  products: ProductWithVariants[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    query: string;
    category: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [editing, setEditing] = useState<ProductWithVariants | null | "new">(
    null,
  );
  const [filter, setFilter] = useState(pagination?.category ?? "all");
  const [query, setQuery] = useState(pagination?.query ?? "");
  const [pending, start] = useTransition();
  const roots = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );
  const barcode = featureEnabled(restaurant, "product_barcode");
  const inventory = moduleEnabled(restaurant, "inventory");
  function navigate(page = 1, category = filter) {
    const p = new URLSearchParams();
    p.set("page", String(page));
    if (query.trim()) p.set("q", query.trim());
    if (category !== "all") p.set("category", category);
    start(() => router.push(`/dashboard/products?${p}`, { scroll: false }));
  }
  function chooseCategory(id: string) {
    setFilter(id);
    if (pagination) navigate(1, id);
  }
  const appliedFilter = pagination?.category ?? filter;
  const appliedQuery = pagination?.query ?? query;
  const descendants =
    appliedFilter !== "all" && appliedFilter !== "uncategorised"
      ? categoryDescendants(categories, appliedFilter)
      : null;
  const visible = products.filter(
    (p) =>
      (appliedFilter === "all" ||
        (appliedFilter === "uncategorised"
          ? !p.category_id
          : descendants?.has(p.category_id ?? ""))) &&
      (!appliedQuery.trim() ||
        `${p.name} ${p.barcode ?? ""} ${p.description ?? ""}`
          .toLocaleLowerCase()
          .includes(appliedQuery.trim().toLocaleLowerCase())),
  );
  function scanProduct(code: string) {
    start(async () => {
      try {
        const r = await lookupProductBarcode(code);
        if (r.ok) setEditing(r.product);
        else toast(r.message, "error");
      } catch {
        toast(
          ar
            ? "تعذر الاتصال. حاول مرة أخرى."
            : "Connection failed. Please retry.",
          "error",
        );
      }
    });
  }
  function run(fn: () => Promise<{ ok: boolean; message?: string } | null>) {
    start(async () => {
      try {
        const r = await fn();
        if (r?.message) toast(r.message, r.ok ? "success" : "error");
        router.refresh();
      } catch {
        toast(
          ar
            ? "تعذر حفظ التغيير. حاول مرة أخرى."
            : "Could not save. Please retry.",
          "error",
        );
      }
    });
  }
  return (
    <div className="space-y-4" data-testid="products-workspace">
      <div className="rounded-2xl bg-white p-3 ring-1 ring-black/[.04] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (barcode && /^\d{8,}$/.test(query.trim()))
                scanProduct(query.trim());
              else if (pagination) navigate();
            }}
            className="relative min-w-0 flex-1"
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                ar
                  ? "بحث باسم المنتج أو الباركود"
                  : "Search product name or barcode"
              }
              aria-label={t("products.searchPlaceholder")}
              className={`h-11 w-full rounded-xl border border-ink-100 bg-ink-50/40 ps-11 text-sm outline-none focus:border-brand-300 ${barcode ? "pe-12" : "pe-3"}`}
            />
            <button
              type="submit"
              aria-label={ar ? "بحث" : "Search"}
              className="absolute start-1 top-0.5 grid size-10 place-items-center text-ink-500"
            >
              <Icon.search className="size-4" />
            </button>
            {barcode && (
              <div className="absolute end-1 top-0.5">
                <ProductBarcodeScanner compact onScan={scanProduct} />
              </div>
            )}
          </form>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {moduleEnabled(restaurant, "catalog") && (
              <LinkButton
                href="/dashboard/catalog"
                variant="secondary"
                size="sm"
              >
                {t("nav.catalog")}
              </LinkButton>
            )}
            <Button onClick={() => setEditing("new")} className="h-11">
              <Icon.plus className="size-4" />
              {t("products.add")}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {[
              { id: "all", name: ar ? "الكل" : "All" },
              ...roots.slice(0, 6),
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={filter === c.id}
                onClick={() => chooseCategory(c.id)}
                className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-medium ${filter === c.id ? "border-brand-200 bg-brand-50 text-brand-700" : "border-ink-100 text-ink-600 hover:bg-ink-50"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="w-36 shrink-0 sm:w-48">
            <CategoryPicker
              categories={categories}
              value={
                filter === "all" || filter === "uncategorised" ? "" : filter
              }
              onChange={(id) => chooseCategory(id || "all")}
              emptyLabel={ar ? "كل الأقسام" : "All categories"}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2 lg:hidden">
          <Button className="h-11 flex-1" onClick={() => setEditing("new")}>
            <Icon.plus className="size-4" />
            {t("products.add")}
          </Button>
          {moduleEnabled(restaurant, "catalog") && (
            <LinkButton
              href="/dashboard/catalog"
              variant="secondary"
              className="h-11 text-xs"
            >
              {t("nav.catalog")}
            </LinkButton>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-1 text-xs text-ink-500">
        <span>
          {pagination?.total ?? visible.length} {ar ? "منتج" : "products"}
        </span>
        <button
          type="button"
          onClick={() => chooseCategory("uncategorised")}
          className="min-h-8 hover:text-brand-700"
        >
          {t("products.uncategorised")}
        </button>
      </div>
      {!visible.length ? (
        <EmptyState
          icon="📦"
          title={
            appliedQuery||appliedFilter!=="all"
              ? t("common.nothingMatched")
              : t("products.emptyTitle")
          }
          action={
            !products.length&&!appliedQuery&&appliedFilter==="all" ? (
              <Button onClick={() => setEditing("new")}>
                {t("products.emptyCta")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div>
          <div
            className={`product-list-grid mb-2 hidden items-center gap-4 rounded-xl bg-ink-100/60 px-4 py-3 text-xs font-medium text-ink-500 lg:grid ${inventory ? "with-stock" : ""}`}
          >
            <span>{ar ? "المنتج" : "Product"}</span>
            <span>{ar ? "الباركود" : "Barcode"}</span>
            <span>{ar ? "السعر" : "Price"}</span>
            {inventory && <span>{ar ? "المخزون" : "Stock"}</span>}
            <span className="text-center">{ar ? "إجراءات" : "Actions"}</span>
          </div>
          <ul className="space-y-2" data-testid="product-rows">
            {visible.map((product) => {
              const index = products.findIndex((p) => p.id === product.id);
              const tracked = product.product_variants.filter(
                (v) => v.stock_tracked,
              );
              return (
                <li
                  key={product.id}
                  className={`product-list-grid relative flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/[.04] lg:grid lg:gap-4 lg:px-4 ${inventory ? "with-stock" : ""}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ink-50 lg:size-12">
                      <SmartImage
                        src={product.image_url}
                        alt=""
                        sizes="56px"
                        className="object-contain p-1"
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-[13px] font-semibold leading-5 text-ink-900 sm:text-sm">
                        {product.name}
                      </h2>
                      <p className="mt-0.5 truncate text-[11px] text-ink-500">
                        {product.category_id
                          ? categoryPath(categories, product.category_id)
                          : t("products.uncategorised")}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-ink-900 lg:hidden">
                        {priceRange(
                          product.product_variants
                            .filter((v) => v.is_active)
                            .map((v) => Number(v.price)),
                          restaurant.currency,
                        )}
                      </p>
                    </div>
                  </div>
                  <p
                    className="hidden truncate font-mono text-xs text-ink-500 lg:block"
                    dir="ltr"
                  >
                    {product.barcode || "—"}
                  </p>
                  <p className="hidden text-sm font-semibold lg:block">
                    {priceRange(
                      product.product_variants
                        .filter((v) => v.is_active)
                        .map((v) => Number(v.price)),
                      restaurant.currency,
                    )}
                  </p>
                  {inventory && (
                    <p className="hidden text-xs text-ink-500 lg:block">
                      {tracked.length === 1
                        ? `${Number(tracked[0].stock_quantity ?? 0)} ${tracked[0].name}`
                        : tracked.length
                          ? `${tracked.length} ${ar ? "وحدات متتبعة" : "tracked units"}`
                          : "—"}
                    </p>
                  )}
                  <ProductActions
                    product={product}
                    pending={pending}
                    edit={() => setEditing(product)}
                    run={run}
                    canUp={
                      index > 0 && !appliedQuery && appliedFilter === "all"
                    }
                    canDown={
                      index < products.length - 1 &&
                      !appliedQuery &&
                      appliedFilter === "all"
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {pagination && pagination.total > pagination.pageSize && (
        <nav
          aria-label={ar ? "صفحات المنتجات" : "Product pages"}
          className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-xs"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || pagination.page <= 1}
            onClick={() => navigate(pagination.page - 1)}
          >
            {ar ? "السابق" : "Previous"}
          </Button>
          <span>
            {pagination.page} /{" "}
            {Math.ceil(pagination.total / pagination.pageSize)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={
              pending ||
              pagination.page * pagination.pageSize >= pagination.total
            }
            onClick={() => navigate(pagination.page + 1)}
          >
            {ar ? "التالي" : "Next"}
          </Button>
        </nav>
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
