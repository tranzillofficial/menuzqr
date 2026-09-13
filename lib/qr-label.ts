"use client";

import QRCode from "qrcode";

export type QrLayout = "counter" | "square" | "tent";

export type QrStyle = {
  layout: QrLayout;
  bgColor: string;
  panelColor: string;
  accentColor: string;
  textColor: string;
  qrColor: string;
  headline?: string | null;
  ctaText?: string | null;
};

export type QrLabelInput = {
  url: string;
  /** Restaurant name. */
  title: string;
  /** Optional line under the title — address, tagline… */
  subtitle?: string | null;
  /** Big badge, e.g. "Table 7". Only drawn by the `tent` layout. */
  badge?: string | null;
  style: QrStyle;
  /** Rendered width in pixels. Height follows the layout's aspect ratio. */
  width?: number;
};

const ASPECT: Record<QrLayout, number> = {
  counter: 1.3,
  square: 1,
  tent: 1.32,
};

export const LABEL_SIZES = [
  { id: "small", label: "Small", note: "~7 cm wide", width: 900 },
  { id: "medium", label: "Medium", note: "~10 cm wide", width: 1400 },
  { id: "large", label: "Large", note: "A5 / poster", width: 2100 },
] as const;

export type LabelSizeId = (typeof LABEL_SIZES)[number]["id"];

