"use client";

import {isAlhamd,packagingDraft,packagingName} from "@/lib/alhamd-units";
import { moduleEnabled } from "@/lib/business-modules";
import { CategoryPicker } from "./CategoryPicker";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/lib/actions/products";
import { createCategoryQuickAction } from "@/lib/actions/categories";
import { CatalogBrowser, CatalogSuggestions } from "./CatalogPicker";
import { VAT_CODES, vatRate } from "@/lib/tax";
import { useI18n, useT } from "@/components/i18n/I18nProvider";
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
  name_en?: string;
  boxes?: string;
  price: string;
  is_active: boolean;
};

const newKey = () => Math.random().toString(36).slice(2);

function toDrafts(product: ProductWithVariants | null, packaging = false): VariantDraft[] {
  if (!product || product.product_variants.length === 0) {
    return [{ key: newKey(), name: packaging ? "" : "Regular", boxes: "", price: "", is_active: true }];
  }
  return [...product.product_variants]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      key: newKey(),
      id: v.id,
      ...(packaging ? packagingDraft(v.name) : {name:v.name}),
      name_en: v.name_en ?? '',
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
  const { locale } = useI18n();
  const label = (ar: string, en: string) => locale === "ar" ? ar : en;
  const packaging = isAlhamd(restaurant);
  const [state, formAction] = useActionState(saveProductAction, null);

  const [name, setName] = useState(product?.name ?? "");
  const [nameEn, setNameEn] = useState(product?.name_en ?? '');
  const [description, setDescription] = useState(product?.description ?? "");
  const [ingredients, setIngredients] = useState(product?.ingredients ?? "");
  const categoryChoice = useRef(0);
  const [catalogSectionName,setCatalogSectionName] = useState("");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? null);
  const [imageSource, setImageSource] = useState<"uploaded" | "library" | "none">(
    product?.image_source ?? "none"
  );
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [variants, setVariants] = useState<VariantDraft[]>(toDrafts(product, packaging));

  // Categories can be created inline, so the editor keeps its own list rather
  // than trusting the prop. the owner must never lose a half-filled form just
  // because a section was missing.
  const [addedCategories, setAddedCategories] = useState<Category[]>([]);
  const categoryList = [...categories, ...addedCategories.filter(c => !categories.some(existing => existing.id === c.id))];
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [savingCategory, startCategory] = useTransition();

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);

  function addCategory(name: string, thenSelect = true, sourceId?: string | null) {
    const clean = name.trim();
    if (!clean) return;
    const choice = ++categoryChoice.current;
    startCategory(async () => {
      const result = await createCategoryQuickAction(clean,sourceId ?? undefined);
      if (choice !== categoryChoice.current) return;
      if (!result.ok || !result.category) {
        toast(result.message ?? "Could not add the category.", "error");
        return;
      }
      setAddedCategories((list) =>
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

  /** Fill the product draft and create/select its catalog section automatically. */
  function applyCatalogItem(item: CatalogItem) {
    categoryChoice.current += 1;
    setName(item.name);
    setNameEn(item.name_en ?? '');
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
          ...(packaging ? packagingDraft(v.name) : {name:v.name}),
          name_en: v.name_en ?? '',
          price: v.price != null ? String(v.price) : item.suggested_price != null ? String(item.suggested_price) : "",
          is_active: true,
        }))
      );
    } else {
      setVariants([{key:newKey(),name:packaging?'':'عادي',name_en:packaging?'':'Regular',price:item.suggested_price != null ? String(item.suggested_price) : '',is_active:true}]);
    }
    setCatalogSectionName(item.category_name ?? "");
    if (item.category_name) {
      const match = categoryList.find(
        (c) => (item.category_id && c.source_catalog_category_id === item.category_id) || c.name.trim().toLowerCase().replace(/\s+/g,' ') === item.category_name!.trim().toLowerCase().replace(/\s+/g,' ')
      );
      if (match) { setCategoryId(match.id);setAddingCategory(false);setNewCategoryName(""); }
      else {
        setCategoryId("");
        setNewCategoryName(item.category_name);
        setAddingCategory(true);
        addCategory(item.category_name,true,item.category_id);
      }
    } else { setCategoryId(""); }
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
        name: packaging ? packagingName(v.name,v.boxes ?? '') : v.name.trim(),
        name_en: packaging ? (v.name === 'علبة' ? 'Box' : `Carton (${v.boxes} boxes)`) : v.name_en?.trim() ?? '',
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
        <>{packaging && <><input type="hidden" name="name_en" value={nameEn}/><input type="hidden" name="ingredients" value={ingredients}/></>}</>
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="catalog_section_name" value={catalogSectionName}/><input type="hidden" name="image_source" value={imageSource} />
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
              {moduleEnabled(restaurant,"catalog") && <div className="flex flex-wrap gap-1.5">
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
              </div>}
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

            {moduleEnabled(restaurant,"catalog") && !suggestionsHidden && name.trim().length >= 2 && (
              <CatalogSuggestions
                query={name}
                onPick={applyCatalogItem}
                onDismiss={() => setSuggestionsHidden(true)}
              />
            )}
          </div>

          {!packaging && <>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="p-name-en" className="text-sm font-medium text-ink-800">{label('الاسم بالإنجليزية (اختياري)', 'English name (optional)')}</label>
            </div>
            <Input id="p-name-en" name="name_en" dir="ltr" maxLength={90} value={nameEn} onChange={e => setNameEn(e.target.value)}/>
          </div>
          </>}
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

            <CategoryPicker id="p-category" categories={categoryList} value={categoryId} emptyLabel={t("products.uncategorised")} onChange={id=>{categoryChoice.current+=1;setCategoryId(id);setCatalogSectionName("");}} />

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

          {!packaging && <>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="p-ingredients" className="text-sm font-medium text-ink-800">
                {t("products.ingredients")}
              </label>
            </div>
            <Textarea
              id="p-ingredients"
              name="ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder={t("products.ingredients")}
              maxLength={2000}
            />
            <p className="text-xs text-ink-500">{t("products.ingredientsHint")}</p>
          </div>
          </>}
        </div>

        <label className="block space-y-2 text-sm font-medium">{label('تصنيف ضريبة المنتج', 'Product VAT category')}
          <Select name="vat_code" defaultValue={product?.vat_code ?? 'standard'}>
            {VAT_CODES.map(code => <option key={code} value={code}>{code === 'exempt' ? label('معفى', 'Exempt') : code === 'zero' ? label('بدون ضريبة', 'Zero rated') : code === 'standard' ? label('الضريبة الأساسية', 'Standard VAT') : label('ضريبة مخفضة', 'Reduced VAT')} {code !== 'exempt' ? `${vatRate(restaurant.tax_mode === "none" && restaurant.currency === "EGP" ? "egypt" : restaurant.tax_mode, true, code,restaurant.tax_rates)}%` : ''}</option>)}
          </Select>
              <p className="mt-2 text-xs text-ink-500">{label("النسب حسب بلد النشاط وإعداداته. الضريبة لا تُحصّل إلا بعد اختيار البلد وتفعيل التسجيل الضريبي.","Rates follow the business country and settings. VAT is only charged when registration is enabled.")} {(!restaurant.vat_registered || restaurant.tax_mode==="none") && <strong>{label(" التحصيل الحالي: بدون ضريبة. "," Currently no VAT is charged. ")}</strong>} <a href="/dashboard/settings" className="text-brand-700 underline">{label("إعدادات الضريبة", "Tax settings")}</a></p>
          <span className="block text-xs font-normal text-ink-500">{label('اختار التصنيف حسب طبيعة المنتج وطريقة تقديمه. الأسعار', 'Choose the category for the product and how it is supplied. Prices are')} {restaurant.prices_include_vat ? label('شاملة الضريبة.', 'VAT inclusive.') : label('قبل الضريبة؛ الضريبة تضاف للإجمالي.', 'VAT exclusive; VAT is added to the total.')}</span>
        </label>
        {/* --- variants --- */}
        <div className="rounded-2xl border border-ink-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">{packaging ? label('وحدات البيع والأسعار','Units and prices') : t('products.sizesTitle')}</h3>
              <p className="text-xs text-ink-500">
                {packaging ? label('اختار علبة أو كرتونة، وحدد سعر كل وحدة.','Choose box or carton and set the unit price.') : t('products.sizesSub')}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={packaging && variants.length >= 2}
              onClick={() =>
                setVariants((list) => [
                  ...list,
                  { key: newKey(), name: "", price: "", is_active: true },
                ])
              }
            >
              <Icon.plus className="size-3.5" />
              {packaging ? label('إضافة وحدة بيع','Add selling unit') : t('products.addSize')}
            </Button>
          </div>

          <ul className="space-y-2">
            {variants.map((variant, index) => (
              <li key={variant.key} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl bg-ink-50 p-3 sm:grid-cols-2">
                {packaging ? <>
                  <label className="block min-w-0 space-y-1.5 text-sm font-medium">{label('وحدة البيع','Selling unit')}
                    <select required value={variant.name} onChange={e=>updateVariant(variant.key,{name:e.target.value,boxes:e.target.value==='كرتونة'?variant.boxes:''})} className="h-12 w-full rounded-xl border border-ink-200 bg-white px-3 text-base">
                      <option value="">{label('اختار الوحدة','Choose a unit')}</option><option value="علبة">{label('علبة','Box')}</option><option value="كرتونة">{label('كرتونة','Carton')}</option>
                    </select>
                  </label>
                  <label className="block min-w-0 space-y-1.5 text-sm font-medium">{label('سعر الوحدة','Unit price')} ({symbol})
                    <input required type="number" min="0" step="0.01" inputMode="decimal" value={variant.price} onChange={e=>updateVariant(variant.key,{price:e.target.value})} placeholder="0.00" className="h-12 w-full rounded-xl border border-ink-200 bg-white px-3 text-base"/>
                  </label>
                  {variant.name==='كرتونة'&&<label className="block min-w-0 space-y-1.5 text-sm font-medium sm:col-span-2">{label('عدد العلب في الكرتونة','Boxes per carton')}
                    <input required type="number" min="1" max="9999" step="1" inputMode="numeric" value={variant.boxes ?? ''} onChange={e=>updateVariant(variant.key,{boxes:e.target.value})} placeholder={label('مثال: 12','Example: 12')} className="h-12 w-full rounded-xl border border-ink-200 bg-white px-3 text-base"/>
                    <span className="block text-xs font-normal text-ink-600">{label('العدد للتوضيح، والسعر هو سعر الكرتونة بالكامل.','The price is for the whole carton.')}</span>
                  </label>}
                </> : <div className="grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
                <input
                  aria-label={`Size ${index + 1} name`}
                  value={variant.name}
                  onChange={(e) => updateVariant(variant.key, { name: e.target.value })}
                  placeholder="Medium"
                  className="min-w-0 flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <input aria-label={label(`اسم الحجم ${index + 1} بالإنجليزية`, `Size ${index + 1} English name`)} dir="ltr" maxLength={40} value={variant.name_en ?? ''} onChange={e => updateVariant(variant.key, {name_en:e.target.value})} placeholder={label('الاسم بالإنجليزية', 'English name')} className="min-w-0 flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm"/>
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
                    className="min-w-0 w-full bg-transparent px-2 py-3 text-base focus:outline-none"
                  />
                </div>
                </div>}

                <Switch
                  checked={variant.is_active}
                  label={packaging ? label(`إظهار الوحدة ${index+1}`,`Show unit ${index+1}`) : `Show size ${index + 1}`}
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
            allowLibrary={!packaging}
            chooseSource={packaging}
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
          <SubmitButton disabled={savingCategory}>{product ? t("common.saveChanges") : t("products.add")}</SubmitButton>
        </div>
      </form>

      {moduleEnabled(restaurant,"catalog") && <CatalogBrowser
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onPick={applyCatalogItem}
        seed={name}
      />}
    </Modal>
  );
}
