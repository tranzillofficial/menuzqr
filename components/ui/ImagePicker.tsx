"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, type ImageRole } from "@/lib/constants";
import { compressImage, formatBytes } from "@/lib/image";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { Icon } from "./Icons";
import { SmartImage } from "./SmartImage";
import { useToast } from "./Toast";
import { useT } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type LibraryItem = {
  id: string;
  group_name: string;
  category: string;
  title: string;
  keywords: string[];
  url: string;
};

/** Session-level cache so reopening the picker never refetches. */
let libraryCache: LibraryItem[] | null = null;
let libraryPromise: Promise<LibraryItem[]> | null = null;

async function loadLibrary(): Promise<LibraryItem[]> {
  if (libraryCache) return libraryCache;
  libraryPromise ??= fetch("/api/library")
    .then((r) => (r.ok ? r.json() : { images: [] }))
    .then((payload: { images?: LibraryItem[] }) => {
      libraryCache = payload.images ?? [];
      return libraryCache;
    })
    .catch(() => {
      libraryPromise = null;
      return [] as LibraryItem[];
    });
  return libraryPromise;
}

/** Called after an admin changes the library so the picker picks it up. */
export function clearLibraryCache() {
  libraryCache = null;
  libraryPromise = null;
}

type Status = { phase: "idle" } | { phase: "compressing" } | { phase: "uploading"; note: string };

