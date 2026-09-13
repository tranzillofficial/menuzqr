"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { QrLabelPreview } from "./QrLabelPreview";
import {
  LABEL_SIZES,
  canvasToPngUrl,
  downloadUrl,
  renderQrLabel,
  type LabelSizeId,
  type QrLabelInput,
  type QrStyle,
} from "@/lib/qr-label";
import { downloadText, qrPngDataUrl, qrSvgString } from "./QrCode";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { EmptyState } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { QrTemplate, Restaurant, RestaurantTable } from "@/lib/types";

function toStyle(t: QrTemplate): QrStyle {
  return {
    layout: t.layout,
    bgColor: t.bg_color,
    panelColor: t.panel_color,
    accentColor: t.accent_color,
    textColor: t.text_color,
    qrColor: t.qr_color,
    headline: t.headline,
    ctaText: t.cta_text,
  };
}

function fileSafe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "qr";
}

export function QrStudio({
  restaurant,
  tables,
  templates,
  generalUrl,
}: {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  templates: QrTemplate[];
  generalUrl: string;
}) {
  const tableUrl = (code: string) => `${generalUrl}?t=${encodeURIComponent(code)}`;

  const toast = useToast();
  const [size, setSize] = useState<LabelSizeId>("medium");
  const [busy, setBusy] = useState(false);

  // Fall back to whatever designs exist: a scope with no template of its own
  // would otherwise render buttons that quietly do nothing.
  const generalTemplates = useMemo(() => {
    const scoped = templates.filter((t) => t.scope === "general" || t.scope === "both");
    return scoped.length > 0 ? scoped : templates;
  }, [templates]);

  const tableTemplates = useMemo(() => {
    const scoped = templates.filter((t) => t.scope === "table" || t.scope === "both");
    return scoped.length > 0 ? scoped : templates;
  }, [templates]);

  const [generalId, setGeneralId] = useState(generalTemplates[0]?.id ?? "");
  const [tableId, setTableId] = useState(tableTemplates[0]?.id ?? "");

  const generalTemplate = generalTemplates.find((t) => t.id === generalId) ?? generalTemplates[0];
  const tableTemplate = tableTemplates.find((t) => t.id === tableId) ?? tableTemplates[0];

  const exportWidth = LABEL_SIZES.find((s) => s.id === size)?.width ?? 1400;
  const activeTables = tables.filter((t) => t.is_active);

  const generalInput: Omit<QrLabelInput, "width"> | null = generalTemplate
    ? {
        url: generalUrl,
        title: restaurant.name,
        subtitle: restaurant.address,
        style: toStyle(generalTemplate),
      }
    : null;

  const tableInput = (table: RestaurantTable): Omit<QrLabelInput, "width"> | null =>
    tableTemplate
      ? {
          url: tableUrl(table.qr_token),
          title: restaurant.name,
          badge: table.label,
          style: toStyle(tableTemplate),
        }
      : null;

  async function download(input: Omit<QrLabelInput, "width">, filename: string) {
    setBusy(true);
    try {
      const canvas = await renderQrLabel({ ...input, width: exportWidth });
      downloadUrl(canvasToPngUrl(canvas), `${filename}.png`);
    } catch {
      toast("Could not generate that image.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function downloadAllTables() {
    if (activeTables.length === 0) return;
    setBusy(true);
    try {
      for (const table of activeTables) {
        const input = tableInput(table);
        if (!input) continue;
        const canvas = await renderQrLabel({ ...input, width: exportWidth });
        downloadUrl(canvasToPngUrl(canvas), `${fileSafe(restaurant.slug)}-${fileSafe(table.label)}.png`);
        await new Promise((r) => setTimeout(r, 320));
      }
      toast(`${activeTables.length} table cards downloaded.`);
    } catch {
      toast("Could not download all cards. Try one at a time.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPlain(url: string, filename: string, format: "png" | "svg") {
    setBusy(true);
    try {
      if (format === "png") {
        downloadUrl(await qrPngDataUrl(url, 1600), `${filename}.png`);
      } else {
        downloadText(await qrSvgString(url), `${filename}.svg`, "image/svg+xml");
      }
    } catch {
      toast("Could not generate that file.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="No QR designs available"
        description="Run supabase/002-upgrades.sql to install the built-in designs, or add one from the admin dashboard."
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* ---- size picker ---- */}
      <div className="print-hide flex flex-wrap items-center gap-2 rounded-2xl border border-ink-200 bg-white p-3">
        <span className="px-1 text-sm font-medium text-ink-700">Export size</span>
        {LABEL_SIZES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSize(option.id)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left transition-colors",
              size === option.id
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-ink-200 text-ink-600 hover:bg-ink-50"
            )}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="block text-[11px] opacity-70">{option.note}</span>
          </button>
        ))}
        <Button variant="secondary" className="ml-auto" onClick={() => window.print()}>
          <Icon.print className="size-4" />
          Print sheet
        </Button>
      </div>

      {/* ---- general QR ---- */}
      <section>
        <div className="print-hide mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Counter &amp; window label
          </h2>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {generalTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setGeneralId(t.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  generalTemplate?.id === t.id
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[320px_1fr] sm:items-start">
          {generalInput && (
            <div className="print-card overflow-hidden rounded-2xl border border-ink-200 bg-white p-3">
              <QrLabelPreview input={generalInput} previewWidth={320} />
            </div>
          )}

          <div className="print-hide space-y-4 rounded-2xl border border-ink-200 bg-white p-5">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Where to use it</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-600">
                <li>• Shop window, entrance and takeaway counter</li>
                <li>• Flyers and social posts</li>
                <li>• Anywhere the table number does not matter</li>
              </ul>
            </div>

            <p className="break-all rounded-lg bg-ink-50 px-3 py-2 font-mono text-xs text-ink-500">
              {generalUrl}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy}
                disabled={!generalInput}
                onClick={() => generalInput && download(generalInput, `${fileSafe(restaurant.slug)}-label`)}
              >
                <Icon.download className="size-4" />
                Download label
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => downloadPlain(generalUrl, `${fileSafe(restaurant.slug)}-qr`, "png")}
              >
                Plain QR (PNG)
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => downloadPlain(generalUrl, `${fileSafe(restaurant.slug)}-qr`, "svg")}
              >
                SVG
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- table QR ---- */}
      <section>
        <div className="print-hide mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Table cards
          </h2>
          <Link href="/dashboard/tables" className="text-sm text-brand-700 hover:underline">
            Manage tables
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {tableTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTableId(t.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  tableTemplate?.id === t.id
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                )}
              >
                {t.name}
              </button>
            ))}
            {activeTables.length > 0 && (
              <Button size="sm" variant="secondary" loading={busy} onClick={downloadAllTables}>
                <Icon.download className="size-3.5" />
                Download all ({activeTables.length})
              </Button>
            )}
          </div>
        </div>

        {tables.length === 0 ? (
          <div className="print-hide">
            <EmptyState
              icon="🪑"
              title="No tables yet"
              description="Create your tables and each one gets its own card here, ready for the print shop."
              action={
                <Link
                  href="/dashboard/tables"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white"
                >
                  <Icon.plus className="size-4" />
                  Create tables
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => {
              const input = tableInput(table);
              return (
                <div
                  key={table.id}
                  className="print-card overflow-hidden rounded-2xl border border-ink-200 bg-white p-3"
                >
                  {input && <QrLabelPreview input={input} previewWidth={300} />}
                  <div className="print-hide mt-3 flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-900">{table.label}</span>
                    {!table.is_active && (
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">
                        disabled
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-auto"
                      disabled={busy || !input}
                      onClick={() =>
                        input &&
                        download(input, `${fileSafe(restaurant.slug)}-${fileSafe(table.label)}`)
                      }
                    >
                      <Icon.download className="size-3.5" />
                      PNG
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
