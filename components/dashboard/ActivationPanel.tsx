import Link from "next/link";
import { Badge } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { getPlatformSettings } from "@/lib/platform";
import { getT } from "@/lib/i18n/server";
import type { Restaurant } from "@/lib/types";
import { absoluteUrl, formatDate } from "@/lib/utils";
import type { Translator } from "@/lib/i18n";

export function StatusBadge({
  status,
  t,
}: {
  status: Restaurant["status"];
  t: Translator;
}) {
  if (status === "active") return <Badge tone="success">{t("activation.statusActive")}</Badge>;
  if (status === "suspended") return <Badge tone="danger">{t("activation.statusSuspended")}</Badge>;
  return <Badge tone="warning">{t("activation.statusPending")}</Badge>;
}

export async function ActivationPanel({ restaurant }: { restaurant: Restaurant }) {
  const [platform, t] = await Promise.all([getPlatformSettings(), getT()]);
  const menuUrl = absoluteUrl(`/${restaurant.slug}/menu`);

  if (restaurant.status === "active") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-emerald-900">
              <Icon.check className="size-5" />
              {t("activation.liveTitle")}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {t("activation.liveBody")} · {formatDate(restaurant.activated_at)}
            </p>
            <p className="ltr-nums mt-2 break-all font-mono text-xs text-emerald-900/80">
              {menuUrl}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${restaurant.slug}/menu`}
              target="_blank"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Icon.external className="size-4" />
              {t("activation.openMenu")}
            </Link>
            <Link
              href="/dashboard/qr-codes"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <Icon.qr className="size-4" />
              {t("activation.qrCodes")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const suspended = restaurant.status === "suspended";

  return (
    <div
      className={`rounded-2xl border p-5 ${
        suspended ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p
            className={`flex items-center gap-2 text-base font-semibold ${
              suspended ? "text-red-900" : "text-amber-900"
            }`}
          >
            <Icon.clock className="size-5" />
            {suspended ? t("activation.suspendedTitle") : t("activation.pendingTitle")}
          </p>
          <p className={`mt-1 text-sm ${suspended ? "text-red-800" : "text-amber-900"}`}>
            {suspended
              ? t("activation.suspendedBody")
              : t("activation.pendingBody", { price: platform.priceUsd })}
          </p>
          {platform.activationNote && !suspended && (
            <p className="mt-2 text-sm text-amber-900/80">{platform.activationNote}</p>
          )}
          <p
            className={`ltr-nums mt-2 text-sm font-medium ${
              suspended ? "text-red-900" : "text-amber-900"
            }`}
          >
            {platform.supportWhatsappDisplay}
          </p>
        </div>
        <a
          href={platform.supportWhatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-95"
        >
          <Icon.whatsapp className="size-4" />
          {t("activation.contactSupport")}
        </a>
      </div>
    </div>
  );
}
