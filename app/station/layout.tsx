import type { Metadata } from "next";
import { LiveProvider } from "@/components/realtime/LiveProvider";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { StationShell } from "@/components/station/StationShell";
import { requireStation } from "@/lib/membership";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Station" };

export default async function StationLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireStation();

  const supabase = await createServerSupabase();
  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("sound_enabled")
    .eq("restaurant_id", membership.restaurant.id)
    .maybeSingle();

  return (
    <>
      <PwaSetup />
      <LiveProvider
        restaurantId={membership.restaurant.id}
        role={membership.role}
        soundEnabled={settings?.sound_enabled ?? true}
      >
        <StationShell
          restaurantName={membership.restaurant.name}
          displayName={membership.displayName}
          role={membership.role}
          isManager={membership.isManager}
        >
          {children}
        </StationShell>
      </LiveProvider>
    </>
  );
}
