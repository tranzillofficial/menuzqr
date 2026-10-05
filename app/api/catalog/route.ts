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
      "id, name, name_en, category_id, description, ingredients, category_name, image_url, variants, suggested_price, suggested_currency, keywords, cuisine, is_active, sort_order, section:catalog_categories(business_types)"
    )
    .eq("is_active", true)
    .is("merged_into_id", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(1000);

  if (error) return NextResponse.json({ items: [] });

  return NextResponse.json(
    { items: (data ?? []).map(item=>{
      // The untyped client infers an array, but this foreign key is many-to-one.
      const section=item.section as unknown as {business_types?:string[]} | null;
      return {...item,business_types:section?.business_types ?? []};
    }) },
    { headers: { "cache-control": "private, max-age=60, stale-while-revalidate=600" } }
  );
}
