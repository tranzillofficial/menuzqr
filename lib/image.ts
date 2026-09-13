"use client";

import { IMAGE_PRESETS, type ImageRole } from "./constants";

export type CompressResult = {
  file: File;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
};

let webpSupport: boolean | null = null;

function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` applies the EXIF orientation, so phone photos aren't rotated.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari < 17 and a few Android browsers: fall through to <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function dimensionsOf(source: ImageBitmap | HTMLImageElement) {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

function renameTo(name: string, mimeType: string) {
  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const base = name.replace(/\.[^.]+$/, "").slice(0, 40) || "image";
  return `${base}.${ext}`;
}

/**
 * Downscales and re-encodes an image in the browser before it is uploaded.
 *
 * Falls back to the original file whenever anything is unsupported or the
 * re-encoded result would not actually be smaller — so an upload never fails
 * because compression did.
 */
export async function compressImage(
  file: File,
  role: ImageRole = "product"
): Promise<CompressResult> {
  const preset = IMAGE_PRESETS[role];
  const fallback: CompressResult = {
    file,
    originalBytes: file.size,
    bytes: file.size,
    width: 0,
    height: 0,
  };

  if (typeof document === "undefined" || !file.type.startsWith("image/")) {
    return fallback;
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await loadBitmap(file);
  } catch {
    return fallback;
  }

  const { width: srcWidth, height: srcHeight } = dimensionsOf(source);
  if (!srcWidth || !srcHeight) return fallback;

  const scale = Math.min(1, preset.maxEdge / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Flatten transparency onto white: JPEG has no alpha, and a menu photo on a
  // black background is a worse failure than a lost alpha channel.
  const mimeType = supportsWebp() ? "image/webp" : "image/jpeg";
  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(source, 0, 0, width, height);
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, preset.quality)
  );

  if (!blob || blob.size === 0 || blob.size >= file.size) {
    return { ...fallback, width: srcWidth, height: srcHeight };
  }

  return {
    file: new File([blob], renameTo(file.name, mimeType), {
      type: mimeType,
      lastModified: Date.now(),
    }),
    originalBytes: file.size,
    bytes: blob.size,
    width,
    height,
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
