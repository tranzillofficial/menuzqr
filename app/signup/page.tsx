import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center bg-ink-50 px-4 py-12">
      <AuthForm mode="signup" />
    </main>
  );
}
