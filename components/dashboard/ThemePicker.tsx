"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMenuThemeAction } from "@/lib/actions/restaurant";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { MENU_THEMES, type MenuThemeId } from "@/lib/constants";
import { cn } from "@/lib/utils";

function Preview({ theme }: { theme: MenuThemeId }) {
  if (theme === "elegant") {
    return (
      <div className="h-full bg-[#faf7f2] p-3">
        <div className="h-10 rounded-md bg-gradient-to-r from-[#2f2a24] to-[#544a3d]" />
        <div className="mt-2 space-y-2">
          <div className="mx-auto h-2 w-16 rounded bg-[#b9a88d]" />
          <div className="h-16 rounded-md bg-[#e6ddcd]" />
          <div className="mx-6 h-1.5 rounded bg-[#cfc2ab]" />
          <div className="mx-10 h-1.5 rounded bg-[#ded3bf]" />
          <div className="h-16 rounded-md bg-[#e6ddcd]" />
        </div>
      </div>
    );
  }
  if (theme === "modern") {
    return (
      <div className="h-full bg-white p-3">
        <div className="flex gap-1.5">
          <div className="h-4 w-10 rounded-full bg-ink-900" />
          <div className="h-4 w-8 rounded-full bg-ink-200" />
          <div className="h-4 w-9 rounded-full bg-ink-200" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-ink-200">
              <div className="h-9 bg-gradient-to-br from-brand-200 to-brand-300" />
              <div className="space-y-1 p-1.5">
                <div className="h-1.5 w-3/4 rounded bg-ink-300" />
                <div className="h-1.5 w-1/2 rounded bg-ink-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="h-full bg-white p-3">
      <div className="h-3 w-20 rounded bg-ink-800" />
      <div className="mt-3 space-y-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <div className="h-1.5 w-2/3 rounded bg-ink-400" />
              <div className="h-1.5 w-1/2 rounded bg-ink-200" />
            </div>
            <div className="h-1.5 w-6 rounded bg-ink-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemePicker({
  current,
  slug,
  isActive,
}: {
  current: MenuThemeId;
  slug: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<MenuThemeId>(current);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_THEMES.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelected(theme.id)}
              aria-pressed={active}
              className={cn(
                "overflow-hidden rounded-2xl border-2 bg-white text-left transition-all",
                active
                  ? "border-brand-500 shadow-md ring-2 ring-brand-100"
                  : "border-ink-200 hover:border-ink-300"
              )}
            >
              <div className="h-44 border-b border-ink-100">
                <Preview theme={theme.id} />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink-900">{theme.name}</p>
                  {current === theme.id && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                      Current
                    </span>
                  )}
                  {active && current !== theme.id && (
                    <Icon.check className="size-4 text-brand-600" />
                  )}
                </div>
                <p className="mt-0.5 text-xs font-medium text-brand-700">{theme.tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{theme.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4">
        <p className="text-sm text-ink-600">
          Changing the design never touches your categories, products, sizes or prices.
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            href={`/${slug}/menu`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Icon.external className="size-4" />
            {isActive ? "Preview live menu" : "Open menu link"}
          </Link>
          <Button
            disabled={selected === current || pending}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateMenuThemeAction(selected);
                toast(result?.message ?? "Saved.", result?.ok ? "success" : "error");
                router.refresh();
              })
            }
          >
            {selected === current ? "Design applied" : `Use ${MENU_THEMES.find((t) => t.id === selected)?.name}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
