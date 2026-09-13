"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoriesBulkAction,
  deleteCategoryAction,
  saveCategoryAction,
  toggleCategoryAction,
} from "@/lib/actions/categories";
import { moveCategoryAction } from "@/lib/actions/products";
import { AiButton } from "@/components/ai/AiAssist";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/Card";
import { Field, Input, Switch, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { SmartImage } from "@/components/ui/SmartImage";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import type { Category, Restaurant } from "@/lib/types";

export function CategoriesManager({
  restaurant,
  categories,
  productCounts,
}: {
  restaurant: Restaurant;
  categories: Category[];
  productCounts: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null | "new">(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));

  function run(fn: () => Promise<{ ok: boolean; message?: string } | null>) {
    startTransition(async () => {
      const result = await fn();
      if (result?.message) toast(result.message, result.ok ? "success" : "error");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditing("new")}>
          <Icon.plus className="size-4" />
          Add category
        </Button>
        <AiButton
          label="Suggest sections with AI"
          task="categories"
          input={() => ({
            restaurantName: restaurant.name,
            restaurantType: restaurant.restaurant_type ?? "",
            language: restaurant.language,
            categories: categories.map((c) => c.name).join(", "),
          })}
          onResult={(data) => {
            const fresh = data.categorySuggestions.filter(
              (n) => !existingNames.has(n.toLowerCase())
            );
            if (fresh.length === 0) {
              toast("AI had no new sections to suggest — your menu already covers them.", "info");
              return;
            }
            setSuggestions(fresh);
          }}
          className="h-10 px-3.5 text-sm"
        />
      </div>

      {suggestions.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestions}
          onClose={() => setSuggestions([])}
          onAdd={(names) =>
            run(async () => {
              const result = await createCategoriesBulkAction(names);
              setSuggestions([]);
              return result;
            })
          }
          pending={pending}
        />
      )}

      {categories.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No categories yet"
          description="Categories are the sections of your menu — Breakfast, Burgers, Drinks, Desserts."
          action={<Button onClick={() => setEditing("new")}>Add your first category</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {categories.map((category, index) => (
            <li
              key={category.id}
              className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 sm:p-4"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${category.name} up`}
                  disabled={index === 0 || pending}
                  onClick={() => run(() => moveCategoryAction(category.id, "up"))}
                  className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                >
                  <Icon.arrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${category.name} down`}
                  disabled={index === categories.length - 1 || pending}
                  onClick={() => run(() => moveCategoryAction(category.id, "down"))}
                  className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-30"
                >
                  <Icon.arrowDown className="size-4" />
                </button>
              </div>

              <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                {category.image_url ? (
                  <SmartImage src={category.image_url} alt="" sizes="96px" />
                ) : (
                  <span className="grid h-full place-items-center text-ink-400">
                    <Icon.grid className="size-5" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">{category.name}</p>
                <p className="truncate text-xs text-ink-500">
                  {productCounts[category.id] ?? 0} products
                  {category.description ? ` · ${category.description}` : ""}
                </p>
              </div>

              <Switch
                checked={category.is_active}
                label={`Show ${category.name} on the menu`}
                disabled={pending}
                onChange={(v) => run(() => toggleCategoryAction(category.id, v))}
              />

              <button
                type="button"
                onClick={() => setEditing(category)}
                aria-label={`Edit ${category.name}`}
                className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <Icon.edit className="size-4" />
              </button>

              <ConfirmButton
                title={`Delete "${category.name}"?`}
                message="Products in this category are kept — they simply become uncategorised."
                confirmLabel="Delete category"
                onConfirm={() => run(() => deleteCategoryAction(category.id))}
                className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
              >
                <Icon.trash className="size-4" />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <CategoryModal
          restaurant={restaurant}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SuggestionsPanel({
  suggestions,
  onAdd,
  onClose,
  pending,
}: {
  suggestions: string[];
  onAdd: (names: string[]) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(suggestions);

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-900">AI suggested sections</p>
        <button type="button" onClick={onClose} className="text-xs text-brand-800 hover:underline">
          Dismiss
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((name) => {
          const active = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() =>
                setSelected((s) => (active ? s.filter((n) => n !== name) : [...s, name]))
              }
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-ink-700"
              }`}
            >
              {active && <Icon.check className="mr-1 inline size-3.5" />}
              {name}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          disabled={selected.length === 0 || pending}
          loading={pending}
          onClick={() => onAdd(selected)}
        >
          Add {selected.length} section{selected.length === 1 ? "" : "s"}
        </Button>
        <span className="text-xs text-brand-900/70">Nothing is saved until you confirm.</span>
      </div>
    </div>
  );
}

function CategoryModal({
  restaurant,
  category,
  onClose,
}: {
  restaurant: Restaurant;
  category: Category | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState(saveCategoryAction, null);
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? null);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      description="Categories group your products into menu sections."
    >
      <form action={formAction} className="space-y-5" id="category-form">
        {category && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="is_active" value={isActive ? "on" : ""} />

        <Field label="Name" htmlFor="cat-name" required error={state?.fieldErrors?.name}>
          <Input
            id="cat-name"
            name="name"
            required
            defaultValue={category?.name ?? ""}
            placeholder="Breakfast"
          />
        </Field>

        <Field label="Description" htmlFor="cat-description" hint="Optional — shown under the section title.">
          <Textarea
            id="cat-description"
            name="description"
            defaultValue={category?.description ?? ""}
            maxLength={200}
            placeholder="Served until 12:00"
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">Section image (optional)</p>
          <ImagePicker
            restaurantId={restaurant.id}
            kind="category"
            value={imageUrl}
            onChange={(url) => setImageUrl(url)}
            aspect="wide"
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <Switch checked={isActive} onChange={setIsActive} label="Visible on the menu" />
          <span className="text-sm text-ink-700">
            {isActive ? "Visible on the public menu" : "Hidden from the public menu"}
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>{category ? "Save changes" : "Add category"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
