"use client";

import { useEffect } from "react";
import { useT } from "@/components/i18n/I18nProvider";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-5">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-ink-900">{t("error.genericTitle")}</h1>
        <p className="mt-2 text-sm text-ink-500">
          {t("error.genericBody")}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-ink-900 px-5 text-sm font-medium text-white"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    </main>
  );
}
