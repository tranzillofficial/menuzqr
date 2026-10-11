"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

function Camera({ onScan }: { onScan: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  useEffect(() => { callback.current = onScan; }, [onScan]);
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
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        if (!video.current) return;
        controls = await new BrowserMultiFormatReader().decodeFromStream(stream, video.current, (result, _error, scanControls) => {
          if (!result || cancelled || detected) return;
          detected = true;
          scanControls.stop();
          stream?.getTracks().forEach(track => track.stop());
          callback.current(result.getText());
        });
        if (cancelled || detected) controls.stop();
      } catch {
        stream?.getTracks().forEach(track => track.stop());
        if (!cancelled) setError("اسمح باستخدام الكاميرا، أو اكتب الباركود يدويًا في البحث. Allow camera access, or enter the barcode in search.");
      }
    }
    void start();
    return () => { cancelled = true; controls?.stop(); stream?.getTracks().forEach(track => track.stop()); };
  }, []);
  return <div className="space-y-3"><video ref={video} muted playsInline className="aspect-[4/3] w-full rounded-xl bg-black object-cover"/>{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <p className="text-sm text-ink-600">وجّه الكاميرا نحو باركود المنتج أو QR يحتوي على الباركود. Point the camera at the product barcode.</p>}</div>;
}

export function ProductBarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const { locale } = useI18n();
  const title = locale === "ar" ? "مسح الباركود بالكاميرا" : "Scan product barcode";
  return <><Button variant="secondary" onClick={() => setOpen(true)}>{title}</Button><Modal open={open} onClose={() => setOpen(false)} title={title} size="sm"><Camera onScan={code => { setOpen(false); onScan(code); }}/></Modal></>;
}
