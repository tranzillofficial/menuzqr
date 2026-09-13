"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCatalogItemAction, saveCatalogItemAction } from "@/lib/actions/admin";
import { clearCatalogCache } from "@/components/dashboard/CatalogPicker";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { Field, Input, Switch, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { LibraryPickerField } from "@/components/ui/ImagePicker";
import { Modal } from "@/components/ui/Modal";
import { SmartImage } from "@/components/ui/SmartImage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import type { CatalogItem } from "@/lib/types";

export function CatalogManager({ items }: { items: CatalogItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<CatalogItem | null | "new">(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const visible = items.filter((item) =>
    q
      ? `${item.name} ${item.category_name ?? ""} ${item.cuisine ?? ""} ${item.keywords.join(" ")}`
          .toLowerCase()
          .includes(q)
      : true
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditing("new")}>
          <Icon.plus className="size-4" />
          Add catalog item
        </Button>
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Icon.search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the catalog…"
            aria-label="Search the catalog"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <span className="text-sm text-ink-500">{items.length} items</span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="📖"
          title="The catalog is empty"
          description="Add the dishes restaurants order most. When an owner starts typing a product name, these appear as ready-made suggestions with description, ingredients, photo and sizes."
          action={<Button onClick={() => setEditing("new")}>Add the first item</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing matched" description="Try a different search." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {visible.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                  <SmartImage src={item.image_url} alt="" sizes="96px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-900">{item.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {[item.category_name, item.cuisine, item.variants.map((v) => v.name).join(" · ")]
                      .filter(Boolean)
                      .join(" — ")}
                  </p>
                </div>
                {!item.is_active && (
                  <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">
                    hidden
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  aria-label={`Edit ${item.name}`}
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                >
                  <Icon.edit className="size-4" />
                </button>
                <ConfirmButton
                  title={`Remove "${item.name}"?`}
                  message="It disappears from the suggestions restaurants see. Products already created from it are untouched."
                  confirmLabel="Remove"
                  disabled={pending}
                  onConfirm={() =>
                    startTransition(async () => {
                      const result = await deleteCatalogItemAction(item.id);
                      clearCatalogCache();
                      toast(result?.message ?? "Removed.", result?.ok ? "success" : "error");
                      router.refresh();
                    })
                  }
                  className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Icon.trash className="size-4" />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing !== null && (
        <CatalogItemModal
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CatalogItemModal({
  item,
  onClose,
}: {
  item: CatalogItem | null;
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
      title={item ? "Edit catalog item" : "New catalog item"}
      description="What a restaurant owner gets when they pick this suggestion."
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
              onChange={(e) => setName(e.target.value)}
              placeholder="Crispy Chicken Burger"
            />
          </Field>

          <Field label="Suggested section" htmlFor="c-category" hint="Matched to the owner's own sections by name.">
            <Input
              id="c-category"
              name="category_name"
              defaultValue={item?.category_name ?? ""}
              placeholder="Burgers"
            />
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

          <Field label="Ingredients" htmlFor="c-ingredients" className="sm:col-span-2" hint="Comma separated.">
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
            hint="Comma separated. Add a number for a starting price — “Small 8, Medium 11, Large 14”. Owners can change it."
          >
            <Input
              id="c-variants"
              name="variants"
              defaultValue={variantsText}
              placeholder="Regular, Double"
            />
          </Field>

          <Field label="Search keywords" htmlFor="c-keywords" className="sm:col-span-2" hint="Comma separated.">
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
          <LibraryPickerField value={imageUrl} onChange={setImageUrl} seed={name} />
          <p className="mt-2 text-xs text-ink-500">
            Pick from the image library so the photo is licensed and already optimised.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <Switch checked={isActive} onChange={setIsActive} label="Visible to restaurants" />
          <span className="text-sm text-ink-700">
            {isActive ? "Offered as a suggestion" : "Hidden from suggestions"}
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>{item ? "Save changes" : "Add to catalog"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
