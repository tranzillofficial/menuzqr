import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icons";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Access disabled", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where a staff account lands once the owner switches it off. Deliberately a
 * dead end: without this they would fall through to restaurant onboarding and
 * end up owning a brand new restaurant.
 */
export default async function DisabledPage() {
  const t = await getT();

  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-ink-100 text-ink-500">
          <Icon.shield className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink-900">{t("disabled.title")}</h1>
        <p className="mt-2 text-sm text-ink-500">{t("disabled.body")}</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Icon.logout className="size-4" />
            {t("common.signOut")}
          </button>
        </form>
      </div>
    </main>
  );
}
