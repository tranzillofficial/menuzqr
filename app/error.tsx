"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-5">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-500">
          The page could not load. Please try again — if it keeps happening, refresh the browser.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-ink-900 px-5 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
