import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/Shell";
import { LiveProvider } from "@/components/realtime/LiveProvider";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

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

  const [{ data: profile }, membership] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    getMembership(),
  ]);

  // Waiters and chefs have their own screen; the dashboard is for the people
  // who run the restaurant.
  if (membership && !membership.isManager) redirect("/station");

  if (!membership) {
    // No *active* membership. If the account has a switched-off one, it is a
    // disabled staff login — without this it would fall through to restaurant
    // onboarding and quietly become the owner of a brand new restaurant.
    const { count } = await supabase
      .from("restaurant_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) > 0) redirect("/disabled");
  }

  const restaurant = membership?.restaurant ?? null;

  let soundEnabled = true;
  if (restaurant) {
    const { data: settings } = await supabase
      .from("restaurant_settings")
      .select("sound_enabled")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    soundEnabled = settings?.sound_enabled ?? true;
  }

  const shell = (
    <DashboardShell
      restaurantName={restaurant?.name ?? null}
      restaurantId={restaurant?.id ?? null}
      isAdmin={Boolean(profile?.is_admin)}
      userEmail={user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );

  return (
    <>
      <PwaSetup />
      {restaurant ? (
        <LiveProvider
          restaurantId={restaurant.id}
          role={membership?.role ?? "owner"}
          soundEnabled={soundEnabled}
        >
          {shell}
        </LiveProvider>
      ) : (
        shell
      )}
    </>
  );
}
