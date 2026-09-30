"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { Card, EmptyState } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import { useI18n, useT } from "@/components/i18n/I18nProvider";
import {
  createStaffAction,
  deleteStaffAction,
  updateStaffAction,
} from "@/lib/actions/staff";
import { MIN_STAFF_PASSWORD } from "@/lib/constants";
import { STAFF_PERMISSIONS, PERMISSION_LABELS, staffPermissions } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/lib/types";

/**
 * Sub-accounts the restaurant owner creates: a name they choose, an email and
 * password the person signs in with, and one job. A waiter sees the floor, a
 * cook sees the kitchen; neither can reach settings, billing or the menu.
 */
export function StaffManager({
  staff,
  currentUserId,
}: {
  staff: StaffMember[];
  currentUserId: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  // Stable identity: the modal's effect depends on it, and a new arrow on
  // every render would re-fire that effect after each router.refresh().
  const close = useCallback(() => setEditing(null), []);

  const roleLabel = (role: string) =>
    role === "owner"
      ? t("staff.roleOwner")
      : role === "manager"
        ? t("staff.roleManager")
        : role === "chef"
          ? t("staff.roleChef")
          : role === "waiter"
            ? t("staff.roleWaiter")
            : t("staff.roleStaff");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditing("new")}>
          <Icon.userPlus className="size-4" />
          {t("staff.add")}
        </Button>
      </div>

      {staff.length === 0 ? (
        <EmptyState
          icon="👥"
          title={t("staff.emptyTitle")}
          description={t("staff.emptyBody")}
          action={<Button onClick={() => setEditing("new")}>{t("staff.add")}</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {staff.map((member) => {
            const isOwner = member.role === "owner";
            const isMe = member.user_id === currentUserId;

            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 sm:p-4"
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    member.role === "chef"
                      ? "bg-amber-100 text-amber-700"
                      : member.role === "waiter"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-brand-100 text-brand-700"
                  )}
                >
                  {member.role === "chef" ? (
                    <Icon.chef className="size-5" />
                  ) : member.role === "waiter" ? (
                    <Icon.waiter className="size-5" />
                  ) : (
                    <Icon.shield className="size-5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {member.display_name || member.email || roleLabel(member.role)}
                    {isMe && <span className="ms-2 text-xs text-ink-400">{t("staff.you")}</span>}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {roleLabel(member.role)}
                    {member.email ? ` · ${member.email}` : ""}
                  </p>
                </div>

                {!member.is_active && (
                  <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-500">
                    {t("staff.disabled")}
                  </span>
                )}

                {!isOwner && !isMe && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(member)}>
                      <Icon.edit className="size-4" />
                      {t("common.edit")}
                    </Button>
                    <RemoveButton member={member} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Card className="bg-ink-50/60 p-4">
        <p className="text-sm text-ink-600">{t("staff.explain")}</p>
      </Card>

      {/* Mounted only while open, so a previous submission's errors never
          leak into the next one. */}
      {editing !== null && (
        <StaffModal
          member={editing}
          onClose={close}
        />
      )}
    </div>
  );
}

function RemoveButton({ member }: { member: StaffMember }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <ConfirmButton
      title={t("staff.removeTitle")}
      message={t("staff.removeBody", { name: member.display_name || member.email || "" })}
      confirmLabel={t("staff.remove")}
      onConfirm={() =>
        startTransition(async () => {
          const result = await deleteStaffAction(member.id);
          if (result?.message) toast(result.message, result.ok ? "success" : "error");
          router.refresh();
        })
      }
    >
      <Icon.trash className="size-4" />
      <span className="sr-only">{t("staff.remove")}</span>
    </ConfirmButton>
  );
}

function StaffModal({
  member,
  onClose,
}: {
  member: StaffMember | "new" | null;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { locale } = useI18n();
  const isNew = member === "new";
  const existing = member && member !== "new" ? member : null;

  const [state, action] = useActionState(
    isNew ? createStaffAction : updateStaffAction,
    null
  );

  useEffect(() => {
    if (!state) return;
    if (state.message) toast(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      router.refresh();
      onClose();
    }
    // `state` is a fresh object on every submission, so this runs once per result.
  }, [state, toast, router, onClose]);

  return (
    <Modal
      open={Boolean(member)}
      onClose={onClose}
      title={isNew ? t("staff.addTitle") : t("staff.editTitle")}
      description={isNew ? t("staff.addSub") : t("staff.editSub")}
    >
      <form action={action} className="space-y-4">
        {existing && <input type="hidden" name="member_id" value={existing.id} />}

        <Field label={t("staff.name")} error={state?.fieldErrors?.display_name} required>
          <Input
            name="display_name"
            defaultValue={existing?.display_name ?? ""}
            placeholder={t("staff.namePlaceholder")}
            maxLength={60}
            required
          />
        </Field>

        {isNew && (
          <Field label={t("staff.email")} error={state?.fieldErrors?.email} required>
            <Input name="email" type="email" autoComplete="off" required />
          </Field>
        )}

        <Field
          label={isNew ? t("staff.password") : t("staff.newPassword")}
          hint={isNew ? t("staff.passwordHint") : t("staff.newPasswordHint")}
          error={state?.fieldErrors?.password}
          required={isNew}
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={isNew ? MIN_STAFF_PASSWORD : undefined}
            required={isNew}
          />
        </Field>

        <fieldset className="space-y-3 rounded-2xl border border-ink-200 p-4">
          <legend className="px-2 text-sm font-semibold">{locale === 'ar' ? 'صلاحيات الحساب' : 'Account permissions'}</legend>
          <p className="text-xs leading-6 text-ink-500">{locale === 'ar' ? 'الحساب يقدر يشوف الطلبات. اختار العمليات المسموحة ليه. من غير اختيارات هيبقى للمتابعة بس.' : 'This account can view orders. Select allowed actions. With no selections it has read-only access.'}</p>
          {STAFF_PERMISSIONS.map(permission => <label key={permission} className="flex min-h-11 items-center gap-3 rounded-xl bg-ink-50 px-3 py-2 text-sm">
            <input type="checkbox" name="permissions" value={permission} defaultChecked={existing ? staffPermissions(existing.role, existing.service_permissions).includes(permission) : false} className="size-4 accent-orange-600" />
            {PERMISSION_LABELS[permission][locale]}
          </label>)}
        </fieldset>

        {existing && (
          <label className="flex items-start gap-3 rounded-xl border border-ink-200 p-3">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={existing.is_active}
              className="mt-0.5 size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-800">{t("staff.active")}</span>
              <span className="block text-xs text-ink-500">{t("staff.activeHint")}</span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <SubmitButton>{isNew ? t("staff.create") : t("common.save")}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
