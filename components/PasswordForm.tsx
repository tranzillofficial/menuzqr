"use client";
import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/account";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
export function PasswordForm() {
  const {locale} = useI18n(); const ar = locale === 'ar';
  const [state, action] = useActionState(changePasswordAction, null);
  return <form action={action} className="space-y-3 rounded-2xl border border-ink-200 bg-white p-5">
    <h2 className="font-semibold">{ar ? 'تغيير كلمة المرور' : 'Change password'}</h2>
    <input className="h-11 w-full rounded-xl border border-ink-200 px-3" name="current_password" type="password" required autoComplete="current-password" aria-label={ar ? 'كلمة المرور الحالية' : 'Current password'} placeholder={ar ? 'كلمة المرور الحالية' : 'Current password'} />
    <input className="h-11 w-full rounded-xl border border-ink-200 px-3" name="new_password" type="password" minLength={8} required autoComplete="new-password" aria-label={ar ? 'كلمة المرور الجديدة' : 'New password'} placeholder={ar ? 'كلمة المرور الجديدة' : 'New password'} />
    <input className="h-11 w-full rounded-xl border border-ink-200 px-3" name="confirm_password" type="password" minLength={8} required autoComplete="new-password" aria-label={ar ? 'تأكيد كلمة المرور' : 'Confirm password'} placeholder={ar ? 'تأكيد كلمة المرور' : 'Confirm password'} />
    {state?.message && <p role="status" className={state.ok ? 'text-emerald-700' : 'text-red-700'}>{state.message}</p>}
    <SubmitButton>{ar ? 'حفظ كلمة المرور' : 'Save password'}</SubmitButton>
  </form>;
}
