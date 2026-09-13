import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/dashboard");

  return <AdminShell email={profile.email ?? ""}>{children}</AdminShell>;
}
