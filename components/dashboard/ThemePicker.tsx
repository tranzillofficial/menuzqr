"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMenuThemeAction } from "@/lib/actions/restaurant";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { useT } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { MENU_THEMES, type MenuThemeId } from "@/lib/constants";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Small CSS mockups. Close enough to recognise each design at a glance. */
function Preview({ theme }: { theme: MenuThemeId }) {
  if (theme === "elegant") {
    return (
      <div className="h-full bg-[#faf7f2] p-3">
        <div className="h-12 rounded-lg bg-gradient-to-br from-[#2f2a24] to-[#6b5c48]" />
        <div className="mx-auto -mt-4 size-8 rounded-full border-2 border-[#faf7f2] bg-[#d9cbb4]" />
        <div className="mx-auto mt-2 h-1.5 w-14 rounded bg-[#b9a88d]" />
        <div className="mx-auto mt-3 h-px w-8 bg-[#d9cbb4]" />
        <div className="mt-3 space-y-2">
          <div className="h-14 rounded-lg bg-[#e6ddcd]" />
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-10 rounded bg-[#5b5148]" />
            <div className="h-px flex-1 border-b border-dotted border-[#cfc0a6]" />
            <div className="h-1.5 w-5 rounded bg-[#5b5148]" />
          </div>
          <div className="h-1 w-24 rounded bg-[#cfc0a6]" />
        </div>
      </div>
    );
  }

  if (theme === "modern") {
    return (
      <div className="h-full bg-white p-3">
        <div className="h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700" />
        <div className="-mt-3 flex items-end gap-1.5">
          <div className="size-7 rounded-xl border-2 border-white bg-ink-800" />
          <div className="h-1.5 w-12 rounded bg-ink-800" />
        </div>
        <div className="mt-2.5 flex gap-1">
          <div className="h-3 w-9 rounded-full bg-ink-900" />
          <div className="h-3 w-7 rounded-full bg-ink-200" />
          <div className="h-3 w-8 rounded-full bg-ink-200" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-ink-200">
              <div className="relative h-8 bg-gradient-to-br from-brand-200 to-brand-300">
                <span className="absolute bottom-0.5 end-0.5 h-2 w-5 rounded bg-white/95" />
              </div>
              <div className="space-y-1 p-1">
                <div className="h-1 w-3/4 rounded bg-ink-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (theme === "minimal") {
    return (
      <div className="h-full bg-white p-3">
        <div className="flex items-center gap-1.5">
          <div className="size-6 rounded-lg bg-ink-200" />
          <div className="h-2 w-16 rounded bg-ink-800" />
        </div>
        <div className="mt-3 flex gap-3 border-b border-ink-100 pb-1.5">
          <div className="h-1.5 w-8 rounded bg-ink-800" />
          <div className="h-1.5 w-7 rounded bg-ink-200" />
          <div className="h-1.5 w-6 rounded bg-ink-200" />
        </div>
        <div className="mt-3 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-2/3 rounded bg-ink-500" />
                <div className="h-1 w-1/2 rounded bg-ink-200" />
              </div>
              <div className="h-px w-5 border-b border-dotted border-ink-300" />
              <div className="h-1.5 w-5 rounded bg-ink-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (theme === "noir") {
    return (
      <div className="h-full bg-[#0b0b0d] p-3">
        <div className="h-12 rounded-lg bg-[radial-gradient(120%_90%_at_50%_0%,#2b2118_0%,#0b0b0d_75%)]" />
        <div className="mx-auto -mt-5 size-7 rounded-full bg-[#1c1a17] ring-1 ring-[#c9a227]/50" />
        <div className="mx-auto mt-2 h-1 w-10 rounded bg-[#c9a227]" />
        <div className="mx-auto mt-1.5 h-1.5 w-16 rounded bg-white/80" />
        <div className="mx-auto mt-2 h-px w-10 bg-[#c9a227]/60" />
        <div className="mt-3 space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
              <div className="size-7 rounded bg-white/10" />
              <div className="flex-1 space-y-1 pt-1">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-10 rounded bg-white/70" />
                  <div className="ms-auto h-1.5 w-4 rounded bg-[#c9a227]" />
                </div>
                <div className="h-1 w-3/4 rounded bg-white/20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#fffbeb] p-3">
      <div className="rounded-b-2xl bg-[#0f766e] px-3 py-3 text-center">
        <div className="mx-auto size-7 rounded-xl border-2 border-white/80 bg-[#0d5f58]" />
        <div className="mx-auto mt-1.5 h-2 w-16 rounded bg-white" />
        <div className="mx-auto mt-1 h-1 w-12 rounded bg-white/50" />
      </div>
      <div className="mt-2 flex gap-1">
        <div className="h-3.5 w-10 rounded-lg bg-[#0f766e]" />
        <div className="h-3.5 w-8 rounded-lg border-2 border-[#0f766e]/20 bg-white" />
      </div>
      <div className="mt-2 rounded-xl bg-[#f59e0b]/25 px-2 py-1.5">
        <div className="h-1.5 w-12 rounded bg-[#1c1917]" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
            <div className="h-10 bg-gradient-to-br from-[#fde68a] to-[#fbbf24]" />
            <div className="space-y-1 p-1.5">
              <div className="h-1 w-3/4 rounded bg-ink-400" />
              <div className="h-2.5 w-8 rounded-full bg-[#0f766e]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemePicker({
  current,
  slug,
  isActive,
}: {
  current: MenuThemeId;
  slug: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [selected, setSelected] = useState<MenuThemeId>(current);
  const [pending, startTransition] = useTransition();

  const selectedName = t(`theme.${selected}.name` as TranslationKey);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_THEMES.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelected(theme.id)}
              aria-pressed={active}
              className={cn(
                "overflow-hidden rounded-2xl border-2 bg-white text-start transition-all",
                active
                  ? "border-brand-500 shadow-md ring-2 ring-brand-100"
                  : "border-ink-200 hover:border-ink-300 hover:shadow-sm"
              )}
            >
              <div className="relative h-48 border-b border-ink-100">
                <Preview theme={theme.id} />
                {current === theme.id && (
                  <span className="absolute end-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white shadow">
                    {t("design.current")}
                  </span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink-900">
                    {t(`theme.${theme.id}.name` as TranslationKey)}
                  </p>
                  {active && current !== theme.id && (
                    <Icon.check className="size-4 text-brand-600" />
                  )}
                  <span className="ms-auto flex gap-1" aria-hidden="true">
                    {theme.swatch.map((colour) => (
                      <span
                        key={colour}
                        className="size-3 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: colour }}
                      />
                    ))}
                  </span>
                </div>

                <p className="mt-1 text-xs font-medium text-brand-700">
                  {t("design.bestFor")}: {t(`theme.${theme.id}.tagline` as TranslationKey)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {t(`theme.${theme.id}.description` as TranslationKey)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="text-sm text-ink-600">{t("design.note")}</p>
        <div className="ms-auto flex flex-wrap gap-2">
          <Link
            href={`/${slug}/menu`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Icon.external className="size-4" />
            {isActive ? t("design.previewLive") : t("design.openLink")}
          </Link>
          <Button
            disabled={selected === current || pending}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateMenuThemeAction(selected);
                toast(result?.message ?? "Saved.", result?.ok ? "success" : "error");
                router.refresh();
              })
            }
          >
            {selected === current ? t("design.applied") : t("design.use", { name: selectedName })}
          </Button>
        </div>
      </div>
    </div>
  );
}