const FONT_STACK =
  '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draws centred text, shrinking it until it fits `maxWidth`. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  startSize: number,
  weight: number,
  color: string,
  letterSpacing = 0
) {
  let size = startSize;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const apply = () => {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${letterSpacing}px`;
    }
  };

  apply();
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    apply();
  }
  ctx.fillText(text, cx, y);

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }
  return size;
}

async function qrCanvas(url: string, px: number, dark: string, light: string) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: "Q",
    margin: 0,
    width: px,
    color: { dark, light },
  });
  return canvas;
}

/**
 * Renders a print-ready QR label onto a canvas.
 *
 * Everything is drawn by hand rather than rasterising DOM, so the output is
 * crisp at any export size and needs no extra dependency.
 */
export async function renderQrLabel(input: QrLabelInput): Promise<HTMLCanvasElement> {
  const { style } = input;
  const W = input.width ?? 1400;
  const H = Math.round(W * ASPECT[style.layout]);
  const s = W / 1000; // everything below is authored against a 1000px grid

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  ctx.fillStyle = style.bgColor;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const headline = (style.headline ?? "").toUpperCase();
  const cta = style.ctaText ?? "";

  if (style.layout === "square") {
    // ---- Clean square: title, QR, one line of instruction.
    let y = 130 * s;

    // A table card has to say which table it is, whatever the layout.
    if (input.badge) {
      const bw = 380 * s;
      const bh = 88 * s;
      ctx.fillStyle = style.accentColor;
      roundRect(ctx, cx - bw / 2, 48 * s, bw, bh, 22 * s);
      ctx.fill();
      fitText(ctx, input.badge.toUpperCase(), cx, 48 * s + bh / 2 + 16 * s, bw - 50 * s, 46 * s, 800, "#ffffff");
      y = 218 * s;
    }

    fitText(ctx, input.title, cx, y, 800 * s, input.badge ? 58 * s : 68 * s, 700, style.textColor);
    if (input.subtitle && !input.badge) {
      y += 42 * s;
      fitText(ctx, input.subtitle, cx, y, 760 * s, 26 * s, 400, style.textColor);
    }
    if (headline) {
      y += 50 * s;
      fitText(ctx, headline, cx, y, 760 * s, 28 * s, 600, style.accentColor, 3 * s);
    }

    const panel = 540 * s;
    const panelY = y + 44 * s;
    ctx.fillStyle = style.panelColor;
    roundRect(ctx, cx - panel / 2, panelY, panel, panel, 40 * s);
    ctx.fill();

    const qrPx = Math.round(panel - 80 * s);
    const qr = await qrCanvas(input.url, qrPx, style.qrColor, style.panelColor);
    ctx.drawImage(qr, cx - qrPx / 2, panelY + 40 * s, qrPx, qrPx);

    if (cta) {
      fitText(ctx, cta, cx, panelY + panel + 62 * s, 780 * s, 30 * s, 500, style.textColor);
    }
    fitText(ctx, "menuzqr.com", cx, H - 38 * s, 400 * s, 20 * s, 500, style.accentColor);
    return canvas;
  }

  if (style.layout === "tent") {
    // ---- Table tent: the table number is the loudest thing on the card.
    const badge = (input.badge ?? "").toUpperCase();
    if (badge) {
      const bw = 520 * s;
      const bh = 150 * s;
      ctx.fillStyle = style.accentColor;
      roundRect(ctx, cx - bw / 2, 90 * s, bw, bh, 28 * s);
      ctx.fill();
      fitText(ctx, badge, cx, 90 * s + bh / 2 + 26 * s, bw - 70 * s, 76 * s, 800, "#ffffff");
    }

    fitText(ctx, input.title, cx, 330 * s, 820 * s, 58 * s, 700, style.textColor);
    if (headline) {
      fitText(ctx, headline, cx, 386 * s, 780 * s, 28 * s, 600, style.accentColor, 3 * s);
    }

    const panel = 620 * s;
    const panelY = 440 * s;
    ctx.fillStyle = style.panelColor;
    roundRect(ctx, cx - panel / 2, panelY, panel, panel, 44 * s);
    ctx.fill();

    const qrPx = Math.round(panel - 90 * s);
    const qr = await qrCanvas(input.url, qrPx, style.qrColor, style.panelColor);
    ctx.drawImage(qr, cx - qrPx / 2, panelY + 45 * s, qrPx, qrPx);

    if (cta) {
      fitText(ctx, cta, cx, panelY + panel + 86 * s, 820 * s, 34 * s, 500, style.textColor);
    }
    fitText(ctx, "Powered by menuzqr.com", cx, H - 56 * s, 520 * s, 22 * s, 500, style.accentColor);
    return canvas;
  }

  // ---- Counter card (default): accent rule, name, QR panel, instruction.
  ctx.fillStyle = style.accentColor;
  ctx.fillRect(0, 0, W, 16 * s);

  let y = 190 * s;
  y = 190 * s;
  fitText(ctx, input.title, cx, y, 840 * s, 82 * s, 700, style.textColor);

  if (input.subtitle) {
    y += 56 * s;
    fitText(ctx, input.subtitle, cx, y, 780 * s, 30 * s, 400, style.textColor);
  }
  if (headline) {
    y += 60 * s;
    fitText(ctx, headline, cx, y, 780 * s, 32 * s, 600, style.accentColor, 4 * s);
  }

  const panel = 700 * s;
  const panelY = y + 55 * s;
  ctx.fillStyle = style.panelColor;
  roundRect(ctx, cx - panel / 2, panelY, panel, panel, 44 * s);
  ctx.fill();

  const qrPx = Math.round(panel - 90 * s);
  const qr = await qrCanvas(input.url, qrPx, style.qrColor, style.panelColor);
  ctx.drawImage(qr, cx - qrPx / 2, panelY + 45 * s, qrPx, qrPx);

  if (input.badge) {
    const bw = 300 * s;
    const bh = 84 * s;
    ctx.fillStyle = style.accentColor;
    roundRect(ctx, cx - bw / 2, panelY + panel - bh / 2, bw, bh, 22 * s);
    ctx.fill();
    fitText(ctx, input.badge.toUpperCase(), cx, panelY + panel + 14 * s, bw - 40 * s, 40 * s, 800, "#ffffff");
  }

  if (cta) {
    fitText(ctx, cta, cx, panelY + panel + (input.badge ? 130 * s : 96 * s), 840 * s, 34 * s, 500, style.textColor);
  }
  fitText(ctx, "menuzqr.com", cx, H - 60 * s, 420 * s, 24 * s, 500, style.accentColor);

  return canvas;
}

export function canvasToPngUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/png");
}

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
