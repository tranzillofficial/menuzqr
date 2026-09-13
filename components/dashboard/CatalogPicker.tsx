"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icons";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";

let cache: CatalogItem[] | null = null;
let inflight: Promise<CatalogItem[]> | null = null;

export async function loadCatalog(): Promise<CatalogItem[]> {
  if (cache) return cache;
  inflight ??= fetch("/api/catalog")
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((payload: { items?: CatalogItem[] }) => {
      cache = (payload.items ?? []).map((item) => ({
        ...item,
        variants: Array.isArray(item.variants) ? item.variants : [],
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
      }));
      return cache;
    })
    .catch(() => {
      inflight = null;
      return [] as CatalogItem[];
    });
  return inflight;
}

export function clearCatalogCache() {
  cache = null;
  inflight = null;
}

function haystack(item: CatalogItem) {
  return `${item.name} ${item.category_name ?? ""} ${item.cuisine ?? ""} ${item.keywords.join(" ")}`.toLowerCase();
}

export function matchCatalog(items: CatalogItem[], query: string, limit = 6) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);

  return items
    .map((item) => {
      const hay = haystack(item);
      const name = item.name.toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score += 6;
      else if (name.includes(q)) score += 4;
      for (const word of words) if (hay.includes(word)) score += 1;
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** Compact row used both inline and inside the browser modal. */
function CatalogRow({
  item,
  onPick,
  compact,
}: {
  item: CatalogItem;
  onPick: (item: CatalogItem) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className={cn(
        "flex w-full items-center gap-3 text-left transition-colors hover:bg-brand-50",
        compact ? "px-3 py-2" : "rounded-xl border border-ink-200 bg-white p-3"
      )}
    >
      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-ink-100">
        <SmartImage src={item.image_url} alt="" sizes="88px" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{item.name}</p>
        <p className="truncate text-xs text-ink-500">
          {[item.category_name, item.variants.map((v) => v.name).join(" · ")]
            .filter(Boolean)
            .join(" — ") || item.description}
        </p>
      </div>
      <span className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
        Use
      </span>
    </button>
  );
}

/** Dropdown of close matches, shown while the owner types a product name. */
export function CatalogSuggestions({
  query,
  onPick,
  onDismiss,
}: {
  query: string;
  onPick: (item: CatalogItem) => void;
  onDismiss: () => void;
}) {
  const [items, setItems] = useState<CatalogItem[] | null>(cache);

  useEffect(() => {
    let cancelled = false;
    void loadCatalog().then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => matchCatalog(items ?? [], query), [items, query]);
  if (matches.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-brand-100 bg-brand-50/70 px-3 py-2">
        <Icon.sparkles className="size-3.5 text-brand-600" />
        <span className="text-xs font-semibold text-brand-800">
          Similar items in the MenuzQR catalog
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-xs text-brand-700 underline-offset-2 hover:underline"
        >
          Hide
        </button>
      </div>
      <ul className="divide-y divide-ink-100">
        {matches.map((item) => (
          <li key={item.id}>
            <CatalogRow item={item} onPick={onPick} compact />
          </li>
        ))}
      </ul>
      <p className="border-t border-ink-100 px-3 py-2 text-[11px] text-ink-500">
        Picking one fills the form in. You can change everything before saving.
      </p>
    </div>
  );
}

/** Full catalog browser, opened from the ⓘ button. */
export function CatalogBrowser({
  open,
  onClose,
  onPick,
  seed,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: CatalogItem) => void;
  seed?: string;
}) {
  const [items, setItems] = useState<CatalogItem[] | null>(cache);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery(seed?.trim() ?? "");
  }, [open, seed]);

  useEffect(() => {
    if (!open || items) return;
    let cancelled = false;
    void loadCatalog().then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  const q = query.trim().toLowerCase();
  const list = (items ?? []).filter((item) => (q ? haystack(item).includes(q) : true));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="MenuzQR catalog"
      description="Ready-made items with description, ingredients, photo and sizes."
      size="lg"
    >
      <div className="relative mb-4">
        <Icon.search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="Search the catalog…"
          aria-label="Search the catalog"
          className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {items === null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-ink-100" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-500">
          {items.length === 0
            ? "The catalog is empty. Your MenuzQR admin fills this in."
            : `Nothing matched “${query}”.`}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.slice(0, 200).map((item) => (
            <li key={item.id}>
              <CatalogRow item={item} onPick={onPick} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
