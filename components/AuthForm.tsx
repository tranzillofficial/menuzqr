"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction } from "@/lib/actions/account";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Icon } from "@/components/ui/Icons";
import { useT } from "@/components/i18n/I18nProvider";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const t = useT();
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction] = useActionState(action, null);

  return (
    <div className="mx-auto w-full max-w-md">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-ink-900">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
          <Icon.qr className="size-4.5" />
        </span>
        MenuzQR
      </Link>

      <h1 className="font-serif text-3xl text-ink-900">
        {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        {mode === "login"
          ? t("auth.loginSub")
          : t("auth.signupSub")}
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}

        {mode === "signup" && (
          <Field label={t("auth.yourName")} htmlFor="full_name">
            <Input id="full_name" name="full_name" autoComplete="name" placeholder="Ahmed Hassan" />
          </Field>
        )}

        <Field label={t("auth.email")} htmlFor="email" required error={state?.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@restaurant.com"
          />
        </Field>

        <Field
          label={t("auth.password")}
          htmlFor="password"
          required
          error={state?.fieldErrors?.password}
          hint={mode === "signup" ? t("auth.passwordHint") : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
          />
        </Field>

        {state?.message && (
          <p
            className={`rounded-xl px-3.5 py-2.5 text-sm ${
              state.ok
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-red-50 text-red-700 ring-1 ring-red-200"
            }`}
            role="alert"
          >
            {state.message}
          </p>
        )}

        <SubmitButton className="w-full" size="lg">
          {mode === "login" ? t("auth.signInCta") : t("auth.signUpCta")}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        {mode === "login" ? (
          <>
            {t("auth.newHere")}{" "}
            <Link href="/signup" className="font-medium text-brand-700 hover:underline">
              {t("auth.signUpCta")}
            </Link>
          </>
        ) : (
          <>
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              {t("auth.signInCta")}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
