"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export type AiResult = {
  nameSuggestions: string[];
  description: string;
  ingredients: string[];
  categorySuggestion: string;
  variantSuggestions: string[];
  categorySuggestions: string[];
};

export async function requestAi(
  task: string,
  input: Record<string, string>
): Promise<{ ok: true; data: AiResult } | { ok: false; message: string }> {
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, input }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        message: payload?.message ?? "AI suggestions are temporarily unavailable.",
      };
    }
    return { ok: true, data: payload.data as AiResult };
  } catch {
    return { ok: false, message: "AI suggestions are temporarily unavailable." };
  }
}

export function AiButton({
  label = "Suggest with AI",
  task,
  input,
  onResult,
  disabled,
  className,
}: {
  label?: string;
  task: string;
  input: () => Record<string, string>;
  onResult: (data: AiResult) => void;
  disabled?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={async () => {
        setLoading(true);
        const result = await requestAi(task, input());
        setLoading(false);
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        onResult(result.data);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-60",
        className
      )}
    >
      <Icon.sparkles className={cn("size-3.5", loading && "animate-spin")} />
      {loading ? "Generating…" : label}
    </button>
  );
}

export function SuggestionChips({
  items,
  onPick,
  onDismiss,
  title,
}: {
  items: string[];
  onPick: (value: string) => void;
  onDismiss: () => void;
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-brand-800">{title}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-brand-700 underline-offset-2 hover:underline"
        >
          Dismiss
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs text-ink-800 transition-colors hover:border-brand-400 hover:bg-brand-50"
          >
            {item}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-brand-800/70">
        AI-generated suggestions — review before saving. Not verified nutrition or allergy
        information.
      </p>
    </div>
  );
}
