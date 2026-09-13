"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { bool, done, fail, getOwnedRestaurant, str } from "./helpers";

function revalidate() {
  revalidatePath("/dashboard/tables");
  revalidatePath("/dashboard/qr-codes");
  revalidatePath("/dashboard");
}

export async function saveTableAction(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const id = str(form, "id");
  const label = str(form, "label");
  if (!label) return fail("Table name is required.", { label: "Required." });

  const supabase = await createServerSupabase();

  if (id) {
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ label, is_active: bool(form, "is_active") })
      .eq("id", id)
      .eq("restaurant_id", owned.restaurant.id);
    if (error) return fail(error.message);
  } else {
    const { count } = await supabase
      .from("restaurant_tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", owned.restaurant.id);

    const { error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: owned.restaurant.id,
      label,
      sort_order: (count ?? 0) * 10,
      is_active: bool(form, "is_active"),
    });
    if (error) return fail(error.message);
  }

  revalidate();
  return done(id ? "Table updated." : "Table added.");
}

export async function createTablesBulkAction(
  count: number,
  prefix = "Table"
): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const total = Math.min(Math.max(Math.floor(count), 1), 60);
  const label = prefix.trim().slice(0, 20) || "Table";

  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("restaurant_tables")
    .select("label, sort_order")
    .eq("restaurant_id", owned.restaurant.id);

  const taken = new Set((existing ?? []).map((t) => t.label.toLowerCase()));
  const base = existing?.length ?? 0;

  const rows: { restaurant_id: string; label: string; sort_order: number }[] = [];
  let n = 1;
  while (rows.length < total && n < 500) {
    const candidate = `${label} ${n}`;
    if (!taken.has(candidate.toLowerCase())) {
      rows.push({
        restaurant_id: owned.restaurant.id,
        label: candidate,
        sort_order: (base + rows.length) * 10,
      });
    }
    n += 1;
  }

  if (rows.length === 0) return fail("Those tables already exist.");

  const { error } = await supabase.from("restaurant_tables").insert(rows);
  if (error) return fail(error.message);

  revalidate();
  return done(`${rows.length} tables created.`);
}

export async function deleteTableAction(id: string): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurant_tables")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id);
  if (error) return fail(error.message);

  revalidate();
  return done("Table deleted. Its printed QR code will stop working.");
}

export async function toggleTableAction(id: string, isActive: boolean): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurant_tables")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id);
  if (error) return fail(error.message);

  revalidate();
  return done(isActive ? "Table enabled." : "Table disabled.");
}

/** Invalidates a printed QR (e.g. if a code leaked) by issuing a new token. */
export async function regenerateTableTokenAction(id: string): Promise<ActionState> {
  const owned = await getOwnedRestaurant();
  if (!owned.ok) return owned.error;

  // Same shape as the database trigger: 8 characters, no look-alike glyphs.
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const token = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("restaurant_tables")
    .update({ qr_token: token })
    .eq("id", id)
    .eq("restaurant_id", owned.restaurant.id);
  if (error) return fail(error.message);

  revalidate();
  return done("New QR code generated. Reprint this table's code.");
}
