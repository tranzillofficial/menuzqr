import {getLocale} from "@/lib/i18n/server";
import {getTenantDomain} from "@/lib/tenant-domain";
import {I18nProvider} from "@/components/i18n/I18nProvider";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

/** Guards against protocol-relative ("//evil.com") open-redirect payloads. */
function isSafeNext(next: string | undefined): next is string {
  return Boolean(next) && next!.startsWith("/") && !next!.startsWith("//") && !next!.includes("\\");
}

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const domain=await getTenantDomain();
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center bg-ink-50 px-4 py-12">
      <I18nProvider locale={domain?(domain.restaurants.language==="ar"?"ar":"en"):await getLocale()}><AuthForm mode="login" businessName={domain?.restaurants.name} next={isSafeNext(next) ? next : undefined} /></I18nProvider>
    </main>
  );
}
