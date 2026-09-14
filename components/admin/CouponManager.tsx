"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCouponAction, saveCouponAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { Coupon } from "@/lib/types";

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <Button onClick={() => setEditing("new")}>
        <Icon.plus className="size-4" />
        New coupon
      </Button>

      {coupons.length === 0 ? (
        <EmptyState
          icon="🎟️"
          title="No coupons yet"
          description="Create a code, hand it to a restaurant, and their quote drops."
          action={<Button onClick={() => setEditing("new")}>Create one</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {coupons.map((coupon) => {
              const spent =
                coupon.max_redemptions !== null &&
                coupon.redeemed_count >= coupon.max_redemptions;
              const expired = coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false;
              const dead = !coupon.is_active || spent || expired;

              return (
                <li key={coupon.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                  <span className="ltr-nums rounded-lg bg-ink-900 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                    {coupon.code}
                  </span>

                  <div className="w-full min-w-0 flex-1 sm:w-auto">
                    <p className="ltr-nums text-sm font-medium text-ink-900">
                      {coupon.kind === "percent" ? `${coupon.value}% off` : `$${coupon.value} off`}
                      <span className="text-ink-400"> · {coupon.applies_to}</span>
                    </p>
                    <p className="ltr-nums truncate text-xs text-ink-500">
                      {coupon.redeemed_count}
                      {coupon.max_redemptions !== null ? ` / ${coupon.max_redemptions}` : ""} used
                      {coupon.expires_at ? ` · until ${formatDate(coupon.expires_at)}` : ""}
                      {coupon.note ? ` · ${coupon.note}` : ""}
                    </p>
                  </div>

                  {dead && (
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-500">
                      {!coupon.is_active ? "off" : expired ? "expired" : "used up"}
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(coupon)}>
                      <Icon.edit className="size-4" />
                      Edit
                    </Button>
                    <ConfirmButton
                      title="Delete this coupon?"
                      message={`“${coupon.code}” stops working immediately.`}
                      confirmLabel="Delete"
                      onConfirm={() =>
                        startTransition(async () => {
                          const result = await deleteCouponAction(coupon.id);
                          if (result?.message) {
                            toast(result.message, result.ok ? "success" : "error");
                          }
                          router.refresh();
                        })
                      }
                    >
                      <Icon.trash className="size-4" />
                      <span className="sr-only">Delete {coupon.code}</span>
                    </ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editing !== null && (
        <CouponModal
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CouponModal({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useActionState(saveCouponAction, null);
  const [isActive, setIsActive] = useState(coupon?.is_active ?? true);

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
      title={coupon ? "Edit coupon" : "New coupon"}
      description="Owners type this code themselves; they can never list them."
    >
      <form action={formAction} className="space-y-4">
        {coupon && <input type="hidden" name="id" value={coupon.id} />}
        <input type="hidden" name="is_active" value={isActive ? "on" : "off"} />

        <Field label="Code" htmlFor="cp-code" required error={state?.fieldErrors?.code}>
          <Input
            id="cp-code"
            name="code"
            required
            defaultValue={coupon?.code ?? ""}
            placeholder="LAUNCH50"
            maxLength={24}
            className="ltr-nums font-mono uppercase"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="cp-kind">
            <Select id="cp-kind" name="kind" defaultValue={coupon?.kind ?? "percent"}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off (USD)</option>
            </Select>
          </Field>

          <Field label="Amount" htmlFor="cp-value" required error={state?.fieldErrors?.value}>
            <Input
              id="cp-value"
              name="value"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={coupon?.value ?? ""}
              className="ltr-nums"
            />
          </Field>

          <Field label="Applies to" htmlFor="cp-applies">
            <Select id="cp-applies" name="applies_to" defaultValue={coupon?.applies_to ?? "both"}>
              <option value="both">Menu and POS</option>
              <option value="menu">Menu only</option>
              <option value="pos">POS only</option>
            </Select>
          </Field>

          <Field
            label="Usage limit"
            htmlFor="cp-max"
            hint="Leave empty for unlimited."
            error={state?.fieldErrors?.max_redemptions}
          >
            <Input
              id="cp-max"
              name="max_redemptions"
              type="number"
              min="1"
              step="1"
              defaultValue={coupon?.max_redemptions ?? ""}
              className="ltr-nums"
            />
          </Field>
        </div>

        <Field label="Expires" htmlFor="cp-expires" hint="Leave empty for no end date.">
          <Input
            id="cp-expires"
            name="expires_at"
            type="date"
            defaultValue={coupon?.expires_at ? coupon.expires_at.slice(0, 10) : ""}
            className="ltr-nums"
          />
        </Field>

        <Field label="Note" htmlFor="cp-note" hint="For you, never shown to restaurants.">
          <Textarea id="cp-note" name="note" defaultValue={coupon?.note ?? ""} maxLength={200} />
        </Field>

        <label className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
          <Switch checked={isActive} onChange={setIsActive} label="Coupon is live" />
          <span className="text-sm text-ink-700">
            {isActive ? "Accepted right now" : "Rejected for everyone"}
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>{coupon ? "Save changes" : "Create coupon"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
