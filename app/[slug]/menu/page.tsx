import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicMenu } from "@/lib/menu-data";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { MenuExperience } from "@/components/menu/MenuExperience";
import { MenuUnavailable } from "@/components/menu/MenuUnavailable";

// Activation status is live state — never serve this page from a static cache.
export const dynamic = "force-dynamic";

type Params = { slug: string };
/** `t` is the table code. `table` is the older parameter, still accepted. */
type Search = { t?: string; table?: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  // Same arguments as the page below, so React's cache() serves both from one query.
  const result = await getPublicMenu(slug, search.t ?? search.table);

  if (result.state === "not_found") return { title: "Menu not found" };
  if (result.state === "inactive") {
    return { title: `${result.restaurantName} — menu unavailable`, robots: { index: false } };
  }

  const { restaurant } = result.data;
  return {
    title: `${restaurant.name} — Menu`,
    description:
      restaurant.description ?? `Browse the menu at ${restaurant.name}, powered by MenuzQR.`,
    openGraph: {
      title: `${restaurant.name} — Menu`,
      description: restaurant.description ?? undefined,
      images: restaurant.cover_url ? [restaurant.cover_url] : undefined,
    },
  };
}

export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const tableToken = search.t ?? search.table;

  const result = await getPublicMenu(slug, tableToken);

  if (result.state === "not_found") notFound();

  if (result.state === "inactive") {
    return (
      <MenuUnavailable
        restaurantName={result.restaurantName}
        status={result.status}
        language={result.language}
      />
    );
  }

  const supabase = createAdminSupabase();
  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("show_prices, show_ingredients")
    .eq("restaurant_id", result.data.restaurant.id)
    .maybeSingle();

  // A waiter who scans the table QR while signed in can take the order
  // themselves, even when guest ordering is switched off in settings.
  const staffMode = await isStaffOf(result.data.restaurant.id);

  if (result.data.categories.length === 0) {
    return (
      <MenuUnavailable
        restaurantName={result.data.restaurant.name}
        status="active"
        language={result.data.restaurant.language}
      />
    );
  }

  return (
    <MenuExperience
      data={result.data}
      table={result.table}
      tableToken={tableToken ?? ""}
      showPrices={settings?.show_prices ?? true}
      showIngredients={settings?.show_ingredients ?? true}
      staffMode={staffMode}
    />
  );
}

/** Is the current visitor a signed-in member of this restaurant? */
async function isStaffOf(restaurantId: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await createAdminSupabase()
      .from("restaurant_members")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    return Boolean(data);
  } catch {
    return false;
  }
}
