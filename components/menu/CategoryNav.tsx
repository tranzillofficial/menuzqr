"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function useActiveCategory(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    if (ids.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export function CategoryNav({
  categories,
  active,
  className,
  itemClassName,
  activeClassName,
}: {
  categories: { id: string; name: string }[];
  active: string;
  className?: string;
  itemClassName: string;
  activeClassName: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  if (categories.length < 2) return null;

  return (
    <div ref={railRef} className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)}>
      {categories.map((category) => (
        <a
          key={category.id}
          href={`#${category.id}`}
          data-cat={category.id}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(category.id)?.scrollIntoView({ behavior: "smooth" });
          }}
          className={cn(
            "whitespace-nowrap transition-colors",
            itemClassName,
            active === category.id && activeClassName
          )}
        >
          {category.name}
        </a>
      ))}
    </div>
  );
}
