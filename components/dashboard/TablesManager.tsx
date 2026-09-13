"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createTablesBulkAction,
  deleteTableAction,
  regenerateTableTokenAction,
  saveTableAction,
  toggleTableAction,
} from "@/lib/actions/tables";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/Card";
import { Field, Input, Switch } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/i18n/I18nProvider";
import type { RestaurantTable } from "@/lib/types";

export function TablesManager({ tables }: { tables: RestaurantTable[] }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [editing, setEditing] = useState<RestaurantTable | null | "new">(null);
  const [bulkOpen, setBulkOpen] = useState(false);
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
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditing("new")}>
          <Icon.plus className="size-4" />
          {t("tables.add")}
        </Button>
        <Button variant="secondary" onClick={() => setBulkOpen(true)}>
          {t("tables.bulk")}
        </Button>
        {tables.length > 0 && (
          <LinkButton href="/dashboard/qr-codes" variant="secondary">
            <Icon.qr className="size-4" />
            {t("tables.printQr")}
          </LinkButton>
        )}
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon="🪑"
          title={t("tables.emptyTitle")}
          description={t("tables.emptyBody")}
          action={<Button onClick={() => setBulkOpen(true)}>{t("tables.emptyCta")}</Button>}
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {tables.map((table) => (
            <li
              key={table.id}
              className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 sm:p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
                <Icon.table className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">{table.label}</p>
                <p className="truncate text-[11px] text-ink-400">
                  {t("tables.code")}{" "}
                  <span className="font-mono tracking-wider text-ink-600">{table.qr_token}</span>
                </p>
              </div>

              <Switch
                checked={table.is_active}
                label={`Enable ${table.label}`}
                disabled={pending}
                onChange={(v) => run(() => toggleTableAction(table.id, v))}
              />

              <button
                type="button"
                onClick={() => setEditing(table)}
                aria-label={`Rename ${table.label}`}
                className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <Icon.edit className="size-4" />
              </button>

              <ConfirmButton
                title={`Issue a new QR code for "${table.label}"?`}
                message="The current printed code will stop working immediately. Use this if a code was copied or leaked."
                confirmLabel="Issue new code"
                variant="primary"
                onConfirm={() => run(() => regenerateTableTokenAction(table.id))}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <Icon.qr className="size-4" />
              </ConfirmButton>

              <ConfirmButton
                title={`Delete "${table.label}"?`}
                message="Its printed QR code will stop working. Past orders are kept."
                confirmLabel="Delete table"
                onConfirm={() => run(() => deleteTableAction(table.id))}
                className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
              >
                <Icon.trash className="size-4" />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <TableModal
          table={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <BulkModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onCreate={(count, prefix) =>
          run(async () => {
            const result = await createTablesBulkAction(count, prefix);
            setBulkOpen(false);
            return result;
          })
        }
        pending={pending}
      />
    </div>
  );
}

function TableModal({
  table,
  onClose,
}: {
  table: RestaurantTable | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [state, formAction] = useActionState(saveTableAction, null);
  const [isActive, setIsActive] = useState(table?.is_active ?? true);

  useEffect(() => {
    if (!state) return;
    toast(state.message ?? "Saved.", state.ok ? "success" : "error");
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state, toast, router, onClose]);

  return (
    <Modal open onClose={onClose} title={table ? t("tables.rename") : t("tables.new")} size="sm">
      <form action={formAction} className="space-y-5">
        {table && <input type="hidden" name="id" value={table.id} />}
        <input type="hidden" name="is_active" value={isActive ? "on" : ""} />

        <Field label={t("tables.name")} htmlFor="table-label" required error={state?.fieldErrors?.label}>
          <Input
            id="table-label"
            name="label"
            required
            defaultValue={table?.label ?? ""}
            placeholder="Table 7"
          />
        </Field>

        <label className="flex items-center gap-3">
          <Switch checked={isActive} onChange={setIsActive} label={t("tables.enabled")} />
          <span className="text-sm text-ink-700">
            {isActive ? t("tables.acceptingOrders") : t("tables.disabledNote")}
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <SubmitButton>{table ? t("common.save") : t("tables.add")}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function BulkModal({
  open,
  onClose,
  onCreate,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (count: number, prefix: string) => void;
  pending: boolean;
}) {
  const t = useT();
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState("Table");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("tables.bulk")}
      description={t("tables.bulkSub")}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={pending} onClick={() => onCreate(count, prefix)}>
            {t("tables.createN", { count })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("tables.howMany")} htmlFor="bulk-count">
          <Input
            id="bulk-count"
            type="number"
            min={1}
            max={60}
            value={count}
            onChange={(e) => setCount(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
          />
        </Field>
        <Field label={t("tables.prefix")} htmlFor="bulk-prefix" hint={`${prefix} 1, ${prefix} 2…`}>
          <Input
            id="bulk-prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            maxLength={20}
          />
        </Field>
      </div>
    </Modal>
  );
}
