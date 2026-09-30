"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { done, fail, str } from "./helpers";

/** Only same-origin relative paths may be used as a post-login destination. */
function safeNext(next: string): string {
  if (!next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//") || next.includes("\\")) return "/dashboard";
  return next;
}

function readableAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try signing in.";
  if (m.includes("password")) return "Password must be at least 8 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

export async function signUpAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const fullName = str(form, "full_name");

  const fieldErrors: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (Object.keys(fieldErrors).length) return fail("Please fix the errors below.", fieldErrors);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return fail(readableAuthError(error.message));

  if (!data.session) {
    return done("Account created. Check your inbox to confirm your email, then sign in.");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const next = str(form, "next");

  if (!email || !password) return fail("Enter your email and password.");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail(readableAuthError(error.message));

  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export async function signOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { getLocale } = await import('@/lib/i18n/server');
  const ar = await getLocale() === 'ar';
  const supabase = await createServerSupabase();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user?.email) return fail(ar ? 'سجّل دخولك الأول.' : 'Please sign in.');
  const password = str(form,'new_password');
  if (password.length < 8 || password !== str(form,'confirm_password')) return fail(ar ? 'راجع تأكيد كلمة المرور واستخدم ٨ حروف على الأقل.' : 'Use at least 8 characters and matching passwords.');
  const {error: verify} = await supabase.auth.signInWithPassword({email:user.email,password:str(form,'current_password')});
  if (verify) return fail(ar ? 'كلمة المرور الحالية مش صحيحة.' : 'The current password is incorrect.');
  const {error} = await supabase.auth.updateUser({password});
  if (error) return fail(ar ? 'تعذر تغيير كلمة المرور. جرّب تاني.' : 'Could not change your password. Please retry.');
  await supabase.auth.signOut({scope:'others'});
  return done(ar ? 'تم تغيير كلمة المرور.' : 'Password updated.');
}
