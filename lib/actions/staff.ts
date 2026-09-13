"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ASSIGNABLE_ROLES,
  MAX_STAFF_PER_RESTAURANT,
  MIN_STAFF_PASSWORD,
  type AssignableRole,
} from "@/lib/constants";
import type { ActionState, StaffMember } from "@/lib/types";
import { bool, done, fail, str } from "./helpers";

/**
 * Staff accounts are real Supabase users created by the restaurant owner.
 * They sign in with their own email and password, they never see the owner's
 * billing or settings, and they are tied to exactly one restaurant through a
 * `restaurant_members` row.
 */
async function requireManagerContext(): Promise<
  { ok: true; restaurantId: string; userId: string } | { ok: false; error: ActionState }
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: fail("You need to sign in first.") };

  const { data } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["owner", "manager"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return { ok: false, error: fail("Only the restaurant owner can manage the team.") };
  return { ok: true, restaurantId: data.restaurant_id, userId: user.id };
}

export async function listStaffAction(): Promise<StaffMember[]> {
  const context = await requireManagerContext();
  if (!context.ok) return [];

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("restaurant_members")
    .select("id, restaurant_id, user_id, role, display_name, is_active, created_at")
    .eq("restaurant_id", context.restaurantId)
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Joined in JavaScript on purpose: `restaurant_members.user_id` points at
  // auth.users, not at public.profiles, so PostgREST has no relationship to
  // embed through.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", rows.map((row) => row.user_id));

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email as string | null]));

  return rows.map(
    (row) =>
      ({
        id: row.id,
        restaurant_id: row.restaurant_id,
        user_id: row.user_id,
        role: row.role,
        display_name: row.display_name,
        is_active: row.is_active,
        created_at: row.created_at,
        email: emailById.get(row.user_id) ?? null,
      }) as StaffMember
  );
}

export async function createStaffAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const context = await requireManagerContext();
  if (!context.ok) return context.error;

  const name = str(form, "display_name");
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const role = str(form, "role") as AssignableRole;

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 60) fieldErrors.display_name = "Enter a name (2–60 characters).";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < MIN_STAFF_PASSWORD) {
    fieldErrors.password = `Use at least ${MIN_STAFF_PASSWORD} characters.`;
  }
  if (!ASSIGNABLE_ROLES.includes(role)) fieldErrors.role = "Pick a role.";
  if (Object.keys(fieldErrors).length > 0) return fail("Please check the form.", fieldErrors);

  const admin = createAdminSupabase();

  const { count } = await admin
    .from("restaurant_members")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", context.restaurantId);

  if ((count ?? 0) >= MAX_STAFF_PER_RESTAURANT) {
    return fail(`You can have up to ${MAX_STAFF_PER_RESTAURANT} accounts on one restaurant.`);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, staff_of: context.restaurantId },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? "";
    if (/already|exists|registered/i.test(message)) {
      return fail("That email already has an account. Use a different one.", {
        email: "This email is already taken.",
      });
    }
    return fail(message || "Could not create the account.");
  }

  const { error: memberError } = await admin.from("restaurant_members").insert({
    restaurant_id: context.restaurantId,
    user_id: created.user.id,
    role,
    display_name: name,
    created_by: context.userId,
    is_active: true,
  });

  if (memberError) {
    // Roll the account back so a failed attempt does not leave an orphan login.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return fail(memberError.message);
  }

  revalidatePath("/dashboard/staff");
  return done(`${name} can now sign in.`);
}

export async function updateStaffAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const context = await requireManagerContext();
  if (!context.ok) return context.error;

  const memberId = str(form, "member_id");
  const name = str(form, "display_name");
  const role = str(form, "role") as AssignableRole;
  const isActive = bool(form, "is_active");
  const password = str(form, "password");

  if (!memberId) return fail("Missing account.");
  if (name.length < 2 || name.length > 60) {
    return fail("Please check the form.", { display_name: "Enter a name (2–60 characters)." });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) return fail("Pick a role.", { role: "Pick a role." });
  if (password && password.length < MIN_STAFF_PASSWORD) {
    return fail("Please check the form.", {
      password: `Use at least ${MIN_STAFF_PASSWORD} characters.`,
    });
  }

  const admin = createAdminSupabase();
  const { data: member } = await admin
    .from("restaurant_members")
    .select("id, user_id, role, restaurant_id")
    .eq("id", memberId)
    .eq("restaurant_id", context.restaurantId)
    .maybeSingle();

  if (!member) return fail("That account is not on your team.");
  if (member.role === "owner") return fail("The owner account cannot be changed here.");
  if (member.user_id === context.userId) return fail("You cannot change your own role.");

  const { error } = await admin
    .from("restaurant_members")
    .update({ display_name: name, role, is_active: isActive })
    .eq("id", member.id);

  if (error) return fail(error.message);

  if (password) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(member.user_id, {
      password,
    });
    if (passwordError) return fail(passwordError.message);
  }

  revalidatePath("/dashboard/staff");
  return done("Account updated.");
}

export async function deleteStaffAction(memberId: string): Promise<ActionState> {
  const context = await requireManagerContext();
  if (!context.ok) return context.error;

  const admin = createAdminSupabase();
  const { data: member } = await admin
    .from("restaurant_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("restaurant_id", context.restaurantId)
    .maybeSingle();

  if (!member) return fail("That account is not on your team.");
  if (member.role === "owner") return fail("The owner account cannot be removed.");
  if (member.user_id === context.userId) return fail("You cannot remove yourself.");

  await admin.from("restaurant_members").delete().eq("id", member.id);

  // Only delete the login itself when it exists for this restaurant alone.
  const [{ count: otherMemberships }, { count: ownedRestaurants }] = await Promise.all([
    admin
      .from("restaurant_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", member.user_id),
    admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", member.user_id),
  ]);

  if ((otherMemberships ?? 0) === 0 && (ownedRestaurants ?? 0) === 0) {
    await admin.auth.admin.deleteUser(member.user_id).catch(() => undefined);
  }

  revalidatePath("/dashboard/staff");
  return done("Account removed.");
}
