"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Menu image with a skeleton and a fade-in.
 *
 * Everything below the fold loads lazily; only the header passes `priority`.
 * Stored files have immutable uuid names, so next/image can cache them hard.
 */
export function MenuImage({
  src,
  alt,
  className,
  sizes = "(max-width: 640px) 100vw, 400px",
  priority,
  rounded,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  rounded?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn("grid place-items-center bg-black/5 text-black/25", rounded, className)}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-7 opacity-40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="9.5" r="1.6" />
          <path d="m4 17 5-5 4 4 3-2 4 4" />
        </svg>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-black/5", rounded, className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-black/5" aria-hidden="true" />}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
