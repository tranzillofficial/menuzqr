"use client";

import { useState } from "react";
import { QrCode, downloadDataUrl, downloadText, qrPngDataUrl, qrSvgString } from "./QrCode";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";

export function QrCard({
  title,
  subtitle,
  url,
  filename,
  size = 180,
  highlight,
}: {
  title: string;
  subtitle?: string;
  url: string;
  filename: string;
  size?: number;
  highlight?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download(format: "png" | "svg") {
    setBusy(true);
    try {
      if (format === "png") {
        downloadDataUrl(await qrPngDataUrl(url, 1600), `${filename}.png`);
      } else {
        downloadText(await qrSvgString(url), `${filename}.svg`, "image/svg+xml");
      }
    } catch {
      toast("Could not generate that file.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`print-card flex flex-col items-center gap-3 rounded-2xl border bg-white p-5 text-center ${
        highlight ? "border-brand-300 ring-1 ring-brand-100" : "border-ink-200"
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>

      <QrCode value={url} size={size} alt={`QR code for ${title}`} />

      <p className="w-full truncate text-[11px] text-ink-400" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </p>

      <div className="print-hide flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => download("png")} loading={busy}>
          <Icon.download className="size-3.5" />
          PNG
        </Button>
        <Button size="sm" variant="ghost" onClick={() => download("svg")} disabled={busy}>
          SVG
        </Button>
      </div>
    </div>
  );
}

export function DownloadAllButton({
  items,
}: {
  items: { url: string; filename: string }[];
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="secondary"
      loading={busy}
      disabled={items.length === 0}
      onClick={async () => {
        setBusy(true);
        try {
          for (const item of items) {
            downloadDataUrl(await qrPngDataUrl(item.url, 1600), `${item.filename}.png`);
            await new Promise((r) => setTimeout(r, 320));
          }
          toast(`${items.length} QR codes downloaded.`);
        } catch {
          toast("Could not download all codes. Try downloading them one by one.", "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon.download className="size-4" />
      Download all ({items.length})
    </Button>
  );
}

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Icon.print className="size-4" />
      Print sheet
    </Button>
  );
}
