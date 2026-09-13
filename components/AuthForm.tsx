"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction } from "@/lib/actions/account";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Icon } from "@/components/ui/Icons";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
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
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        {mode === "login"
          ? "Sign in to manage your menu, tables and orders."
          : "Build your digital menu in minutes. No card required to start."}
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}

        {mode === "signup" && (
          <Field label="Your name" htmlFor="full_name">
            <Input id="full_name" name="full_name" autoComplete="name" placeholder="Ahmed Hassan" />
          </Field>
        )}

        <Field label="Email" htmlFor="email" required error={state?.fieldErrors?.email}>
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
          label="Password"
          htmlFor="password"
          required
          error={state?.fieldErrors?.password}
          hint={mode === "signup" ? "At least 8 characters." : undefined}
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
          {mode === "login" ? "Sign in" : "Create account"}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        {mode === "login" ? (
          <>
            New to MenuzQR?{" "}
            <Link href="/signup" className="font-medium text-brand-700 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
