"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icons";

/**
 * Lazy, skeleton-backed image for dashboard and admin lists.
 *
 * Every image the app stores lives in Supabase Storage under an immutable
 * uuid filename, so it is safe to let next/image optimise and cache it hard.
 */
export function SmartImage({
  src,
  alt,
  sizes = "200px",
  className,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={cn("grid h-full w-full place-items-center bg-ink-100 text-ink-400", className)}>
        <Icon.image className="size-5" />
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-ink-100" aria-hidden="true" />
      )}
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
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </>
  );
}
