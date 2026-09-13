"use client";

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
import { priceRange } from "@/lib/utils";
import type { Category, ProductWithVariants, Restaurant } from "@/lib/types";

export function ProductsManager({
  restaurant,
  categories,
  products,
}: {
  restaurant: Restaurant;
  categories: Category[];
  products: ProductWithVariants[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<ProductWithVariants | null | "new">(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const categoryName = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const visible = products.filter((product) => {
    if (filter === "uncategorised" && product.category_id) return false;
    if (filter !== "all" && filter !== "uncategorised" && product.category_id !== filter)
      return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return `${product.name} ${product.description ?? ""}`.toLowerCase().includes(q);
    }
    return true;
  });

  function run(fn: () => Promise<{ ok: boolean; message?: string } | null>) {
    startTransition(async () => {
      const result = await fn();
      if (result?.message) toast(result.message, result.ok ? "success" : "error");
      router.refresh();
    });
  }

  if (categories.length === 0 && products.length === 0) {
    return (
      <EmptyState
        icon="🍔"
        title="Add your menu sections first"
        description="Products live inside categories. Create a few sections such as Burgers, Drinks or Desserts, then come back."
        action={<LinkButton href="/dashboard/categories">Go to categories</LinkButton>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditing("new")}>
          <Icon.plus className="size-4" />
          Add product
        </Button>

        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Icon.search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by category"
          className="h-10 w-auto py-0"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="uncategorised">Uncategorised</option>
        </Select>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title="No products yet"
          description="Add your first dish or drink. You can give it several sizes, each with its own price."
          action={<Button onClick={() => setEditing("new")}>Add your first product</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing matches that filter" description="Try a different search or category." />
      ) : (
        <ul className="space-y-2">
          {visible.map((product) => {
            const index = products.findIndex((p) => p.id === product.id);
            const prices = product.product_variants.map((v) => Number(v.price));
            return (
              <li
                key={product.id}
                className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 sm:p-4"
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

                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                  {product.image_url ? (
                    <SmartImage src={product.image_url} alt="" sizes="112px" />
                  ) : (
                    <span className="grid h-full place-items-center text-ink-400">
                      <Icon.image className="size-5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-900">{product.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {product.category_id ? categoryName[product.category_id] : "Uncategorised"} ·{" "}
                    {product.product_variants.length} size
                    {product.product_variants.length === 1 ? "" : "s"}
                  </p>
                </div>

                <p className="hidden whitespace-nowrap text-sm font-medium text-ink-900 sm:block">
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
                  <Icon.edit className="size-4" />
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
