"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQrTemplateAction, saveQrTemplateAction } from "@/lib/actions/admin";
import { QrLabelPreview } from "@/components/qr/QrLabelPreview";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Switch } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import type { QrStyle } from "@/lib/qr-label";
import type { QrTemplate } from "@/lib/types";

const LAYOUTS = [
  { id: "counter", label: "Counter card", note: "Portrait, big name on top" },
  { id: "square", label: "Clean square", note: "Square, minimal" },
  { id: "tent", label: "Table tent", note: "Portrait with a table badge" },
] as const;

const SCOPES = [
  { id: "both", label: "General + tables" },
  { id: "general", label: "General only" },
  { id: "table", label: "Tables only" },
] as const;

const COLOURS: Array<{ key: keyof QrTemplate; label: string }> = [
  { key: "bg_color", label: "Background" },
  { key: "panel_color", label: "QR panel" },
  { key: "accent_color", label: "Accent" },
  { key: "text_color", label: "Text" },
  { key: "qr_color", label: "QR colour" },
];

function toStyle(t: {
  layout: QrTemplate["layout"];
  bg_color: string;
  panel_color: string;
  accent_color: string;
  text_color: string;
  qr_color: string;
  headline: string | null;
  cta_text: string | null;
}): QrStyle {
  return {
    layout: t.layout,
    bgColor: t.bg_color,
    panelColor: t.panel_color,
    accentColor: t.accent_color,
    textColor: t.text_color,
    qrColor: t.qr_color,
    headline: t.headline,
    ctaText: t.cta_text,
  };
}

export function QrDesignManager({ templates }: { templates: QrTemplate[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<QrTemplate | null | "new">(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <Button onClick={() => setEditing("new")}>
        <Icon.plus className="size-4" />
        Add design
      </Button>

      {templates.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No QR designs yet"
          description="Run supabase/002-upgrades.sql to install the three built-in designs, or create one here."
          action={<Button onClick={() => setEditing("new")}>Create a design</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="overflow-hidden p-3">
              <QrLabelPreview
                previewWidth={260}
                input={{
                  url: "https://menuzqr.com/demo/menu",
                  title: "Cairo Café",
                  subtitle: "12 Nile St",
                  badge: template.layout === "tent" ? "Table 7" : null,
                  style: toStyle(template),
                }}
              />
              <div className="mt-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{template.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {LAYOUTS.find((l) => l.id === template.layout)?.label} ·{" "}
                    {SCOPES.find((s) => s.id === template.scope)?.label}
                    {!template.is_active && " · hidden"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(template)}
                  aria-label={`Edit ${template.name}`}
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                >
                  <Icon.edit className="size-4" />
                </button>
                <ConfirmButton
                  title={`Delete "${template.name}"?`}
                  message="Restaurants using it fall back to another design. Codes already printed keep working — only the artwork changes."
                  confirmLabel="Delete design"
                  disabled={pending}
                  onConfirm={() =>
                    startTransition(async () => {
                      const result = await deleteQrTemplateAction(template.id);
                      toast(result?.message ?? "Removed.", result?.ok ? "success" : "error");
                      router.refresh();
                    })
                  }
                  className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Icon.trash className="size-4" />
                </ConfirmButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== null && (
        <DesignModal
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DesignModal({
  template,
  onClose,
}: {
  template: QrTemplate | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState(saveQrTemplateAction, null);

  const [draft, setDraft] = useState({
    name: template?.name ?? "",
    layout: template?.layout ?? "counter",
    scope: template?.scope ?? "both",
    bg_color: template?.bg_color ?? "#1c1917",
    panel_color: template?.panel_color ?? "#ffffff",
    accent_color: template?.accent_color ?? "#ea580c",
    text_color: template?.text_color ?? "#ffffff",
    qr_color: template?.qr_color ?? "#1c1917",
    headline: template?.headline ?? "Scan for our menu",
    cta_text: template?.cta_text ?? "Point your camera at the code",
  });
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  const set = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={template ? "Edit design" : "New QR design"}
      description="Colours and wording. The preview updates as you type."
      size="lg"
    >
      <form action={formAction} className="grid gap-5 sm:grid-cols-[1fr_260px] sm:items-start">
        {template && <input type="hidden" name="id" value={template.id} />}
        <input type="hidden" name="is_active" value={isActive ? "on" : "off"} />

        <div className="space-y-4">
          <Field label="Design name" htmlFor="d-name" required>
            <Input
              id="d-name"
              name="name"
              required
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Dark counter card"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Layout" htmlFor="d-layout">
              <Select
                id="d-layout"
                name="layout"
                value={draft.layout}
                onChange={(e) => set("layout", e.target.value)}
              >
                {LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} — {l.note}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Available for" htmlFor="d-scope">
              <Select
                id="d-scope"
                name="scope"
                value={draft.scope}
                onChange={(e) => set("scope", e.target.value)}
              >
                {SCOPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink-800">Colours</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {COLOURS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded-xl border border-ink-200 p-2">
                  <input
                    type="color"
                    name={c.key}
                    value={String(draft[c.key as keyof typeof draft])}
                    onChange={(e) => set(c.key, e.target.value)}
                    aria-label={c.label}
                    className="size-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="truncate text-xs text-ink-600">{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Field label="Headline" htmlFor="d-headline" hint="Shown in the accent colour, uppercase.">
            <Input
              id="d-headline"
              name="headline"
              value={draft.headline}
              onChange={(e) => set("headline", e.target.value)}
              maxLength={60}
            />
          </Field>

          <Field label="Instruction line" htmlFor="d-cta">
            <Input
              id="d-cta"
              name="cta_text"
              value={draft.cta_text}
              onChange={(e) => set("cta_text", e.target.value)}
              maxLength={80}
            />
          </Field>

          <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
            <Switch checked={isActive} onChange={setIsActive} label="Available to restaurants" />
            <span className="text-sm text-ink-700">
              {isActive ? "Restaurants can pick this design" : "Hidden from restaurants"}
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-800">Live preview</p>
          <QrLabelPreview
            previewWidth={240}
            input={{
              url: "https://menuzqr.com/demo/menu",
              title: "Cairo Café",
              subtitle: "12 Nile St",
              badge: draft.layout === "tent" ? "Table 7" : null,
              style: toStyle({
                layout: draft.layout as QrTemplate["layout"],
                bg_color: draft.bg_color,
                panel_color: draft.panel_color,
                accent_color: draft.accent_color,
                text_color: draft.text_color,
                qr_color: draft.qr_color,
                headline: draft.headline,
                cta_text: draft.cta_text,
              }),
            }}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton>{template ? "Save" : "Create"}</SubmitButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
