"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { SmartImage } from "@/components/ui/SmartImage";
import { LibraryPickerField } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { clearLibraryCache } from "@/components/ui/ImagePicker";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { compressImage, formatBytes } from "@/lib/image";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * Picture field for the shared menu.
 *
 * Upload straight from here — every file is downscaled and re-encoded to WebP
 * in the browser before it reaches storage, because these photos are copied by
 * every restaurant that uses the shared menu, so their weight is multiplied
 * across the whole platform. The saving is shown, not assumed.
 */
export function CatalogImageField({
  value,
  onChange,
  seed = "",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  seed?: string;
}) {
  const t = useT();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "compressing" | "uploading">("idle");
  const [savings, setSavings] = useState<string | null>(null);

  async function upload(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast(t("image.wrongType"), "error");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast(t("image.tooBig", { size: formatBytes(MAX_UPLOAD_BYTES) }), "error");
      return;
    }

    try {
      setPhase("compressing");
      const compressed = await compressImage(file, "catalog");

      setPhase("uploading");
      const supabase = createClient();
      const ext = compressed.file.type === "image/webp" ? "webp" : "jpg";
      const path = `catalog/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("menu-library")
        .upload(path, compressed.file, {
          cacheControl: "31536000",
          contentType: compressed.file.type,
        });
      if (error) throw error;

      const { data } = supabase.storage.from("menu-library").getPublicUrl(path);
      onChange(data.publicUrl);
      clearLibraryCache();
      setSavings(
        `${formatBytes(compressed.originalBytes)} → ${formatBytes(compressed.bytes)}` +
          (compressed.width ? ` · ${compressed.width}×${compressed.height}` : "")
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : t("image.uploadFailed"), "error");
    } finally {
      setPhase("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50">
          {value ? (
            <SmartImage src={value} alt="" sizes="160px" />
          ) : (
            <span className="grid h-full place-items-center text-ink-400">
              <Icon.image className="size-5" />
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-white/80 text-[10px] font-medium text-ink-600">
              {phase === "compressing" ? t("image.compressing") : t("image.uploading")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Icon.plus className="size-4" />
            {t("image.upload")}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              {t("common.remove")}
            </Button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      {savings && (
        <p className="text-xs text-emerald-700">
          {t("image.compressed")} {savings}
        </p>
      )}

      <details className="text-xs text-ink-500">
        <summary className="cursor-pointer select-none">{t("image.orPickLibrary")}</summary>
        <div className="mt-2">
          <LibraryPickerField value={value} onChange={onChange} seed={seed} />
        </div>
      </details>
    </div>
  );
}
