import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * The shared image library.
 *
 * Deliberately *not* held in the Next data cache: a stale entry there is
 * invisible and looks exactly like "the admin added images and nobody can see
 * them". Freshness is handled by HTTP caching instead — a browser reuses its
 * copy for a minute, a CDN for five — so the database still stays out of the
 * hot path, and a hard refresh always shows the truth.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ images: [] }, { status: 401 });

  const { data, error } = await supabase
    .from("menu_images")
    .select("id, group_name, category, title, keywords, url")
    .eq("is_active", true)
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ images: [] });
  }

  return NextResponse.json(
    { images: data ?? [] },
    {
      headers: {
        "cache-control": "private, max-age=60, stale-while-revalidate=600",
      },
    }
  );
}
