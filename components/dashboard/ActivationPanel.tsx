import Link from "next/link";
import { Badge } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import {
  PRICE_USD,
  SUPPORT_WHATSAPP_DISPLAY,
  SUPPORT_WHATSAPP_URL,
} from "@/lib/constants";
import type { Restaurant } from "@/lib/types";
import { absoluteUrl, formatDate } from "@/lib/utils";

export function StatusBadge({ status }: { status: Restaurant["status"] }) {
  if (status === "active") return <Badge tone="success">Active</Badge>;
  if (status === "suspended") return <Badge tone="danger">Suspended</Badge>;
  return <Badge tone="warning">Pending activation</Badge>;
}

export function ActivationPanel({ restaurant }: { restaurant: Restaurant }) {
  const menuUrl = absoluteUrl(`/${restaurant.slug}/menu`);

  if (restaurant.status === "active") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-emerald-900">
              <Icon.check className="size-5" />
              Your menu is live
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Activated {formatDate(restaurant.activated_at)} · anyone who scans your QR code sees
              your menu.
            </p>
            <p className="mt-2 break-all font-mono text-xs text-emerald-900/80">{menuUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${restaurant.slug}/menu`}
              target="_blank"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Icon.external className="size-4" />
              Open menu
            </Link>
            <Link
              href="/dashboard/qr-codes"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <Icon.qr className="size-4" />
              QR codes
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
            {suspended ? "Your menu is suspended" : "Menu status: Pending activation"}
          </p>
          <p className={`mt-1 text-sm ${suspended ? "text-red-800" : "text-amber-900"}`}>
            {suspended
              ? "Your public menu is hidden. Contact support to restore it."
              : `You can build your whole menu now. To make it public, send $${PRICE_USD} (one-time) and message us on WhatsApp — we activate your account manually.`}
          </p>
          <p className={`mt-2 text-sm font-medium ${suspended ? "text-red-900" : "text-amber-900"}`}>
            {SUPPORT_WHATSAPP_DISPLAY}
          </p>
        </div>
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-95"
        >
          <Icon.whatsapp className="size-4" />
          Contact support
        </a>
      </div>
    </div>
  );
}
