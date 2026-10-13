"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { featureEnabled } from "@/lib/business-features";
import { moduleEnabled } from "@/lib/business-modules";
import { normalizeWhatsapp } from "@/lib/phone";
import { saveQrSettings } from "@/lib/actions/qr-settings";
import type { QrKind, QrPreferences, QrPreference } from "@/lib/qr-preferences";
import { QrLabelPreview } from "./QrLabelPreview";
import { qrSvgString, downloadText } from "./QrCode";
import {
  renderQrLabel,
  canvasToPngUrl,
  downloadUrl,
  type QrStyle,
} from "@/lib/qr-label";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Restaurant, RestaurantTable, QrTemplate } from "@/lib/types";
const styles: Record<QrPreference["theme"], QrStyle> = {
  simple: {
    layout: "square",
    bgColor: "#ffffff",
    panelColor: "#ffffff",
    accentColor: "#ea580c",
    textColor: "#171719",
    qrColor: "#171719",
  },
  cream: {
    layout: "square",
    bgColor: "#faf5e9",
    panelColor: "#ffffff",
    accentColor: "#ea580c",
    textColor: "#292524",
    qrColor: "#171719",
  },
  dark: {
    layout: "square",
    bgColor: "#171719",
    panelColor: "#ffffff",
    accentColor: "#fb923c",
    textColor: "#ffffff",
    qrColor: "#171719",
  },
};
export function QrStudio({
  restaurant,
  tables,
  templates,
  generalUrl,
  whatsapp = "",
  preferences = {},
}: {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  templates: QrTemplate[];
  generalUrl: string;
  whatsapp?: string;
  preferences?: QrPreferences;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const l = (a: string, b: string) => (ar ? a : b);
  const toast = useToast();
  const [state, action, saving] = useActionState(saveQrSettings, null);
  const [busy, setBusy] = useState(false);
  const types = (
    [
      {
        id: "menu",
        cap: "qr_menu",
        title: l("QR المنيو", "Menu QR"),
        sub: l("رابط المنيو الرقمي", "Your digital menu"),
        icon: Icon.receipt,
      },
      {
        id: "whatsapp",
        cap: "qr_whatsapp",
        title: l("QR واتساب", "WhatsApp QR"),
        sub: l("للتواصل المباشر", "Direct contact"),
        icon: Icon.phone,
      },
      {
        id: "table",
        cap: "qr_tables",
        title: l("QR الطاولات", "Table QR"),
        sub: l("كود مستقل لكل طاولة", "One code per table"),
        icon: Icon.table,
      },
    ] as const
  ).filter((t) => featureEnabled(restaurant, t.cap)&&(t.id!=="table"||tables.some(table=>table.is_active)));
  const [selectedKind, setKind] = useState<QrKind>(types[0]?.id ?? "menu");
  const kind=types.some(t=>t.id===selectedKind)?selectedKind:types[0]?.id??"menu";
  const activeTables = tables.filter((t) => t.is_active);
  const [tableId, setTableId] = useState(activeTables[0]?.id ?? "");
  const table = activeTables.find((t) => t.id === tableId);
  const [drafts, setDrafts] = useState<QrPreferences>(preferences);
  const pref = drafts[kind] ?? {
    title: restaurant.name,
    subtitle:
      kind === "menu"
        ? l("المنيو الرقمي", "Digital menu")
        : kind === "whatsapp"
          ? l("تواصل معنا", "Contact us")
          : l("امسح الكود للطلب", "Scan to order"),
    theme: "cream",
    template_id: kind !== "whatsapp" ? (restaurant.qr_template_id ?? "") : "",
  };
  const design = featureEnabled(restaurant, "qr_design"),
    exports = featureEnabled(restaurant, "qr_exports");
  const phone = normalizeWhatsapp(whatsapp);
  const menuUrl = new URL(generalUrl);
  if (kind === "table" && table) menuUrl.searchParams.set("t", table.qr_token);
  const url =
    kind === "whatsapp"
      ? /^[1-9]\d{7,14}$/.test(phone)
        ? `https://wa.me/${phone}`
        : ""
      : kind === "table" && !table
        ? ""
        : menuUrl.toString();
  const availableTemplates = templates.filter((t) =>
    kind === "table" ? t.scope !== "general" : t.scope !== "table",
  );
  const selectedTemplate = availableTemplates.find(
    (t) => t.id === pref.template_id,
  );
  const style: QrStyle = selectedTemplate
    ? {
        layout: selectedTemplate.layout,
        bgColor: selectedTemplate.bg_color,
        panelColor: selectedTemplate.panel_color,
        accentColor: selectedTemplate.accent_color,
        textColor: selectedTemplate.text_color,
        qrColor: selectedTemplate.qr_color,
      }
    : styles[pref.theme];
  const input = {
    url,
    title: pref.title,
    subtitle: pref.subtitle,
    badge: kind === "table" ? table?.label : undefined,
    style: {
      ...style,
      headline: "",
      ctaText:
        kind === "menu"
          ? l("امسح الكود لعرض المنيو", "Scan to view the menu")
          : kind === "whatsapp"
            ? l("تواصل معنا عبر واتساب", "Chat with us on WhatsApp")
            : l("امسح الكود للطلب", "Scan to order"),
    },
  };
  function change(patch: Partial<QrPreference>) {
    setDrafts((v) => ({ ...v, [kind]: { ...pref, ...patch } }));
  }
  async function download(format: "png" | "svg") {
    if (!url || !exports) return;
    setBusy(true);
    try {
      const name =
        `${restaurant.slug}-${kind}${table && kind === "table" ? "-" + table.label : ""}`.replace(
          /[^\p{L}\p{N}_-]/gu,
          "-",
        );
      if (format === "png")
        downloadUrl(
          canvasToPngUrl(await renderQrLabel({ ...input, width: 1600 })),
          name + ".png",
        );
      else downloadText(await qrSvgString(url), name + ".svg", "image/svg+xml");
    } catch {
      toast(l("تعذر إنشاء الملف.", "Could not generate the file."), "error");
    } finally {
      setBusy(false);
    }
  }
  if (!types.length)
    return (
      <p className="rounded-2xl bg-white p-5 text-sm">
        {l(
          "لا توجد أنواع QR مفعّلة. راجع إعدادات الحساب مع الأدمن.",
          "No QR types enabled. Check account configuration with your admin.",
        )}
      </p>
    );
  return (
    <div className="space-y-4">
      <nav
        aria-label={l("أنواع QR", "QR types")}
        className="print-hide grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 sm:grid-cols-3"
      >
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={kind === t.id}
            onClick={() => setKind(t.id)}
            className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-start ${kind === t.id ? "border-brand-300 bg-brand-50 text-brand-700" : "border-transparent text-ink-600"}`}
          >
            <t.icon className="size-5 shrink-0" />
            <span>
              <strong className="block text-[13px]">{t.title}</strong>
              <span className="hidden text-[11px] text-ink-500 sm:block">
                {t.sub}
              </span>
            </span>
          </button>
        ))}
      </nav>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="print-card order-first rounded-2xl bg-white p-3 ring-1 ring-black/[.04] lg:order-last sm:p-5">
          <div className="mx-auto max-w-[300px] overflow-hidden rounded-2xl">
            {url ? (
              <QrLabelPreview input={input} previewWidth={300} />
            ) : (
              <div className="grid aspect-square place-items-center bg-ink-50 p-5 text-center text-sm text-ink-500">
                {kind === "whatsapp"
                  ? l(
                      "أضف رقم واتساب من الإعدادات.",
                      "Add your WhatsApp number in Settings.",
                    )
                  : l("لا توجد طاولات مفعّلة.", "No active tables.")}
              </div>
            )}
          </div>
          <fieldset disabled={!design || saving} className="print-hide mt-4">
            <legend className="mb-2 text-xs font-semibold">
              {l("نمط التصميم", "Design style")}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(["simple", "cream", "dark"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={pref.theme === theme && !pref.template_id}
                  onClick={() => change({ theme, template_id: "" })}
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border text-xs ${pref.theme === theme && !pref.template_id ? "border-brand-300 bg-brand-50 text-brand-700" : "border-ink-100"}`}
                >
                  <span
                    className="size-4 rounded-full ring-1 ring-ink-200"
                    style={{ background: styles[theme].bgColor }}
                  />
                  {l(
                    { simple: "بسيط", cream: "كريمي", dark: "داكن" }[theme],
                    theme,
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
        <section className="print-hide rounded-2xl bg-white p-3 ring-1 ring-black/[.04] sm:p-5">
          <h2 className="mb-2 text-sm font-semibold">
            {types.find((t) => t.id === kind)?.title} ·{" "}
            {l("الإعدادات", "Settings")}
          </h2>
          <form action={action} key={kind} className="space-y-4">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="theme" value={pref.theme} />
            <input
              type="hidden"
              name="template_id"
              value={pref.template_id ?? ""}
            />
            {kind === "table" && (
              <label className="block text-xs font-medium">
                {l("اختيار الطاولة", "Select table")}
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="mt-2 h-10 w-full rounded-xl border border-ink-100 bg-white px-3 text-sm"
                >
                  {activeTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Link
                  className="mt-2 inline-block text-xs text-brand-700"
                  href="/dashboard/tables"
                >
                  {l("إدارة الطاولات", "Manage tables")}
                </Link>
              </label>
            )}
            {kind === "whatsapp" && (
              <div className="rounded-xl bg-ink-50 p-3 text-xs">
                <span dir="ltr">
                  {phone
                    ? `+${phone}`
                    : l("لم يتم إضافة رقم", "No number configured")}
                </span>
                {moduleEnabled(restaurant, "settings") && (
                  <Link
                    className="ms-3 text-brand-700"
                    href="/dashboard/settings"
                  >
                    {l("تعديل الرقم", "Edit number")}
                  </Link>
                )}
              </div>
            )}
            <label className="block text-xs font-medium">
              {l("اسم المنشأة في الكود", "Business label")}
              <Input
                name="title"
                value={pref.title}
                maxLength={80}
                minLength={2}
                required
                readOnly={!design}
                onChange={(e) => change({ title: e.target.value })}
                className="mt-2 h-10 text-sm"
              />
            </label>
            <label className="block text-xs font-medium">
              {l("نص توضيحي (اختياري)", "Caption (optional)")}
              <Input
                name="subtitle"
                value={pref.subtitle}
                maxLength={100}
                readOnly={!design}
                onChange={(e) => change({ subtitle: e.target.value })}
                className="mt-2 h-10 text-sm"
              />
            </label>
            {design && availableTemplates.length > 0 && (
              <details className="rounded-xl bg-ink-50 p-3 text-xs">
                <summary className="cursor-pointer">
                  {l("تصاميم إضافية", "Additional designs")}
                </summary>
                <select
                  aria-label={l("تصميم إضافي", "Additional design")}
                  value={pref.template_id ?? ""}
                  onChange={(e) => change({ template_id: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg bg-white px-2 text-sm"
                >
                  <option value="">
                    {l("استخدام النمط المختار", "Use selected theme")}
                  </option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </details>
            )}
            <p
              className="break-all rounded-xl bg-ink-50 p-3 font-mono text-[11px] text-ink-500"
              dir="ltr"
            >
              {url || "—"}
            </p>
            {state?.message && (
              <p role="status" className="text-xs">
                {state.message}
              </p>
            )}
            {design && (
              <Button type="submit" disabled={saving} className="w-full">
                {saving
                  ? l("جاري الحفظ…", "Saving…")
                  : l("حفظ التصميم", "Save design")}
              </Button>
            )}
          </form>
          {exports && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button disabled={!url || busy} onClick={() => download("png")}>
                <Icon.download className="size-4" />
                PNG
              </Button>
              <Button
                variant="secondary"
                disabled={!url || busy}
                onClick={() => download("svg")}
              >
                SVG{" "}
                <span className="text-[10px]">{l("(الكود)", "(code)")}</span>
              </Button>
              <Button
                variant="secondary"
                disabled={!url}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast(l("تم نسخ الرابط", "Link copied"));
                  } catch {
                    toast(
                      l(
                        "تعذر النسخ. انسخ الرابط يدويًا.",
                        "Copy the displayed link manually.",
                      ),
                      "error",
                    );
                  }
                }}
              >
                {l("نسخ الرابط", "Copy link")}
              </Button>
              <Button
                variant="secondary"
                disabled={!url}
                onClick={() => window.print()}
              >
                <Icon.print className="size-4" />
                {l("طباعة", "Print")}
              </Button>
            </div>
          )}
        </section>
      </div>
      <div className="print-hide grid gap-3 sm:grid-cols-2">
        {types
          .filter((t) => t.id !== kind)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setKind(t.id)}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 text-start ring-1 ring-black/[.04]"
            >
              <t.icon className="size-5 text-brand-600" />
              <span>
                <strong className="block text-sm">{t.title}</strong>
                <span className="text-xs text-ink-500">{t.sub}</span>
              </span>
              <span className="ms-auto text-brand-600">←</span>
            </button>
          ))}
      </div>
    </div>
  );
}
