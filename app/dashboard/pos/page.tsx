import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { requireManager } from "@/lib/membership";
import { getPlatformSettings } from "@/lib/platform";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "POS" };

/**
 * The POS is not built yet. This page exists so the product has a home in the
 * navigation and a clear story — what it will do, what it costs, and how to
 * register interest — rather than a dead link or a surprise later.
 */
export default async function PosPage() {
  const [membership, platform, t] = await Promise.all([
    requireManager("/dashboard/pos"),
    getPlatformSettings(),
    getT(),
  ]);

  const active = membership.restaurant.pos_status === "active";

  const features: Array<{ icon: keyof typeof Icon; title: string; body: string }> = [
    { icon: "receipt", title: t("pos.f1Title"), body: t("pos.f1Body") },
    { icon: "table", title: t("pos.f2Title"), body: t("pos.f2Body") },
    { icon: "users", title: t("pos.f3Title"), body: t("pos.f3Body") },
    { icon: "arrowUp", title: t("pos.f4Title"), body: t("pos.f4Body") },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("pos.title")} description={t("pos.sub")} />

      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 bg-gradient-to-br from-brand-50 to-white p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-600 text-white">
            <Icon.receipt className="size-7" />
          </span>
          <p className="mt-4 text-lg font-semibold text-ink-900">
            {active ? t("pos.activeTitle") : t("pos.soonTitle")}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-600">
            {active ? t("pos.activeBody") : t("pos.soonBody")}
          </p>

          {!active && (
            <Link
              href="/dashboard/billing"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Icon.sparkles className="size-4" />
              {t("pos.cta", { price: platform.posMonthlyUsd })}
            </Link>
          )}
        </div>

        <ul className="grid gap-px bg-ink-100 sm:grid-cols-2">
          {features.map((feature) => {
            const FeatureIcon = Icon[feature.icon];
            return (
              <li key={feature.title} className="bg-white p-5">
                <FeatureIcon className="size-5 text-brand-600" />
                <p className="mt-2.5 text-sm font-semibold text-ink-900">{feature.title}</p>
                <p className="mt-1 text-sm text-ink-500">{feature.body}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="mt-4 text-center text-xs text-ink-400">{t("pos.note")}</p>
    </div>
  );
}
