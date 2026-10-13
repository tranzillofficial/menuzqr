"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

function Camera({ onScan }: { onScan: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  useEffect(() => {
    callback.current = onScan;
  }, [onScan]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    let detected = false;
    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (!video.current) return;
        controls = await new BrowserMultiFormatReader().decodeFromStream(
          stream,
          video.current,
          (result, _error, scanControls) => {
            if (!result || cancelled || detected) return;
            detected = true;
            scanControls.stop();
            stream?.getTracks().forEach((track) => track.stop());
            callback.current(result.getText());
          },
        );
        if (cancelled || detected) controls.stop();
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancelled)
          setError(
            "اسمح باستخدام الكاميرا، أو اكتب الباركود يدويًا في البحث. Allow camera access, or enter the barcode in search.",
          );
      }
    }
    void start();
    return () => {
      cancelled = true;
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return (
    <div className="space-y-3">
      <video
        ref={video}
        muted
        playsInline
        className="aspect-[4/3] w-full rounded-xl bg-black object-cover"
      />
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p className="text-sm text-ink-600">
          وجّه الكاميرا نحو باركود المنتج أو QR يحتوي على الباركود. Point the
          camera at the product barcode.
        </p>
      )}
    </div>
  );
}

export function ProductBarcodeScanner({
  onScan,
  compact = false,
}: {
  onScan: (code: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { locale } = useI18n();
  const title =
    locale === "ar" ? "مسح الباركود بالكاميرا" : "Scan product barcode";
  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "secondary"}
        aria-label={title}
        title={title}
        className={compact ? "size-10 rounded-lg !px-0" : ""}
        onClick={() => setOpen(true)}
      >
        {compact ? (
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M5 12h14M8 8v8m4-8v8m4-8v8" />
          </svg>
        ) : (
          title
        )}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm">
        <Camera
          onScan={(code) => {
            setOpen(false);
            onScan(code);
          }}
        />
      </Modal>
    </>
  );
}