export function ImagePicker({
  restaurantId,
  kind,
  value,
  onChange,
  searchSeed = "",
  aspect = "square",
  allowLibrary = true,
}: {
  restaurantId: string;
  kind: ImageRole;
  value: string | null;
  onChange: (url: string | null, source: "uploaded" | "library" | "none") => void;
  /** Seeds the library search when the picker opens. */
  searchSeed?: string;
  aspect?: "square" | "wide";
  allowLibrary?: boolean;
}) {
  const toast = useToast();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [libraryOpen, setLibraryOpen] = useState(false);

  const busy = status.phase !== "idle";

  const upload = useCallback(
    async (file: File) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast("Please choose a JPG, PNG, WebP or AVIF image.", "error");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast(`That image is over ${formatBytes(MAX_UPLOAD_BYTES)}. Please pick a smaller one.`, "error");
        return;
      }

      try {
        setStatus({ phase: "compressing" });
        const compressed = await compressImage(file, kind);

        const saved =
          compressed.bytes < compressed.originalBytes
            ? `${formatBytes(compressed.originalBytes)} → ${formatBytes(compressed.bytes)}`
            : formatBytes(compressed.bytes);
        setStatus({ phase: "uploading", note: saved });

        const supabase = createClient();
        const ext = compressed.file.type === "image/webp" ? "webp" : "jpg";
        const path = `${restaurantId}/${kind}/${crypto.randomUUID()}.${ext}`;

        const { error } = await supabase.storage
          .from("restaurant-assets")
          .upload(path, compressed.file, {
            cacheControl: "31536000",
            contentType: compressed.file.type,
            upsert: false,
          });

        if (error) throw error;

        const { data } = supabase.storage.from("restaurant-assets").getPublicUrl(path);
        onChange(data.publicUrl, "uploaded");
        toast(`Image uploaded (${saved}).`);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Upload failed. Please try again.", "error");
      } finally {
        setStatus({ phase: "idle" });
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [kind, onChange, restaurantId, toast]
  );

  return (
    <div className="space-y-2.5">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50",
          aspect === "wide" ? "aspect-[16/7]" : "aspect-square max-w-44"
        )}
      >
        {value ? (
          <SmartImage src={value} alt="" sizes="320px" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-400">
            <Icon.image className="size-7" />
            <span className="text-xs">{t("common.no")}</span>
          </div>
        )}

        {busy && (
          <div
            className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-1.5 text-center">
              <svg className="size-6 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium text-ink-700">
                {status.phase === "compressing" ? "Optimising…" : "Uploading…"}
              </span>
              {status.phase === "uploading" && (
                <span className="text-[11px] text-ink-500">{status.note}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {value ? t("common.edit") : t("common.add")}
        </Button>
        {allowLibrary && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setLibraryOpen(true)}
            disabled={busy}
          >
            {t("admin.imageLibrary")}
          </Button>
        )}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null, "none")}
            disabled={busy}
          >
            {t("common.remove")}
          </Button>
        )}
      </div>

      <p className="text-xs text-ink-500">
        Photos are resized and compressed in your browser before upload, so your menu stays fast.
      </p>

      {allowLibrary && (
        <LibraryModal
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          seed={searchSeed}
          onPick={(url) => {
            onChange(url, "library");
            setLibraryOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LibraryModal({
  open,
  onClose,
  onPick,
  seed,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  seed: string;
}) {
  const t = useT();
  const [images, setImages] = useState<LibraryItem[] | null>(libraryCache);
  const [query, setQuery] = useState("");
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!open || images) return;
    let cancelled = false;
    void loadLibrary().then((list) => {
      if (!cancelled) setImages(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, images]);

  const haystackOf = (img: LibraryItem) =>
    `${img.title} ${img.category} ${img.group_name} ${(img.keywords ?? []).join(" ")}`.toLowerCase();

  const words = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9\u0600-\u06ff]+/)
      .filter((w) => w.length > 2);

  const q = query.trim().toLowerCase();

  // The search box starts empty on purpose. The product name is used to *rank*
  // matches to the top, never to hide everything else — an empty-looking
  // library was the single most confusing thing about the old behaviour.
  const seedWords = q ? [] : words(seed);
  const score = (img: LibraryItem) => {
    if (seedWords.length === 0) return 0;
    const hay = haystackOf(img);
    return seedWords.reduce((total, word) => total + (hay.includes(word) ? 1 : 0), 0);
  };

  const filtered = (images ?? [])
    .filter((img) => (q ? words(q).some((word) => haystackOf(img).includes(word)) || haystackOf(img).includes(q) : true))
    .map((img, index) => ({ img, index, rank: score(img) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.img);

  const suggestedCount = seedWords.length > 0 ? (images ?? []).filter((i) => score(i) > 0).length : 0;

  async function reload() {
    setReloading(true);
    clearLibraryCache();
    const list = await loadLibrary();
    setImages(list);
    setReloading(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("admin.imageLibrary")}
      description="Shared photos you can use on your menu — or upload your own instead."
      size="lg"
    >
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Icon.search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // The modal is portalled out of any surrounding <form>, but keep
              // this so a stray Enter can never submit the editor behind it.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Search food, drinks, desserts…"
            aria-label="Search the image library"
            className="w-full rounded-xl border border-ink-200 bg-white py-2.5 ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={reloading}
          className="rounded-xl border border-ink-200 px-3 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-60"
        >
          {reloading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>

      {suggestedCount > 0 && !q && (
        <p className="mb-3 text-xs text-brand-700">
          {suggestedCount} image{suggestedCount === 1 ? "" : "s"} matching “{seed}” shown first.
        </p>
      )}

      {images === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-ink-100" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-500">
          The shared library is empty for now. Upload your own photo instead — it will be
          optimised automatically.
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-500">
          Nothing matched “{query}”. Try a simpler word, or upload your own photo.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {filtered.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onPick(img.url)}
              className="group overflow-hidden rounded-xl border border-ink-200 bg-white text-start transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <div className="relative aspect-[4/3] bg-ink-50">
                <SmartImage src={img.url} alt={img.title} sizes="(max-width: 640px) 45vw, 200px" />
              </div>
              <div className="px-2.5 py-2">
                <p className="truncate text-xs font-medium text-ink-800">{img.title}</p>
                <p className="truncate text-[11px] text-ink-400">{img.category}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/**
 * Library-only picker, for places that must not upload into a restaurant's
 * folder — the shared product catalog, for instance.
 */
export function LibraryPickerField({
  value,
  onChange,
  seed = "",
  label,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  seed?: string;
  label?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50">
        {value ? (
          <SmartImage src={value} alt="" sizes="160px" />
        ) : (
          <span className="grid h-full place-items-center text-ink-400">
            <Icon.image className="size-5" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {value ? t("common.edit") : (label ?? t("admin.imageLibrary"))}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t("common.remove")}
          </Button>
        )}
      </div>

      <LibraryModal
        open={open}
        onClose={() => setOpen(false)}
        seed={seed}
        onPick={(url) => {
          onChange(url);
          setOpen(false);
        }}
      />
    </div>
  );
}
