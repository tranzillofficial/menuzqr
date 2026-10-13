"use client";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatMoney } from "@/lib/utils";
import { MenuImage } from "./MenuMedia";
import type { BusinessOffer } from "@/lib/types";
export function OfferCards({
  offers,
  currency,
  whatsapp,
  menuPath,
}: {
  offers: BusinessOffer[];
  currency: string;
  whatsapp?: string;
  menuPath: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const money = (v: number) => formatMoney(v, currency);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {offers.map((o) => {
        const text = `${o.title}\n${(o.bundle_items ?? []).map((i) => `${i.name} · ${i.variant_name} × ${i.quantity}`).join("\n")}\n${o.sale_price != null ? `${ar ? "سعر العرض" : "Offer price"}: ${money(Number(o.sale_price))}` : ""}`;
        return (
          <article
            id={`offer-${o.id}`}
            key={o.id}
            className="overflow-hidden rounded-2xl bg-white text-ink-900 ring-1 ring-black/[.05]"
          >
            {o.image_url && (
              <MenuImage
                src={o.image_url}
                alt={o.title}
                fit="cover"
                className="aspect-video w-full"
                sizes="(max-width:640px) 100vw, 500px"
              />
            )}
            <div className="space-y-3 p-4">
              <h2 className="text-lg font-semibold">{o.title}</h2>
              <p className="whitespace-pre-line text-sm text-ink-500">
                {o.description}
              </p>
              {o.sale_price != null && (
                <div className="flex flex-wrap items-center gap-3">
                  <del className="text-sm text-ink-400">
                    {money(Number(o.original_total ?? 0))}
                  </del>
                  <strong className="text-xl text-brand-700">
                    {money(Number(o.sale_price))}
                  </strong>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                    {ar ? "توفير" : "Save"}{" "}
                    {money(
                      Number(o.original_total ?? 0) - Number(o.sale_price),
                    )}
                  </span>
                </div>
              )}
              {(o.bundle_items ?? []).length > 0 && (
                <ul className="divide-y divide-ink-100 text-xs">
                  {o.bundle_items?.map((i) => (
                    <li
                      key={i.variant_id}
                      className="flex justify-between gap-3 py-2"
                    >
                      <span>
                        {i.name} · {i.variant_name}
                      </span>
                      <strong>× {i.quantity}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {whatsapp ? (
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"
                >
                  {ar
                    ? "استفسر عن العرض عبر واتساب"
                    : "Ask about this offer on WhatsApp"}
                </a>
              ) : (
                <Link
                  className="inline-flex min-h-10 items-center rounded-xl bg-brand-50 px-4 text-sm text-brand-700"
                  href={menuPath}
                >
                  {ar ? "عرض المنتجات" : "View products"}
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
