"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCategoryAction,
  saveCategoryAction,
  toggleCategoryAction,
} from "@/lib/actions/categories";
import { moveCategoryAction } from "@/lib/actions/products";
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
import { useT } from "@/components/i18n/I18nProvider";
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
  const t = useT();
  const [editing, setEditing] = useState<Category | null | "new">(null);
  const [pending, startTransition] = useTransition();

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
          {t("categories.add")}
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title={t("categories.emptyTitle")}
          description={t("categories.emptyBody")}
          action={<Button onClick={() => setEditing("new")}>{t("categories.emptyCta")}</Button>}
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
                  {productCounts[category.id] ?? 0} {t("common.products")}
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
  const t = useT();
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
      title={category ? t("categories.editTitle") : t("categories.new")}
      description={t("categories.modalSub")}
    >
      <form action={formAction} className="space-y-5" id="category-form">
        {category && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />
        <input type="hidden" name="is_active" value={isActive ? "on" : ""} />

        <Field label={t("categories.name")} htmlFor="cat-name" required error={state?.fieldErrors?.name}>
          <Input
            id="cat-name"
            name="name"
            required
            defaultValue={category?.name ?? ""}
            placeholder="Breakfast"
          />
        </Field>

        <Field label={t("products.description")} htmlFor="cat-description" hint={t("categories.descriptionHint")}>
          <Textarea
            id="cat-description"
            name="description"
            defaultValue={category?.description ?? ""}
            maxLength={200}
            placeholder="Served until 12:00"
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">{t("categories.image")}</p>
          <ImagePicker
            restaurantId={restaurant.id}
            kind="category"
            value={imageUrl}
            onChange={(url) => setImageUrl(url)}
            aspect="wide"
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <Switch checked={isActive} onChange={setIsActive} label={t("categories.visibleOnMenu")} />
          <span className="text-sm text-ink-700">
            {isActive ? t("categories.visibleOnMenu") : t("categories.hiddenFromMenu")}
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <SubmitButton>{category ? t("common.saveChanges") : t("categories.add")}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
