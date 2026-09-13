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
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center bg-ink-50 px-4 py-12">
      <AuthForm mode="login" next={isSafeNext(next) ? next : undefined} />
    </main>
  );
}
