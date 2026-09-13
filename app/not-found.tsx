import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-5">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm text-ink-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">{t("error.notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-ink-500">
          {t("error.notFoundBody")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-ink-900 px-5 text-sm font-medium text-white"
        >
          {t("error.backHome")}
        </Link>
      </div>
    </main>
  );
}
