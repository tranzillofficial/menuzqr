import Link from "next/link";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/constants";

export function MenuUnavailable({
  restaurantName,
  status,
  reason,
}: {
  restaurantName: string;
  status: "inactive" | "active" | "suspended";
  reason?: string;
}) {
  const message =
    reason ??
    (status === "suspended"
      ? "This menu is temporarily unavailable."
      : "This menu is not published yet.");

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-ink-100 text-3xl">
          🍽️
        </div>
        <h1 className="mt-5 text-xl font-semibold text-ink-900">{restaurantName}</h1>
        <p className="mt-2 text-sm text-ink-600">{message}</p>
        <p className="mt-1 text-sm text-ink-500">
          Please ask a member of staff for a printed menu.
        </p>

        <div className="mt-8 border-t border-ink-100 pt-6">
          <p className="text-xs text-ink-400">
            Are you the owner? Activate your MenuzQR account to publish this menu.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white"
            >
              WhatsApp {SUPPORT_WHATSAPP_DISPLAY}
            </a>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
