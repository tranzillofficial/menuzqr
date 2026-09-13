"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLibraryImageAction } from "@/lib/actions/admin";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { SmartImage } from "@/components/ui/SmartImage";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { clearLibraryCache } from "@/components/ui/ImagePicker";
import type { LibraryImage } from "@/lib/types";

export function LibraryImageCard({ image }: { image: LibraryImage }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <figure className="group relative overflow-hidden rounded-xl border border-ink-200">
      <div className="relative aspect-[4/3] bg-ink-50">
        <SmartImage src={image.url} alt={image.title} sizes="(max-width: 640px) 45vw, 200px" />
      </div>

      <figcaption className="px-2 py-1.5">
        <p className="truncate text-xs font-medium text-ink-800">{image.title}</p>
        <p className="truncate text-[11px] text-ink-400">
          {image.category}
          {image.license ? ` · ${image.license}` : ""}
        </p>
      </figcaption>

      <ConfirmButton
        title={`Remove "${image.title}"?`}
        message="It disappears from every restaurant's picker. Menus that already use it keep the image — the file itself is not deleted from storage."
        confirmLabel="Remove from library"
        disabled={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteLibraryImageAction(image.id);
            clearLibraryCache();
            toast(result?.message ?? "Removed.", result?.ok ? "success" : "error");
            router.refresh();
          })
        }
        className="absolute end-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-ink-500 opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Icon.trash className="size-4" />
      </ConfirmButton>
    </figure>
  );
}
