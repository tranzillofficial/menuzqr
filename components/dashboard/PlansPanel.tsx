"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/i18n/I18nProvider";
import {
  cancelPosRequestAction,
  previewCouponAction,
  requestPosAction,
  saveMenuCouponAction,
} from "@/lib/actions/billing";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { TranslationKey, Translator } from "@/lib/i18n";
import type { CouponPreview, Restaurant } from "@/lib/types";

type Target = "menu" | "pos";

/** Everything here is quoted in USD, whatever the restaurant's own currency. */
const money = (value: number) => formatMoney(value, "USD");

/**
 * The two things a restaurant pays for, side by side, with the bundle offer
 * made explicit rather than buried: taking POS drops the one-time menu fee.
 *
 * Nothing here charges anyone. There is no payment gateway — the owner gets a
 * quote and a WhatsApp link, and an admin switches things on once paid.
 */
export function PlansPanel({
  restaurant,
  menuPrice,
  menuBundlePrice,
  posMonthly,
  posYearly,
  posEnabled,
  whatsappUrl,
  whatsappDisplay,
}: {
  restaurant: Restaurant;
  menuPrice: number;
  menuBundlePrice: number;
  posMonthly: number;
  posYearly: number;
  posEnabled: boolean;
  whatsappUrl: string;
  whatsappDisplay: string;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [plan, setPlan] = useState<"monthly" | "yearly">(restaurant.pos_plan ?? "yearly");
  const [code, setCode] = useState(restaurant.coupon_code ?? "");
  const [checking, setChecking] = useState(false);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);

  const menuPaid = restaurant.status === "active";
  const posActive = restaurant.pos_status === "active";
  const posRequested = restaurant.pos_status === "requested";

  // The bundle price follows an ACTIVE subscription and nothing else. It used
  // to follow `requested` too — which an owner can set themselves — so the
  // quote dropped to the bundle price on a button click, and withdrawing the
  // request afterwards left them paying $8 for a $20 product.
  const takingPos = posActive;
  const effectiveMenuPrice = takingPos ? menuBundlePrice : menuPrice;
  const posPrice = plan === "monthly" ? posMonthly : posYearly;

  const discounted = (base: number, target: Target) => {
    if (!coupon?.valid) return base;
    if (coupon.appliesTo !== "both" && coupon.appliesTo !== target) return base;
    const off = coupon.kind === "percent" ? (base * coupon.value) / 100 : coupon.value;
    return Math.max(0, Math.round((base - off) * 100) / 100);
  };

  async function check(target: Target) {
    const trimmed = code.trim();
    if (!trimmed) {
      setCoupon(null);
      return;
    }
    setChecking(true);
    try {
      // A POS-only code handed to a restaurant that has not paid for the menu
      // would always be rejected if we only ever asked about one product.
      let result = await previewCouponAction(trimmed, target);
      if (!result.valid && result.reason === "wrong_product") {
        result = await previewCouponAction(trimmed, target === "menu" ? "pos" : "menu");
      }
      setCoupon(result);

      if (!result.valid) {
        toast(couponError(result.reason, t), "error");
        return;
      }
      const saved = await saveMenuCouponAction(trimmed);
      if (saved && !saved.ok) toast(saved.message ?? t("common.somethingWrong"), "error");
    } finally {
      setChecking(false);
    }
  }

  // Quote only what they are actually buying. Listing POS for someone who
  // never asked for it turned a $20 menu into a $40 message.
  const wantsPos = posRequested && !posActive;
  const menuLine = !menuPaid ? discounted(effectiveMenuPrice, "menu") : null;
  const posLine = wantsPos ? discounted(posPrice, "pos") : null;
  const total = (menuLine ?? 0) + (posLine ?? 0);

  const quote = [
    menuLine !== null ? `${t("plans.menuName")}: ${money(menuLine)}` : null,
    posLine !== null
      ? `${t("plans.posName")} (${t(plan === "monthly" ? "plans.monthly" : "plans.yearly")}): ${money(posLine)}`
      : null,
    coupon?.valid && code.trim() ? `${t("plans.coupon")}: ${code.trim().toUpperCase()}` : null,
    menuLine !== null || posLine !== null ? `${t("plans.total")}: ${money(total)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const whatsappHref = `${whatsappUrl}?text=${encodeURIComponent(
    `${t("plans.waIntro", { name: restaurant.name })}\n${quote || t("plans.waFallback")}`
  )}`;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------- QR menu (one-time) */}
      <Card className={cn("overflow-hidden", menuPaid && "border-emerald-200")}>
        <CardHeader
          title={t("plans.menuName")}
          description={t("plans.menuDesc")}
          action={
            menuPaid ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                <Icon.check className="size-3.5" />
                {t("plans.paid")}
              </span>
            ) : null
          }
        />
        <div className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="ltr-nums flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-ink-900">
                {money(discounted(effectiveMenuPrice, "menu"))}
              </span>
              {(takingPos || (coupon?.valid && discounted(effectiveMenuPrice, "menu") !== menuPrice)) && (
                <span className="text-lg text-ink-400 line-through">{money(menuPrice)}</span>
              )}
              <span className="text-sm text-ink-500">{t("plans.once")}</span>
            </p>
            {takingPos && !menuPaid && (
              <p className="mt-1 text-xs font-medium text-brand-700">{t("plans.bundleApplied")}</p>
            )}
          </div>
          <ul className="space-y-1 text-sm text-ink-600">
            {[t("plans.menuP1"), t("plans.menuP2"), t("plans.menuP3")].map((line) => (
              <li key={line} className="flex items-center gap-1.5">
                <Icon.check className="size-4 text-emerald-600" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        {!menuPaid && !takingPos && (
          <p className="border-t border-ink-100 bg-brand-50 px-5 py-3 text-sm text-brand-900">
            <strong>{t("plans.offerTitle", { bundle: menuBundlePrice })}</strong>{" "}
            {t("plans.offerBody", { bundle: menuBundlePrice, full: menuPrice })}
          </p>
        )}
      </Card>

      {/* ------------------------------------------------------ POS (monthly) */}
      <Card className={cn("overflow-hidden", posActive && "border-emerald-200")}>
        <CardHeader
          title={t("plans.posName")}
          description={t("plans.posDesc")}
          action={
            posActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                <Icon.check className="size-3.5" />
                {t("plans.active")}
              </span>
            ) : posRequested ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <Icon.clock className="size-3.5" />
                {t("plans.requested")}
              </span>
            ) : !posEnabled ? (
              <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600">
                {t("plans.comingSoon")}
              </span>
            ) : null
          }
        />

        <div className="p-5">
          {posActive ? (
            <p className="text-sm text-ink-600">
              {t("plans.posActiveBody", {
                plan: t(restaurant.pos_plan === "monthly" ? "plans.monthly" : "plans.yearly"),
              })}
              {restaurant.pos_expires_at
                ? ` · ${t("plans.renews", { date: formatDate(restaurant.pos_expires_at) })}`
                : ""}
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["monthly", "yearly"] as const).map((option) => {
                  const base = option === "monthly" ? posMonthly : posYearly;
                  const selected = plan === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPlan(option)}
                      aria-pressed={selected}
                      className={cn(
                        "rounded-2xl border p-4 text-start transition-colors",
                        selected
                          ? "border-brand-400 bg-brand-50 ring-2 ring-brand-100"
                          : "border-ink-200 hover:border-ink-300"
                      )}
                    >
                      <p className="text-sm font-medium text-ink-700">
                        {t(option === "monthly" ? "plans.monthly" : "plans.yearly")}
                      </p>
                      <p className="ltr-nums mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-semibold text-ink-900">
                          {money(discounted(base, "pos"))}
                        </span>
                        <span className="text-xs text-ink-500">
                          {t(option === "monthly" ? "plans.perMonth" : "plans.perYear")}
                        </span>
                      </p>
                      {option === "yearly" && (
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          {t("plans.yearlySaving", {
                            months: Math.max(0, Math.round(12 - posYearly / Math.max(posMonthly, 0.01))),
                          })}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <ul className="mt-4 grid gap-1.5 text-sm text-ink-600 sm:grid-cols-2">
                {[t("plans.posP1"), t("plans.posP2"), t("plans.posP3"), t("plans.posP4")].map(
                  (line) => (
                    <li key={line} className="flex items-center gap-1.5">
                      <Icon.check className="size-4 text-emerald-600" />
                      {line}
                    </li>
                  )
                )}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                {!posEnabled ? (
                  <p className="text-sm text-ink-500">{t("plans.notYet")}</p>
                ) : posRequested ? (
                  <Button
                    variant="secondary"
                    loading={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await cancelPosRequestAction();
                        if (result?.message) toast(result.message, result.ok ? "success" : "error");
                        router.refresh();
                      })
                    }
                  >
                    {t("plans.withdraw")}
                  </Button>
                ) : (
                  <Button
                    loading={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await requestPosAction(plan, code);
                        if (result?.message) toast(result.message, result.ok ? "success" : "error");
                        router.refresh();
                      })
                    }
                  >
                    <Icon.sparkles className="size-4" />
                    {t("plans.requestPos")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------------------ coupon */}
      <Card>
        <CardHeader title={t("plans.coupon")} description={t("plans.couponSub")} />
        <div className="flex flex-wrap items-end gap-2 p-5">
          <div className="min-w-40 flex-1">
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setCoupon(null);
              }}
              placeholder={t("plans.couponPlaceholder")}
              aria-label={t("plans.coupon")}
              maxLength={24}
              className="ltr-nums h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm uppercase tracking-wide focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Button variant="secondary" loading={checking} onClick={() => check(menuPaid ? "pos" : "menu")}>
            {t("plans.apply")}
          </Button>
        </div>
        {coupon?.valid && (
          <p className="border-t border-ink-100 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
            {coupon.kind === "percent"
              ? t("plans.couponPercent", { value: coupon.value })
              : t("plans.couponFixed", { value: coupon.value })}
          </p>
        )}
      </Card>

      {/* ------------------------------------------------------------- pay */}
      <Card className="bg-ink-50/60">
        <div className="p-5">
          <p className="text-sm text-ink-600">{t("plans.payNote")}</p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-white hover:brightness-95"
          >
            <Icon.whatsapp className="size-4" />
            <span className="ltr-nums">{whatsappDisplay}</span>
          </a>
        </div>
      </Card>
    </div>
  );
}

function couponError(reason: string, t: Translator): string {
  // Typed as TranslationKey so renaming a key is a compile error rather than a
  // toast that reads "plans.errUnavailable" to a customer.
  const map: Record<string, TranslationKey> = {
    unavailable: "plans.errUnavailable",
    wrong_product: "plans.errWrongProduct",
    throttled: "plans.errThrottled",
    unauthenticated: "plans.errSignedOut",
  };
  return t(map[reason] ?? "plans.errUnavailable");
}
