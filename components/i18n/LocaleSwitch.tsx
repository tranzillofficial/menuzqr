"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/lib/actions/locale";
import { useI18n } from "./I18nProvider";
import { LOCALES, LOCALE_LABEL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LocaleSwitch({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center rounded-xl p-0.5",
        tone === "dark" ? "bg-white/10" : "border border-ink-200 bg-white",
        className
      )}
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            disabled={pending || active}
            aria-pressed={active}
            onClick={() =>
              startTransition(async () => {
                await setLocaleAction(option);
                router.refresh();
              })
            }
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
              active
                ? tone === "dark"
                  ? "bg-white text-ink-900"
                  : "bg-ink-900 text-white"
                : tone === "dark"
                  ? "text-white/70 hover:text-white"
                  : "text-ink-500 hover:text-ink-900"
            )}
          >
            {LOCALE_LABEL[option]}
          </button>
        );
      })}
    </div>
  );
}
