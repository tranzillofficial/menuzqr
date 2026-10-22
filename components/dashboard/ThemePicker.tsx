"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMenuThemeAction } from "@/lib/actions/restaurant";
import { updateDemoMenuThemeAction } from "@/lib/actions/admin";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { useT, useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { MENU_THEMES, type MenuThemeId } from "@/lib/constants";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Render the actual menu at a phone width, isolated from dashboard breakpoints. */
function Preview({ theme, locale, title }: { theme: MenuThemeId; locale: string; title: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 390));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} aria-hidden="true" className="pointer-events-none relative aspect-[390/680] overflow-hidden bg-ink-50">
    {!loaded && <div className="absolute inset-0 animate-pulse bg-ink-100" />}
    <iframe title={title} src={`/preview/menu-theme/${theme}?lang=${locale}`} loading="lazy" tabIndex={-1}
      onLoad={() => setLoaded(true)} className="absolute left-0 top-0 border-0" scrolling="no"
      style={{ width: 390, height: 700, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
  </div>;
}

export function ThemePicker({
  current,
  slug,
  isActive,
  adminDemo = false,
}: {
  current: MenuThemeId;
  slug: string;
  isActive: boolean;
  adminDemo?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { locale } = useI18n();
  const l = (ar: string, en: string) => locale === "ar" ? ar : en;
  const [preview, setPreview] = useState<MenuThemeId | null>(null);
  const [selected, setSelected] = useState<MenuThemeId>(current);
  const [pending, startTransition] = useTransition();

  const selectedName = t(`theme.${selected}.name` as TranslationKey);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">{l("نفس المحتوى داخل كل قالب للمقارنة. افتح المعاينة لتصفح التصميم قبل تطبيقه.", "Compare each design with the same sample menu. Open a preview before applying.")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_THEMES.map((theme) => {
          const active = selected === theme.id;
          return (
            <article
              key={theme.id}
              className={cn(
                "min-w-0 overflow-hidden rounded-2xl border bg-white text-start transition-colors",
                active
                  ? "border-brand-500 shadow-md ring-2 ring-brand-100"
                  : "border-ink-200 hover:border-ink-300 hover:shadow-sm"
              )}
            >
              <button type="button" disabled={pending} onClick={() => setPreview(theme.id)} aria-label={`${l("معاينة", "Preview")} ${t(`theme.${theme.id}.name` as TranslationKey)}`} className="relative block w-full border-b border-ink-100 text-start focus-visible:outline-2 focus-visible:outline-brand-500">
                <Preview theme={theme.id} locale={locale} title={t(`theme.${theme.id}.name` as TranslationKey)} />
                {current === theme.id && (
                  <span className="absolute end-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white shadow">
                    {t("design.current")}
                  </span>
                )}
              </button>

              <div className="space-y-3 p-3.5">
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
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={() => setPreview(theme.id)} className="min-h-10 flex-1 rounded-lg border border-ink-200 px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand-500">{l("معاينة", "Preview")}</button>
                  <button type="button" disabled={pending} aria-pressed={active} onClick={() => setSelected(theme.id)} className={cn("min-h-10 flex-1 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-500", active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-800 hover:bg-ink-200")}>{active ? l("محدد", "Selected") : l("اختيار", "Select")}</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="sticky bottom-2 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm text-ink-600">{t("design.note")}</p>
        <div className="ms-auto flex flex-wrap gap-2">
          <Link
            href={`/${slug}/menu`}
            target="_blank" rel="noopener noreferrer"
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
                const result = adminDemo
                  ? await updateDemoMenuThemeAction(selected)
                  : await updateMenuThemeAction(selected);
                toast(result?.message ?? "Saved.", result?.ok ? "success" : "error");
                if (result?.ok) router.refresh();
              })
            }
          >
            {selected === current ? t("design.applied") : t("design.use", { name: selectedName })}
          </Button>
        </div>
      </div>
      <Modal open={preview !== null} onClose={() => setPreview(null)} size="md"
        title={`${l("معاينة", "Preview")} ${preview ? t(`theme.${preview}.name` as TranslationKey) : ""}`}
        description={l("معاينة تجريبية. اختيار القالب لا يحفظه حتى تضغط تطبيق.", "Sample preview. Select a design, then apply to save it.")}
        footer={<button type="button" disabled={pending} onClick={() => { if (preview) setSelected(preview); setPreview(null); }} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">{l("اختيار القالب", "Select design")}</button>}>
        {preview && <iframe key={`${preview}-${locale}`} title={l("معاينة المنيو كاملة", "Full menu preview")} src={`/preview/menu-theme/${preview}?lang=${locale}`} className="mx-auto block h-[min(62dvh,650px)] w-full max-w-[390px] rounded-xl border border-ink-200" />}
      </Modal>
    </div>
  );
}
