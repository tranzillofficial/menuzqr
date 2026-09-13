"use client";

import { useEffect, useRef, useState } from "react";
import { renderQrLabel, type QrLabelInput } from "@/lib/qr-label";

/**
 * Draws a label into a canvas sized for the screen. The download path
 * re-renders at the export width, so the preview stays cheap.
 */
export function QrLabelPreview({
  input,
  previewWidth = 380,
  className,
}: {
  input: Omit<QrLabelInput, "width">;
  previewWidth?: number;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const key = JSON.stringify(input);

  useEffect(() => {
    let cancelled = false;
    const node = holder.current;
    if (!node) return;

    setError(false);
    renderQrLabel({ ...input, width: previewWidth * 2 })
      .then((canvas) => {
        if (cancelled || !node) return;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.style.display = "block";
        node.replaceChildren(canvas);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
    // `key` captures every field of `input` that affects the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, previewWidth]);

  return (
    <>
      {error && (
        <div className="grid aspect-[1/1.3] place-items-center rounded-xl bg-ink-100 p-4 text-center text-xs text-ink-500">
          Could not draw this label.
        </div>
      )}
      {/* Kept mounted even while showing the error, so the next attempt has
          somewhere to draw. */}
      <div
        ref={holder}
        className={className}
        style={{ minHeight: error ? 0 : 80, display: error ? "none" : undefined }}
        aria-label="QR label preview"
      />
    </>
  );
}
