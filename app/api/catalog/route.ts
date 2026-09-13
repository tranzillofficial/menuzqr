import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * The shared product catalog, for the "start typing and pick a suggestion"
 * flow in the product editor. Read with the caller's own session so RLS
 * applies; cached by the browser for a minute because it changes rarely.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .select(
      "id, name, description, ingredients, category_name, image_url, variants, keywords, cuisine, is_active, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(1000);

  if (error) return NextResponse.json({ items: [] });

  return NextResponse.json(
    { items: data ?? [] },
    { headers: { "cache-control": "private, max-age=60, stale-while-revalidate=600" } }
  );
}
