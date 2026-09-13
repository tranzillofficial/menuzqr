"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addLibraryImageAction } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SmartImage } from "@/components/ui/SmartImage";
import { clearLibraryCache } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Toast";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { compressImage, formatBytes } from "@/lib/image";

const GROUPS = ["Food", "Drinks", "Desserts"];

export function LibraryUploader() {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [savings, setSavings] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "compressing" | "uploading">("idle");
  const [state, formAction] = useActionState(addLibraryImageAction, null);

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) {
      setUrl("");
      setSavings(null);
      clearLibraryCache();
      router.refresh();
    }
  }, [state, toast, router]);

  async function upload(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast("Choose a JPG, PNG, WebP or AVIF image.", "error");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast(`That image is over ${formatBytes(MAX_UPLOAD_BYTES)}.`, "error");
      return;
    }

    try {
      setPhase("compressing");
      const compressed = await compressImage(file, "library");
      setPhase("uploading");

      const supabase = createClient();
      const ext = compressed.file.type === "image/webp" ? "webp" : "jpg";
      const path = `library/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("menu-library")
        .upload(path, compressed.file, {
          cacheControl: "31536000",
          contentType: compressed.file.type,
        });
      if (error) throw error;

      const { data } = supabase.storage.from("menu-library").getPublicUrl(path);
      setUrl(data.publicUrl);
      setSavings(
        `${formatBytes(compressed.originalBytes)} → ${formatBytes(compressed.bytes)}` +
          (compressed.width ? ` · ${compressed.width}×${compressed.height}` : "")
      );
      toast("Uploaded. Now fill in the details below.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Upload failed.", "error");
    } finally {
      setPhase("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const busy = phase !== "idle";

  return (
    <Card>
      <CardHeader
        title="Add an image"
        description="Upload the file, then describe it. Images are resized and compressed before upload."
      />
      <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
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

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-dashed border-ink-300 bg-ink-50">
              {url ? (
                <SmartImage src={url} alt="" sizes="96px" />
              ) : (
                <span className="grid h-full place-items-center text-xs text-ink-400">Preview</span>
              )}
              {busy && (
                <div
                  className="absolute inset-0 grid place-items-center bg-white/80"
                  role="status"
                  aria-live="polite"
                >
                  <svg className="size-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>

            <div>
              <Button
                type="button"
                variant="secondary"
                loading={busy}
                onClick={() => fileRef.current?.click()}
              >
                {phase === "compressing"
                  ? "Optimising…"
                  : phase === "uploading"
                    ? "Uploading…"
                    : url
                      ? "Replace file"
                      : "Upload image file"}
              </Button>
              {savings && <p className="mt-1.5 text-xs text-ink-500">{savings}</p>}
            </div>
          </div>

          <input type="hidden" name="url" value={url} />
        </div>

        <Field label="Title" htmlFor="lib-title" required>
          <Input id="lib-title" name="title" required placeholder="Grilled Chicken Burger" />
        </Field>

        <Field label="Group" htmlFor="lib-group">
          <Select id="lib-group" name="group_name" defaultValue="Food">
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Category" htmlFor="lib-category" hint="Burgers, Pizza, Coffee…">
          <Input id="lib-category" name="category" placeholder="Burgers" />
        </Field>

        <Field label="Search keywords" htmlFor="lib-keywords" hint="Comma separated.">
          <Input id="lib-keywords" name="keywords" placeholder="burger, beef, sandwich" />
        </Field>

        <Field
          label="Licence"
          htmlFor="lib-license"
          required
          hint="Required. e.g. “Owned by MenuzQR”, “Unsplash License”, “Purchased — Envato #123”."
          className="sm:col-span-2"
        >
          <Input id="lib-license" name="license" required placeholder="Owned by MenuzQR" />
        </Field>

        <Field label="Attribution" htmlFor="lib-attribution" className="sm:col-span-2">
          <Input id="lib-attribution" name="attribution" placeholder="Photo by …" />
        </Field>

        <div className="flex justify-end sm:col-span-2">
          <SubmitButton disabled={!url || busy}>Add to library</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
