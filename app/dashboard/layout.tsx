import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/Shell";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const [{ data: profile }, { data: restaurant }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    supabase
      .from("restaurants")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  let soundEnabled = true;
  if (restaurant) {
    const { data: settings } = await supabase
      .from("restaurant_settings")
      .select("sound_enabled")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    soundEnabled = settings?.sound_enabled ?? true;
  }

  return (
    <DashboardShell
      restaurantName={restaurant?.name ?? null}
      restaurantId={restaurant?.id ?? null}
      soundEnabled={soundEnabled}
      isAdmin={Boolean(profile?.is_admin)}
      userEmail={user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
