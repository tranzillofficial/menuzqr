"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCatalogCategoryAction,
  deleteCatalogItemAction,
  moveCatalogCategoryAction,
  saveCatalogCategoryAction,
  saveCatalogItemAction,
} from "@/lib/actions/admin";
import { clearCatalogCache } from "@/components/dashboard/CatalogPicker";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SmartImage } from "@/components/ui/SmartImage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { CatalogImageField } from "./CatalogImageField";
import { cn } from "@/lib/utils";
import type { CatalogCategory, CatalogItem } from "@/lib/types";

const UNFILED = "__unfiled__";

/**
 * The shared menu, as the admin builds it: sections in order, dishes inside
 * them. Restaurants browse this same structure at /dashboard/catalog and copy
 * what they want, so the order and the section names here are what they see.
 */
export function CatalogManager({
  categories,
  items,
}: {
  categories: CatalogCategory[];
  items: CatalogItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [editingItem, setEditingItem] = useState<CatalogItem | "new" | null>(null);
  const [newItemSection, setNewItemSection] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string } | null>) {
    startTransition(async () => {
      const result = await fn();
      if (result?.message) toast(result.message, result.ok ? "success" : "error");
      clearCatalogCache();
      router.refresh();
    });
  }

  const q = query.trim().toLowerCase();
  const matches = (item: CatalogItem) =>
    q
      ? `${item.name} ${item.category_name ?? ""} ${item.cuisine ?? ""} ${item.keywords.join(" ")}`
          .toLowerCase()
          .includes(q)
      : true;

  const sections = useMemo(() => {
    const list = categories.map((category) => ({
      category,
      items: items.filter((item) => item.category_id === category.id && matches(item)),
    }));
    const unfiled = items.filter((item) => !item.category_id && matches(item));
    return { list, unfiled };
    // `matches` closes over `q`, which is the only thing that changes it.
  }, [categories, items, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalShown =
    sections.list.reduce((sum, section) => sum + section.items.length, 0) + sections.unfiled.length;

  return (
    <div className="space-y-5">
      {/* toolbar — wraps to two rows on a phone instead of overflowing */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            setNewItemSection(categories[0]?.id ?? null);
            setEditingItem("new");
          }}
          className="flex-1 sm:flex-none"
        >
          <Icon.plus className="size-4" />
          Add dish
        </Button>
        <Button
          variant="secondary"
          onClick={() => setEditingCategory("new")}
          className="flex-1 sm:flex-none"
        >
          <Icon.grid className="size-4" />
          Add section
        </Button>

        <div className="relative order-last w-full sm:order-none sm:w-auto sm:min-w-56 sm:flex-1">
          <Icon.search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the shared menu…"
            aria-label="Search the shared menu"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <span className="hidden text-sm text-ink-500 sm:inline">
          {q ? `${totalShown} of ${items.length}` : `${items.length} dishes`}
        </span>
      </div>

      {categories.length === 0 && items.length === 0 ? (
        <EmptyState
          icon="📖"
          title="The shared menu is empty"
          description="Start with a section — Breakfast, Burgers, Coffee — then add the dishes inside it. Restaurants copy whole sections into their own menu in one tap."
          action={<Button onClick={() => setEditingCategory("new")}>Add the first section</Button>}
        />
      ) : (
        <div className="space-y-4">
          {sections.list.map(({ category, items: sectionItems }, index) => (
            <Card key={category.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 bg-ink-50/60 p-3 sm:p-4">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${category.name} up`}
                    disabled={index === 0 || pending}
                    onClick={() => run(() => moveCatalogCategoryAction(category.id, "up"))}
                    className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700 disabled:opacity-30"
                  >
                    <Icon.arrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${category.name} down`}
                    disabled={index === sections.list.length - 1 || pending}
                    onClick={() => run(() => moveCatalogCategoryAction(category.id, "down"))}
                    className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700 disabled:opacity-30"
                  >
                    <Icon.arrowDown className="size-4" />
                  </button>
                </div>

                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                  <SmartImage src={category.image_url} alt="" sizes="80px" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{category.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {sectionItems.length} {sectionItems.length === 1 ? "dish" : "dishes"}
                    {category.description ? ` · ${category.description}` : ""}
                  </p>
                </div>

                {!category.is_active && (
                  <span className="rounded bg-ink-200 px-2 py-0.5 text-[11px] text-ink-600">
                    hidden
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setNewItemSection(category.id);
                      setEditingItem("new");
                    }}
                  >
                    <Icon.plus className="size-3.5" />
                    Dish
                  </Button>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(category)}
                    aria-label={`Edit ${category.name}`}
                    className="rounded-lg p-2 text-ink-500 hover:bg-ink-200 hover:text-ink-900"
                  >
                    <Icon.edit className="size-4" />
                  </button>
                  <ConfirmButton
                    title="Remove this section?"
                    message={`“${category.name}” is removed from the shared menu. Its dishes stay in the catalog and move to “Not filed yet”.`}
                    confirmLabel="Remove section"
                    onConfirm={() => run(() => deleteCatalogCategoryAction(category.id))}
                  >
                    <Icon.trash className="size-4" />
                    <span className="sr-only">Remove {category.name}</span>
                  </ConfirmButton>
                </div>
              </div>

              <ItemList
                items={sectionItems}
                emptyText="No dishes in this section yet."
                onEdit={setEditingItem}
                onDelete={(id) => run(() => deleteCatalogItemAction(id))}
              />
            </Card>
          ))}

          {sections.unfiled.length > 0 && (
            <Card className="overflow-hidden border-amber-200">
              <div className="border-b border-amber-200 bg-amber-50 p-3 sm:p-4">
                <p className="font-semibold text-amber-900">Not filed yet</p>
                <p className="text-xs text-amber-800">
                  These dishes have no section, so restaurants only meet them as type-ahead
                  suggestions. Open one and give it a section.
                </p>
              </div>
              <ItemList
                items={sections.unfiled}
                emptyText=""
                onEdit={setEditingItem}
                onDelete={(id) => run(() => deleteCatalogItemAction(id))}
              />
            </Card>
          )}

          {q && totalShown === 0 && (
            <EmptyState title="Nothing matched" description="Try a different search." />
          )}
        </div>
      )}

      {editingItem !== null && (
        <CatalogItemModal
          item={editingItem === "new" ? null : editingItem}
          categories={categories}
          defaultCategoryId={newItemSection}
          onClose={() => setEditingItem(null)}
        />
      )}

      {editingCategory !== null && (
        <CatalogCategoryModal
          category={editingCategory === "new" ? null : editingCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
  );
}

function ItemList({
  items,
  emptyText,
  onEdit,
  onDelete,
}: {
  items: CatalogItem[];
  emptyText: string;
  onEdit: (item: CatalogItem) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return emptyText ? <p className="p-4 text-sm text-ink-500">{emptyText}</p> : null;
  }

  return (
    <ul className="divide-y divide-ink-100">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-ink-100">
            <SmartImage src={item.image_url} alt="" sizes="96px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink-900">{item.name}</p>
            <p className="truncate text-xs text-ink-500">
              {[item.cuisine, item.variants.map((v) => v.name).join(" · ")]
                .filter(Boolean)
                .join(" — ") || "—"}
            </p>
          </div>
          {!item.is_active && (
            <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">hidden</span>
          )}
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={`Edit ${item.name}`}
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <Icon.edit className="size-4" />
          </button>
          <ConfirmButton
            title="Remove this dish?"
            message={`“${item.name}” is removed from the shared menu. Restaurants that already copied it keep their own copy.`}
            confirmLabel="Remove"
            onConfirm={() => onDelete(item.id)}
          >
            <Icon.trash className="size-4" />
            <span className="sr-only">Remove {item.name}</span>
          </ConfirmButton>
        </li>
      ))}
    </ul>
  );
}

function CatalogCategoryModal({
  category,
  onClose,
}: {
  category: CatalogCategory | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState(saveCatalogCategoryAction, null);
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? null);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [name, setName] = useState(category?.name ?? "");

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) {
      clearCatalogCache();
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "Edit section" : "New section"}
      description="Sections are how restaurants browse the shared menu."
    >
      <form action={formAction} className="space-y-4">
        {category && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="is_active" value={isActive ? "on" : "off"} />

        <Field label="Name" htmlFor="cc-name" required error={state?.fieldErrors?.name}>
          <Input
            id="cc-name"
            name="name"
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Burgers"
          />
        </Field>

        <Field label="Description" htmlFor="cc-description" hint="Optional, shown under the name.">
          <Textarea
            id="cc-description"
            name="description"
            defaultValue={category?.description ?? ""}
            maxLength={200}
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">Section photo</p>
          <CatalogImageField value={imageUrl} onChange={setImageUrl} seed={name} />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <Switch checked={isActive} onChange={setIsActive} label="Visible to restaurants" />
          <span className="text-sm text-ink-700">
            {isActive ? "Restaurants can browse it" : "Hidden from restaurants"}
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>{category ? "Save changes" : "Add section"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function CatalogItemModal({
  item,
  categories,
  defaultCategoryId,
  onClose,
}: {
  item: CatalogItem | null;
  categories: CatalogCategory[];
  defaultCategoryId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState(saveCatalogItemAction, null);
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? null);
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [name, setName] = useState(item?.name ?? "");

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) {
      clearCatalogCache();
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  const variantsText = (item?.variants ?? [])
    .map((v) => (v.price != null ? `${v.name} ${v.price}` : v.name))
    .join(", ");

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? "Edit dish" : "New dish"}
      description="What a restaurant gets when they copy this into their menu."
      size="lg"
    >
      <form action={formAction} className="space-y-5">
        {item && <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="is_active" value={isActive ? "on" : "off"} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="c-name" required className="sm:col-span-2">
            <Input
              id="c-name"
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Crispy Chicken Burger"
            />
          </Field>

          <Field
            label="Section"
            htmlFor="c-category"
            hint="Copied across as a section in the restaurant's own menu."
          >
            <Select
              id="c-category"
              name="category_id"
              defaultValue={item?.category_id ?? defaultCategoryId ?? ""}
            >
              <option value="">Not filed yet</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cuisine" htmlFor="c-cuisine" hint="Optional grouping, e.g. Italian.">
            <Input id="c-cuisine" name="cuisine" defaultValue={item?.cuisine ?? ""} />
          </Field>

          <Field label="Description" htmlFor="c-description" className="sm:col-span-2">
            <Textarea
              id="c-description"
              name="description"
              defaultValue={item?.description ?? ""}
              maxLength={400}
              placeholder="Crispy chicken fillet, lettuce, pickles and signature sauce."
            />
          </Field>

          <Field
            label="Ingredients"
            htmlFor="c-ingredients"
            className="sm:col-span-2"
            hint="Comma separated."
          >
            <Input
              id="c-ingredients"
              name="ingredients"
              defaultValue={item?.ingredients ?? ""}
              placeholder="Chicken, lettuce, tomato, cheese"
            />
          </Field>

          <Field
            label="Sizes"
            htmlFor="c-variants"
            className="sm:col-span-2"
            hint="Comma separated. Add a number for a starting price — “Small 8, Medium 11, Large 14”. Every restaurant sets its own."
          >
            <Input
              id="c-variants"
              name="variants"
              defaultValue={variantsText}
              placeholder="Regular, Double"
            />
          </Field>

          <Field
            label="Search keywords"
            htmlFor="c-keywords"
            className="sm:col-span-2"
            hint="Comma separated."
          >
            <Input
              id="c-keywords"
              name="keywords"
              defaultValue={(item?.keywords ?? []).join(", ")}
              placeholder="burger, chicken, sandwich"
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">Photo</p>
          <CatalogImageField value={imageUrl} onChange={setImageUrl} seed={name} />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <Switch checked={isActive} onChange={setIsActive} label="Visible to restaurants" />
          <span className="text-sm text-ink-700">
            {isActive ? "Restaurants can copy it" : "Hidden from restaurants"}
          </span>
        </label>

        <div className={cn("flex justify-end gap-2")}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>{item ? "Save changes" : "Add dish"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
