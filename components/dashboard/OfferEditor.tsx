"use client";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { saveOffer } from "@/lib/actions/offers";
import { searchOfferProducts } from "@/lib/actions/offer-products";
import { featureEnabled } from "@/lib/business-features";
import { offerTotals } from "@/lib/offer-pricing";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { Input, Textarea, Switch } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SmartImage } from "@/components/ui/SmartImage";
import { Icon } from "@/components/ui/Icons";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ProductBarcodeScanner } from "./ProductBarcodeScanner";
import { CategoryPicker } from "./CategoryPicker";
import { formatMoney } from "@/lib/utils";
import type {
  BusinessOffer,
  Category,
  ProductWithVariants,
  Restaurant,
} from "@/lib/types";
type DraftLine = {
  variant_id: string;
  product_id: string;
  name: string;
  variant_name: string;
  price: number;
  quantity: number;
  image_url: string | null;
};
export function OfferEditor({
  restaurant,
  products,
  categories,
  offer,
  startDate = "",
  endDate = "",
  onClose,
}: {
  restaurant: Restaurant;
  products: ProductWithVariants[];
  categories: Category[];
  offer?: BusinessOffer;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const l = (a: string, b: string) => (ar ? a : b);
  const money = (v: number) => formatMoney(v, restaurant.currency);
  const formId = useId();
  const router = useRouter();
  const [state, action, pending] = useActionState(saveOffer, null);
  const [type, setType] = useState(
    offer?.offer_type ??
      (featureEnabled(restaurant, "offer_bundle")
        ? "bundle"
        : featureEnabled(restaurant, "offer_discount")
          ? "discount"
          : "promotion"),
  );
  const [image, setImage] = useState(offer?.image_url ?? null),
    [active, setActive] = useState(offer?.is_active ?? false),
    [allDay, setAllDay] = useState(offer?.all_day ?? true),
    [sale, setSale] = useState(String(offer?.sale_price ?? "")),
    [discountKind, setDiscountKind] = useState(
      offer?.discount_kind ?? "percent",
    ),
    [discountValue, setDiscountValue] = useState(
      String(offer?.discount_value ?? ""),
    );
  const [lines, setLines] = useState<DraftLine[]>(
    (offer?.bundle_items ?? []).map((i) => ({
      variant_id: i.variant_id,
      product_id: i.product_id ?? "",
      name: i.name ?? "",
      variant_name: i.variant_name ?? "",
      price: Number(i.unit_price ?? 0),
      quantity: i.quantity,
      image_url: i.image_url ?? null,
    })),
  );
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [picker, setPicker] = useState(!offer),
    [shown, setShown] = useState(products),
    [searchBusy, setSearchBusy] = useState(false),
    [searchError, setSearchError] = useState(""),
    [hasMore, setHasMore] = useState(products.length >= 24);
  const [, startScan] = useTransition();
  const initial = useRef(true);
  const totals = offerTotals(
    lines,
    type,
    Number(sale || 0),
    discountKind,
    Number(discountValue || 0),
  );
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchBusy(true);
      setSearchError("");
      try {
        const r = await searchOfferProducts(query, category);
        if (cancelled) return;
        if (r.ok) {
          setShown(r.products.slice(0, 24));
          setHasMore(r.hasMore);
        } else setSearchError(r.message);
      } catch {
        if (!cancelled) setSearchError("تعذر البحث. Could not search.");
      } finally {
        if (!cancelled) setSearchBusy(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, category]);
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);
  function add(
    p: ProductWithVariants,
    v: ProductWithVariants["product_variants"][number],
  ) {
    setLines((old) => {
      const found = old.find((i) => i.variant_id === v.id);
      if (found)
        return old.map((i) =>
          i.variant_id === v.id
            ? { ...i, quantity: Math.min(99, i.quantity + 1) }
            : i,
        );
      if (old.length >= 30) return old;
      return [
        ...old,
        {
          variant_id: v.id,
          product_id: p.id,
          name: p.name,
          variant_name: v.name,
          price: Number(v.price),
          quantity: 1,
          image_url: p.image_url,
        },
      ];
    });
  }
  function scan(code: string) {
    startScan(async () => {
      const r = await searchOfferProducts(code, "", true);
      if (!r.ok) {
        setSearchError(r.message);
        return;
      }
      if (!r.products.length) {
        setSearchError(
          l(
            "لم يتم العثور على منتج بهذا الباركود.",
            "No product matches this barcode.",
          ),
        );
        return;
      }
      const p = r.products[0],
        variants = p.product_variants.filter((v) => v.is_active);
      if (variants.length === 1) add(p, variants[0]);
      else {
        setShown([p]);
        setPicker(true);
        setSearchError(
          l("اختار وحدة البيع المطلوبة.", "Choose the selling option."),
        );
      }
    });
  }
  const types = [
    {
      id: "bundle",
      cap: "offer_bundle",
      label: l("باكدج / عرض مجمّع", "Bundle offer"),
    },
    { id: "discount", cap: "offer_discount", label: l("خصم", "Discount") },
    { id: "promotion", cap: null, label: l("بطاقة ترويجية", "Promotion card") },
  ].filter(
    (t) =>
      !t.cap ||
      featureEnabled(restaurant, t.cap as "offer_bundle" | "offer_discount") ||
      offer?.offer_type === t.id,
  );
  const card = "rounded-2xl bg-white p-3 ring-1 ring-black/[.04] sm:p-4";
  return (
    <Modal
      open
      workspace
      size="xl"
      title={
        offer ? l("تعديل العرض", "Edit offer") : l("إضافة عرض", "New offer")
      }
      onClose={onClose}
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            loading={pending}
            className="h-11 flex-1 sm:flex-none"
          >
            {l("حفظ العرض", "Save offer")}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {l("إلغاء", "Cancel")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        action={action}
        className="product-editor-fields space-y-3"
      >
        <input type="hidden" name="id" value={offer?.id ?? ""} />
        <input type="hidden" name="offer_type" value={type} />
        <input type="hidden" name="image_url" value={image ?? ""} />
        <input type="hidden" name="is_active" value={active ? "on" : ""} />
        <input type="hidden" name="all_day" value={allDay ? "on" : ""} />
        <input
          type="hidden"
          name="bundle_items"
          value={JSON.stringify(
            lines.map((i) => ({
              variant_id: i.variant_id,
              quantity: i.quantity,
            })),
          )}
        />
        {[
          ...new Set([
            ...(type === "promotion" ? (offer?.product_ids ?? []) : []),
            ...lines.map((i) => i.product_id),
          ]),
        ].map((id) => (
          <input key={id} type="hidden" name="product_ids" value={id} />
        ))}
        <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <section className={card}>
              <h3 className="mb-3 text-sm font-semibold">
                {l("نوع العرض", "Offer type")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={type === t.id}
                    onClick={() => setType(t.id as typeof type)}
                    className={`min-h-10 rounded-xl border px-3 text-xs ${type === t.id ? "border-brand-300 bg-brand-50 text-brand-700" : "border-ink-100"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>
            {featureEnabled(restaurant, "offer_schedule") && (
              <section className={card}>
                <h3 className="mb-3 text-sm font-semibold">
                  {l("مدة العرض", "Offer period")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs">
                    {l("بداية العرض", "Starts")}
                    <Input
                      name="starts_on"
                      type="date"
                      defaultValue={startDate}
                      className="mt-2"
                    />
                  </label>
                  <label className="text-xs">
                    {l("نهاية العرض", "Ends")}
                    <Input
                      name="ends_on"
                      type="date"
                      defaultValue={endDate}
                      className="mt-2"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-between text-xs">
                  <span>{l("طوال اليوم", "All day")}</span>
                  <Switch
                    label={l("طوال اليوم", "All day")}
                    checked={allDay}
                    onChange={setAllDay}
                  />
                </div>
                {!allDay && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Input
                      aria-label={l("وقت البداية", "Start time")}
                      name="starts_time"
                      type="time"
                      defaultValue={
                        offer?.starts_at
                          ? new Intl.DateTimeFormat("en-GB", {
                              timeZone: restaurant.business_timezone,
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                            }).format(new Date(offer.starts_at))
                          : "09:00"
                      }
                      required
                    />
                    <Input
                      aria-label={l("وقت النهاية", "End time")}
                      name="ends_time"
                      type="time"
                      defaultValue={
                        offer?.ends_at
                          ? new Intl.DateTimeFormat("en-GB", {
                              timeZone: restaurant.business_timezone,
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                            }).format(new Date(offer.ends_at))
                          : "22:00"
                      }
                      required
                    />
                  </div>
                )}
                <p className="mt-2 text-[11px] text-ink-500">
                  {restaurant.business_timezone}
                </p>
              </section>
            )}
          </aside>
          <section className={card}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">
                {l("معلومات العرض", "Offer information")}
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <span>{l("تفعيل العرض", "Publish offer")}</span>
                <Switch
                  label={l("تفعيل العرض", "Publish offer")}
                  checked={active}
                  onChange={setActive}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-xs">
                  {l("عنوان العرض", "Offer title")} *
                  <Input
                    name="title"
                    defaultValue={offer?.title ?? ""}
                    required
                    minLength={2}
                    maxLength={100}
                    className="mt-2"
                  />
                </label>
                <label className="block text-xs">
                  {l("وصف العرض", "Description")}
                  <Textarea
                    name="description"
                    defaultValue={offer?.description ?? ""}
                    maxLength={1200}
                    rows={3}
                    className="mt-2"
                  />
                </label>
              </div>
              {featureEnabled(restaurant, "offer_images") && (
                <div>
                  <p className="mb-2 text-xs">
                    {l("صورة العرض (اختيارية)", "Offer image (optional)")}
                  </p>
                  <ImagePicker
                    restaurantId={restaurant.id}
                    kind="cover"
                    aspect="wide"
                    allowLibrary={false}
                    chooseSource
                    value={image}
                    onChange={setImage}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {type === "bundle"
                ? l("إعدادات الباكدج", "Bundle items")
                : l("منتجات العرض", "Offer products")}
            </h3>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setPicker((v) => !v)}
              >
                <Icon.plus className="size-4" />
                {l("إضافة منتج", "Add product")}
              </Button>
              {featureEnabled(restaurant, "offer_barcode_scan") &&
                featureEnabled(restaurant, "product_barcode") && (
                  <ProductBarcodeScanner compact onScan={scan} />
                )}
            </div>
          </div>
          {!lines.length && (
            <p className="rounded-xl bg-ink-50 p-4 text-xs text-ink-500">
              {l(
                "اختار المنتجات ووحدات البيع من القائمة أدناه.",
                "Choose products and selling options below.",
              )}
            </p>
          )}
          <ul className="divide-y divide-ink-100">
            {lines.map((i) => (
              <li
                key={i.variant_id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_120px_110px_110px_40px]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                    <SmartImage src={i.image_url} alt="" sizes="40px" />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xs font-semibold">
                      {i.name}
                    </p>
                    <p className="text-[11px] text-ink-500">{i.variant_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={l(`تقليل ${i.name}`, `Decrease ${i.name}`)}
                    disabled={i.quantity <= 1}
                    onClick={() =>
                      setLines((old) =>
                        old.map((x) =>
                          x.variant_id === i.variant_id
                            ? { ...x, quantity: x.quantity - 1 }
                            : x,
                        ),
                      )
                    }
                    className="size-8 rounded-lg border border-ink-100"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center text-xs">
                    {i.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={l(`زيادة ${i.name}`, `Increase ${i.name}`)}
                    disabled={i.quantity >= 99}
                    onClick={() =>
                      setLines((old) =>
                        old.map((x) =>
                          x.variant_id === i.variant_id
                            ? { ...x, quantity: x.quantity + 1 }
                            : x,
                        ),
                      )
                    }
                    className="size-8 rounded-lg border border-ink-100"
                  >
                    +
                  </button>
                </div>
                <span className="text-[11px] text-ink-500">
                  {l("سعر الوحدة", "Unit")}: {money(i.price)}
                </span>
                <strong className="text-xs">
                  {money(i.price * i.quantity)}
                </strong>
                <button
                  type="button"
                  aria-label={l(`حذف ${i.name}`, `Remove ${i.name}`)}
                  className="grid size-8 place-items-center text-red-600"
                  onClick={() =>
                    setLines((old) =>
                      old.filter((x) => x.variant_id !== i.variant_id),
                    )
                  }
                >
                  <Icon.trash className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {type !== "promotion" && (
            <div className="mt-3 grid gap-3 border-t border-ink-100 pt-3 sm:grid-cols-4">
              <label className="text-xs">
                {type === "bundle"
                  ? l("سعر بيع الباكدج", "Bundle selling price")
                  : l("قيمة الخصم", "Discount value")}{" "}
                *
                <Input
                  name={type === "bundle" ? "sale_price" : "discount_value"}
                  type="number"
                  min="0"
                  max={
                    type === "bundle"
                      ? totals.original
                      : discountKind === "percent"
                        ? 100
                        : totals.original
                  }
                  step="0.01"
                  required
                  value={type === "bundle" ? sale : discountValue}
                  onChange={(e) =>
                    type === "bundle"
                      ? setSale(e.target.value)
                      : setDiscountValue(e.target.value)
                  }
                  className="mt-2"
                />
                {type === "discount" && (
                  <select
                    name="discount_kind"
                    value={discountKind}
                    onChange={(e) =>
                      setDiscountKind(e.target.value as typeof discountKind)
                    }
                    className="mt-2 h-10 w-full rounded-xl border border-ink-100 px-2 text-xs"
                  >
                    <option value="percent">{l("نسبة %", "Percent %")}</option>
                    <option value="fixed">
                      {l("مبلغ ثابت", "Fixed amount")}
                    </option>
                  </select>
                )}
              </label>
              <div className="rounded-xl bg-ink-50 p-3 text-xs">
                <p className="text-ink-500">
                  {l("الإجمالي الأصلي", "Original total")}
                </p>
                <strong className="mt-2 block text-base">
                  {money(totals.original)}
                </strong>
              </div>
              <div className="rounded-xl bg-brand-50 p-3 text-xs text-brand-700">
                <p>{l("سعر العرض", "Offer price")}</p>
                <strong className="mt-2 block text-base">
                  {money(totals.sale)}
                </strong>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                <p>{l("قيمة التوفير", "Saving")}</p>
                <strong className="mt-2 block text-base">
                  {money(totals.saving)}
                </strong>
              </div>
            </div>
          )}
        </section>
        {picker && (
          <section className={card}>
            <h3 className="mb-3 text-sm font-semibold">
              {l("اختيار المنتجات", "Choose products")}
            </h3>
            <div className="mb-3 flex gap-2">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (
                      /^\d{8,}$/.test(query) &&
                      featureEnabled(restaurant, "offer_barcode_scan") &&
                      featureEnabled(restaurant, "product_barcode")
                    )
                      scan(query);
                  }
                }}
                placeholder={l(
                  "بحث بالاسم أو الباركود",
                  "Search name or barcode",
                )}
                aria-label={l("بحث منتجات العرض", "Search offer products")}
              />
              <div className="w-36 shrink-0">
                <CategoryPicker
                  categories={categories}
                  value={category}
                  onChange={setCategory}
                  emptyLabel={l("الكل", "All")}
                />
              </div>
            </div>
            {searchBusy && (
              <p role="status" className="text-xs">
                {l("جاري البحث…", "Searching…")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {shown.map((p) => (
                <article
                  key={p.id}
                  className="min-w-0 rounded-xl border border-ink-100 p-2"
                >
                  <div className="relative mx-auto mb-2 size-14">
                    <SmartImage src={p.image_url} alt="" sizes="56px" />
                  </div>
                  <h4 className="line-clamp-2 text-xs font-semibold">
                    {p.name}
                  </h4>
                  {p.product_variants
                    .filter((v) => v.is_active)
                    .map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        disabled={
                          lines.length >= 30 &&
                          !lines.some((i) => i.variant_id === v.id)
                        }
                        onClick={() => add(p, v)}
                        className="mt-2 flex min-h-9 w-full flex-wrap justify-between gap-1 rounded-lg bg-brand-50 p-2 text-[11px] text-brand-700"
                      >
                        <span>
                          +{" "}
                          {p.product_variants.length > 1
                            ? v.name
                            : l("إضافة", "Add")}
                        </span>
                        <strong>{money(Number(v.price))}</strong>
                      </button>
                    ))}
                </article>
              ))}
            </div>
            {!shown.length && !searchBusy && (
              <p className="py-3 text-xs text-ink-500">
                {l("لا توجد نتائج.", "No results.")}
              </p>
            )}
            {hasMore && (
              <p className="mt-3 text-[11px] text-ink-500">
                {l(
                  "أول 24 نتيجة؛ ضيّق البحث للوصول لأي منتج.",
                  "First 24 results. Refine your search to find any product.",
                )}
              </p>
            )}
          </section>
        )}
        <p className="text-[11px] text-ink-500">
          {l(
            "يُطبّق العرض تلقائيًا في الكاشير عند اكتمال الأصناف والكميات، إذا كان الربط مفعّلًا للحساب.",
            "Automatically applied in POS when all items and quantities match, if enabled for this account.",
          )}
        </p>
        {(searchError || state?.message) && (
          <p role="status" className="rounded-xl bg-ink-50 p-3 text-xs">
            {searchError || state?.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
