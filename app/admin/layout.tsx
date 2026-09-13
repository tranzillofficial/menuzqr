import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/Icons";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { getT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n";

const NAV: Array<{ href: string; label: TranslationKey }> = [
  { href: "/admin", label: "admin.restaurants" },
  { href: "/admin/users", label: "admin.users" },
  { href: "/admin/library", label: "admin.imageLibrary" },
  { href: "/admin/catalog", label: "admin.catalog" },
  { href: "/admin/qr-designs", label: "admin.qrDesigns" },
  { href: "/admin/platform", label: "admin.platform" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [supabase, t] = await Promise.all([createServerSupabase(), getT()]);
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

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-ink-900 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Icon.shield className="size-5" />
            MenuzQR Admin
          </Link>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LocaleSwitch tone="dark" className="hidden sm:inline-flex" />
            <span className="hidden max-w-40 truncate text-xs text-white/50 sm:block" title={profile.email ?? ""}>
              {profile.email}
            </span>
            <Link
              href="/dashboard"
              className="whitespace-nowrap rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              {t("nav.myDashboard")}
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon.logout className="size-4" />
                {t("common.signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
