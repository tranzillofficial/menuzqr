"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/lib/actions/products";
import { createCategoryQuickAction } from "@/lib/actions/categories";
import { CatalogBrowser, CatalogSuggestions } from "./CatalogPicker";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Input, Select, Switch, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { currencySymbol } from "@/lib/utils";
import type { CatalogItem, Category, ProductWithVariants, Restaurant } from "@/lib/types";

type VariantDraft = {
  key: string;
  id?: string;
  name: string;
  price: string;
  is_active: boolean;
};

const newKey = () => Math.random().toString(36).slice(2);

function toDrafts(product: ProductWithVariants | null): VariantDraft[] {
  if (!product || product.product_variants.length === 0) {
    return [{ key: newKey(), name: "Regular", price: "", is_active: true }];
  }
  return [...product.product_variants]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      key: newKey(),
      id: v.id,
      name: v.name,
      price: String(v.price),
      is_active: v.is_active,
    }));
}

export function ProductEditor({
  restaurant,
  categories,
  product,
  onClose,
}: {
  restaurant: Restaurant;
  categories: Category[];
  product: ProductWithVariants | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [state, formAction] = useActionState(saveProductAction, null);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [ingredients, setIngredients] = useState(product?.ingredients ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? null);
  const [imageSource, setImageSource] = useState<"uploaded" | "library" | "none">(
    product?.image_source ?? "none"
  );
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [variants, setVariants] = useState<VariantDraft[]>(toDrafts(product));

  // Categories can be created inline, so the editor keeps its own list rather
  // than trusting the prop — the owner must never lose a half-filled form just
  // because a section was missing.
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [savingCategory, startCategory] = useTransition();

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);

  useEffect(() => {
    setCategoryList(categories);
  }, [categories]);

  function addCategory(name: string, thenSelect = true) {
    const clean = name.trim();
    if (!clean) return;
    startCategory(async () => {
      const result = await createCategoryQuickAction(clean);
      if (!result.ok || !result.category) {
        toast(result.message ?? "Could not add the category.", "error");
        return;
      }
      setCategoryList((list) =>
        list.some((c) => c.id === result.category!.id)
          ? list
          : [...list, result.category as Category]
      );
      if (thenSelect) setCategoryId(result.category.id);
      setNewCategoryName("");
      setAddingCategory(false);
      toast(result.message ?? "Category added.");
      router.refresh();
    });
  }

  /** Fills the form from a catalog entry. Nothing is saved until the owner submits. */
  function applyCatalogItem(item: CatalogItem) {
    setName(item.name);
    if (item.description) setDescription(item.description);
    if (item.ingredients) setIngredients(item.ingredients);
    if (item.image_url) {
      setImageUrl(item.image_url);
      setImageSource("library");
    }
    if (item.variants.length > 0) {
      setVariants(
        item.variants.map((v) => ({
          key: newKey(),
          name: v.name,
          price: v.price != null ? String(v.price) : "",
          is_active: true,
        }))
      );
    }
    if (item.category_name) {
      const match = categoryList.find(
        (c) => c.name.toLowerCase() === item.category_name!.toLowerCase()
      );
      if (match) setCategoryId(match.id);
      else setNewCategoryName(item.category_name);
    }
    setSuggestionsHidden(true);
    setCatalogOpen(false);
    toast(t("products.filledFromCatalog"), "info");
  }

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  const symbol = currencySymbol(restaurant.currency);

  const serialisedVariants = JSON.stringify(
    variants
      .filter((v) => v.name.trim())
      .map((v) => ({
        id: v.id,
        name: v.name.trim(),
        price: v.price.trim(),
        is_active: v.is_active,
      }))
  );

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((list) => list.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? t("products.editTitle") : t("products.new")}
      description={t("products.modalSub")}
      size="lg"
    >
      <form action={formAction} className="space-y-6">
        {product && <input type="hidden" name="id" value={product.id} />}
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="image_source" value={imageSource} />
        <input type="hidden" name="is_active" value={isActive ? "on" : ""} />
        <input type="hidden" name="variants" value={serialisedVariants} />
        <input type="hidden" name="category_id" value={categoryId} />

        {/* --- basics --- */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="p-name" className="text-sm font-medium text-ink-800">
                {t("products.name")} <span className="text-brand-600">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCatalogOpen(true)}
                  title="Browse the MenuzQR catalog"
                  aria-label="Browse the MenuzQR catalog"
                  className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M10 9v5" strokeLinecap="round" />
                    <circle cx="10" cy="6.4" r=".9" fill="currentColor" stroke="none" />
                  </svg>
                  {t("products.catalogBtn")}
                </button>
              </div>
            </div>
            <Input
              id="p-name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Crispy Chicken Burger"
            />
            {state?.fieldErrors?.name && (
              <p className="text-xs font-medium text-red-600">{state.fieldErrors.name}</p>
            )}

            {!suggestionsHidden && name.trim().length >= 2 && (
              <CatalogSuggestions
                query={name}
                onPick={applyCatalogItem}
                onDismiss={() => setSuggestionsHidden(true)}
              />
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="p-category" className="text-sm font-medium text-ink-800">
                {t("products.category")}
              </label>
              <button
                type="button"
                onClick={() => setAddingCategory((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                <Icon.plus className="size-3.5" />
                {t("products.newCategory")}
              </button>
            </div>

            <Select
              id="p-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t("products.uncategorised")}</option>
              {categoryList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            {addingCategory && (
              <div className="flex gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory(newCategoryName);
                    }
                  }}
                  placeholder="e.g. Burgers"
                  aria-label="New category name"
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                />
                <Button
                  type="button"
                  size="sm"
                  loading={savingCategory}
                  disabled={!newCategoryName.trim()}
                  onClick={() => addCategory(newCategoryName)}
                >
                  {t("common.add")}
                </Button>
              </div>
            )}

            {!addingCategory && newCategoryName && (
              <button
                type="button"
                onClick={() => addCategory(newCategoryName)}
                disabled={savingCategory}
                className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline disabled:opacity-60"
              >
                + {t("products.createSectionFor", { name: newCategoryName })}
              </button>
            )}

            <p className="text-xs text-ink-500">
              {t("products.newCategoryHint")}
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="p-description" className="text-sm font-medium text-ink-800">
                {t("products.description")}
              </label>
            </div>
            <Textarea
              id="p-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
              placeholder="Crispy chicken fillet, lettuce, pickles and our signature sauce."
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="p-ingredients" className="text-sm font-medium text-ink-800">
                {t("products.ingredients")}
              </label>
            </div>
            <Input
              id="p-ingredients"
              name="ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Chicken, lettuce, tomato, cheese, special sauce"
            />
            <p className="text-xs text-ink-500">{t("products.ingredientsHint")}</p>
          </div>
        </div>

        {/* --- variants --- */}
        <div className="rounded-2xl border border-ink-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">{t("products.sizesTitle")}</h3>
              <p className="text-xs text-ink-500">
                {t("products.sizesSub")}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setVariants((list) => [
                  ...list,
                  { key: newKey(), name: "", price: "", is_active: true },
                ])
              }
            >
              <Icon.plus className="size-3.5" />
              {t("products.addSize")}
            </Button>
          </div>

          <ul className="space-y-2">
            {variants.map((variant, index) => (
              <li key={variant.key} className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`Size ${index + 1} name`}
                  value={variant.name}
                  onChange={(e) => updateVariant(variant.key, { name: e.target.value })}
                  placeholder="Medium"
                  className="min-w-0 flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <div className="flex items-center rounded-xl border border-ink-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
                  <span className="ps-3 text-sm text-ink-500">{symbol}</span>
                  <input
                    aria-label={`Size ${index + 1} price`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={variant.price}
                    onChange={(e) => updateVariant(variant.key, { price: e.target.value })}
                    placeholder="0.00"
                    className="w-24 bg-transparent px-2 py-2 text-sm focus:outline-none"
                  />
                </div>
                <Switch
                  checked={variant.is_active}
                  label={`Show size ${index + 1}`}
                  onChange={(v) => updateVariant(variant.key, { is_active: v })}
                />
                <button
                  type="button"
                  aria-label={`Remove size ${index + 1}`}
                  disabled={variants.length === 1}
                  onClick={() =>
                    setVariants((list) => list.filter((v) => v.key !== variant.key))
                  }
                  className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                >
                  <Icon.trash className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          {state?.fieldErrors?.variants && (
            <p className="mt-2 text-xs font-medium text-red-600">{state.fieldErrors.variants}</p>
          )}
        </div>

        {/* --- image --- */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">{t("products.photo")}</p>
          <ImagePicker
            restaurantId={restaurant.id}
            kind="product"
            value={imageUrl}
            searchSeed={name}
            onChange={(url, source) => {
              setImageUrl(url);
              setImageSource(source);
            }}
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <Switch checked={isActive} onChange={setIsActive} label={t("categories.visibleOnMenu")} />
          <span className="text-sm text-ink-700">
            {isActive ? t("categories.visibleOnMenu") : t("categories.hiddenFromMenu")}
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <SubmitButton>{product ? t("common.saveChanges") : t("products.add")}</SubmitButton>
        </div>
      </form>

      <CatalogBrowser
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onPick={applyCatalogItem}
        seed={name}
      />
    </Modal>
  );
}
