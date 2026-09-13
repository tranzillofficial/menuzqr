"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

const OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 1,
  color: { dark: "#1c1917", light: "#ffffff" },
};

export async function qrPngDataUrl(value: string, width = 1200) {
  return QRCode.toDataURL(value, { ...OPTIONS, width });
}

export async function qrSvgString(value: string) {
  return QRCode.toString(value, { ...OPTIONS, type: "svg", width: 1200 });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Renders a QR code as an <img>. Falls back to a readable message on failure. */
export function QrCode({
  value,
  size = 220,
  className,
  alt,
}: {
  value: string;
  size?: number;
  className?: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    qrPngDataUrl(value, Math.max(size * 3, 600))
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="grid place-items-center rounded-lg bg-ink-100 p-3 text-center text-xs text-ink-500"
      >
        Could not render this QR code.
      </div>
    );
  }

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`animate-pulse rounded-lg bg-ink-100 ${className ?? ""}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
