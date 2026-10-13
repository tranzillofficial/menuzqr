"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OfferEditor } from "./OfferEditor";
import { deleteOffer, unpublishOffer } from "@/lib/actions/offers";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/utils";
import type {
  BusinessOffer,
  Category,
  ProductWithVariants,
  Restaurant,
} from "@/lib/types";
export function OffersManager({
  restaurant,
  offers,
  products,
  categories,
}: {
  restaurant: Restaurant;
  offers: BusinessOffer[];
  products: ProductWithVariants[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState<BusinessOffer | "new" | null>(null);
  const [pending, start] = useTransition();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const toast = useToast();
  const l = (a: string, b: string) => (ar ? a : b);
  function run(fn: () => Promise<{ ok: boolean; message?: string } | null>) {
    start(async () => {
      try {
        const r = await fn();
        if (r?.message) toast(r.message, r.ok ? "success" : "error");
        router.refresh();
      } catch {
        toast(
          l("تعذر الاتصال. حاول مرة أخرى.", "Connection failed. Retry."),
          "error",
        );
      }
    });
  }
  function day(instant: string | null, end = false) {
    if (!instant) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: restaurant.business_timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(new Date(instant).getTime() - (end ? 1 : 0)));
  }
  return (
    <div className="space-y-4">
      <Button
        onClick={() => setEditing("new")}
        className="h-11 w-full sm:w-auto"
      >
        + {l("إضافة عرض", "Add offer")}
      </Button>
      {!offers.length && (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-ink-500">
          {l(
            "لا توجد عروض بعد. أضف باكدج أو خصمًا أو بطاقة ترويجية.",
            "No offers yet. Add a bundle, discount or promotion.",
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {offers.map((o) => (
          <article
            key={o.id}
            className="rounded-2xl bg-white p-4 ring-1 ring-black/[.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold">{o.title}</h2>
              <span
                className={`rounded-full px-2 py-1 text-[10px] ${o.is_active ? "bg-emerald-50 text-emerald-700" : "bg-ink-50 text-ink-500"}`}
              >
                {o.is_active ? l("مفعّل", "Published") : l("مسودة", "Draft")}
              </span>
            </div>
            <p className="my-2 line-clamp-2 text-xs text-ink-500">
              {o.description}
            </p>
            <p className="text-xs text-brand-700">
              {o.offer_type === "bundle"
                ? l("باكدج", "Bundle")
                : o.offer_type === "discount"
                  ? l("خصم", "Discount")
                  : l("بطاقة ترويجية", "Promotion")}
              {o.sale_price != null &&
                ` · ${formatMoney(Number(o.sale_price), restaurant.currency)}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditing(o)}
              >
                {l("تعديل", "Edit")}
              </Button>
              {o.is_active && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => unpublishOffer(o.id))}
                >
                  {l("إيقاف", "Unpublish")}
                </Button>
              )}
              <ConfirmButton
                title={l("حذف العرض؟", "Delete offer?")}
                message={l(
                  "سيتم إزالة العرض من المنيو.",
                  "This removes the offer from the menu.",
                )}
                confirmLabel={l("حذف", "Delete")}
                disabled={pending}
                onConfirm={() => run(() => deleteOffer(o.id))}
                className="min-h-8 rounded-lg px-3 text-xs text-red-600"
              >
                {l("حذف", "Delete")}
              </ConfirmButton>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <OfferEditor
          restaurant={restaurant}
          categories={categories}
          products={products}
          offer={editing === "new" ? undefined : editing}
          startDate={editing === "new" ? "" : day(editing.starts_at)}
          endDate={
            editing === "new"
              ? ""
              : day(editing.ends_at, editing.all_day !== false)
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
