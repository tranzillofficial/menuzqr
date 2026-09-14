"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icons";
import { SmartImage } from "@/components/ui/SmartImage";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/i18n/I18nProvider";
import { importCatalogItemsAction } from "@/lib/actions/catalog";
import { cn } from "@/lib/utils";
import type { CatalogCategory, CatalogItem } from "@/lib/types";

const UNFILED = "__unfiled__";

/**
 * The ready-made menu, as an owner meets it: browse by section, tick what
 * suits the place, copy it in. Everything copied is theirs to edit — the
 * wording here is careful to say so, because the alternative reading (that
 * their menu is somehow linked to ours) would be alarming.
 */
export function CatalogBrowser({
  categories,
  items,
  currency,
}: {
  categories: CatalogCategory[];
  items: CatalogItem[];
  /** The restaurant's own currency — the suggestion may be quoted in another. */
  currency: string;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // What the owner will actually charge. Seeded from the suggestion so the
  // box is never empty, but it is theirs to change before anything is copied.
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [publishNow, setPublishNow] = useState(false);

  const sections = useMemo(() => {
    const withItems = categories.filter((category) =>
      items.some((item) => item.category_id === category.id)
    );
    const unfiled = items.some((item) => !item.category_id);
    return { withItems, unfiled };
  }, [categories, items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeSection === UNFILED && item.category_id) return false;
      if (activeSection !== "all" && activeSection !== UNFILED && item.category_id !== activeSection)
        return false;
      if (!q) return true;
      return `${item.name} ${item.description ?? ""} ${item.category_name ?? ""} ${item.keywords.join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, query, activeSection]);

  const grouped = useMemo(() => {
    const byId = new Map<string, CatalogItem[]>();
    for (const item of visible) {
      const key = item.category_id ?? UNFILED;
      const list = byId.get(key) ?? [];
      list.push(item);
      byId.set(key, list);
    }
    const known = [...sections.withItems.map((c) => c.id), UNFILED];
    const leftovers = [...byId.keys()].filter((id) => !known.includes(id));
    const order = [...known, ...leftovers];

    return order
      .filter((id) => (byId.get(id)?.length ?? 0) > 0)
      .map((id) => ({
        id,
        name:
          id === UNFILED
            ? t("catalog.otherSection")
            : (categories.find((c) => c.id === id)?.name ?? t("catalog.otherSection")),
        description: id === UNFILED ? null : (categories.find((c) => c.id === id)?.description ?? null),
        items: byId.get(id) ?? [],
      }));
  }, [visible, sections.withItems, categories, t]);

  function seedPrice(item: CatalogItem) {
    setPrices((prev) =>
      prev[item.id] !== undefined
        ? prev
        : { ...prev, [item.id]: item.suggested_price ? String(item.suggested_price) : "" }
    );
  }

  function toggle(item: CatalogItem) {
    seedPrice(item);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function toggleSection(sectionItems: CatalogItem[]) {
    for (const item of sectionItems) seedPrice(item);
    setPicked((prev) => {
      const next = new Set(prev);
      const allPicked = sectionItems.every((item) => next.has(item.id));
      for (const item of sectionItems) {
        if (allPicked) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  function copy() {
    const chosen = [...picked].map((id) => ({
      id,
      price: Number(prices[id] ?? ""),
    }));
    startTransition(async () => {
      const result = await importCatalogItemsAction(chosen, publishNow);
      if (!result.ok) {
        toast(result.message ?? t("common.somethingWrong"), "error");
        return;
      }
      setPicked(new Set());
      toast(
        result.added
          ? t("catalog.copied", { count: result.added }) +
              (result.skipped ? ` · ${t("catalog.skipped", { count: result.skipped })}` : "")
          : (result.message ?? t("catalog.nothingNew")),
        "success"
      );
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="📖"
        title={t("catalog.emptyTitle")}
        description={t("catalog.emptyBody")}
      />
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* search + section filter */}
      <div className="space-y-3">
        <div className="relative">
          <Icon.search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("catalog.search")}
            aria-label={t("catalog.search")}
            className="h-11 w-full rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={activeSection === "all"} onClick={() => setActiveSection("all")}>
            {t("catalog.allSections")}
          </Chip>
          {sections.withItems.map((category) => (
            <Chip
              key={category.id}
              active={activeSection === category.id}
              onClick={() => setActiveSection(category.id)}
            >
              {category.name}
            </Chip>
          ))}
          {sections.unfiled && (
            <Chip active={activeSection === UNFILED} onClick={() => setActiveSection(UNFILED)}>
              {t("catalog.otherSection")}
            </Chip>
          )}
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState title={t("common.nothingMatched")} description={t("catalog.tryAnother")} />
      ) : (
        grouped.map((section) => {
          const allPicked = section.items.every((item) => picked.has(item.id));

          return (
            <section key={section.id}>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                  {section.name}
                </h2>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                  {section.items.length}
                </span>
                <button
                  type="button"
                  onClick={() => toggleSection(section.items)}
                  className="ms-auto text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
                >
                  {allPicked ? t("catalog.clearSection") : t("catalog.selectSection")}
                </button>
              </div>

              <ul className="grid gap-2.5 sm:grid-cols-2">
                {section.items.map((item) => {
                  const selected = picked.has(item.id);
                  const guide = item.suggested_price;
                  const range =
                    item.price_min && item.price_max
                      ? `${item.price_min}–${item.price_max}`
                      : null;

                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-2xl border bg-white transition-colors",
                        selected
                          ? "border-brand-400 ring-2 ring-brand-100"
                          : "border-ink-200 hover:border-ink-300"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        aria-pressed={selected}
                        className="flex w-full items-center gap-3 p-3 text-start"
                      >
                        <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                          <SmartImage src={item.image_url} alt="" sizes="128px" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">
                            {item.name}
                          </span>
                          {item.description && (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">
                              {item.description}
                            </span>
                          )}
                          {(guide || item.variants.length > 0) && (
                            <span className="ltr-nums mt-1 block truncate text-[11px] text-ink-400">
                              {item.variants.length > 0 &&
                                `${item.variants.map((variant) => variant.name).join(" · ")} · `}
                              {guide
                                ? t("catalog.suggested", {
                                    price: `${guide} ${item.suggested_currency ?? ""}`.trim(),
                                  })
                                : t("catalog.priceHint")}
                              {range ? ` (${range})` : ""}
                            </span>
                          )}
                        </span>

                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-lg border transition-colors",
                            selected
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-ink-300 text-transparent"
                          )}
                        >
                          <Icon.check className="size-4" />
                        </span>
                      </button>

                      {/* The price box only appears once the dish is picked —
                          84 always-visible inputs would be a wall of noise. */}
                      {selected && (
                        <label className="flex items-center gap-2 border-t border-ink-100 px-3 py-2.5">
                          <span className="text-xs font-medium text-ink-600">
                            {t("catalog.yourPrice")}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={prices[item.id] ?? ""}
                            onChange={(event) =>
                              setPrices((prev) => ({ ...prev, [item.id]: event.target.value }))
                            }
                            placeholder={guide ? String(guide) : "0"}
                            className="ltr-nums h-9 w-28 rounded-lg border border-ink-200 px-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                          />
                          <span className="text-xs text-ink-400">{currency}</span>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {/* Sticky action bar — the selection can span several sections, so the
          count has to stay in view while scrolling. */}
      {picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">
                {t("catalog.selected", { count: picked.size })}
              </p>
              <p className="truncate text-xs text-ink-500">
                {publishNow ? t("catalog.publishHint") : t("catalog.draftHint")}
              </p>
            </div>
            <label className="hidden shrink-0 items-center gap-2 text-xs text-ink-600 sm:flex">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(event) => setPublishNow(event.target.checked)}
                className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
              />
              {t("catalog.publishNow")}
            </label>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setPicked(new Set())}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={copy} loading={pending} className="shrink-0">
              <Icon.plus className="size-4" />
              {t("catalog.copyCta")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
        active ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
      )}
    >
      {children}
    </button>
  );
}
