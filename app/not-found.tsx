import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-5">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm text-ink-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm text-ink-500">
          The menu link may be wrong, or the restaurant may have changed it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-ink-900 px-5 text-sm font-medium text-white"
        >
          Back to MenuzQR
        </Link>
      </div>
    </main>
  );
}
