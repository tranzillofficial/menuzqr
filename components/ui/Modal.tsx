"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Nested dialogs share one lock. Each modal saving and restoring
 * document.body.style.overflow on its own leaves the page unscrollable when an
 * inner and an outer dialog unmount in the same commit.
 */
let lockCount = 0;
let lockedFrom = "";

export function lockScroll() {
  if (lockCount === 0) {
    lockedFrom = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = lockedFrom;
}

const subscribeMount = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  workspace = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  workspace?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const mounted = useSyncExternalStore(
    subscribeMount,
    clientMounted,
    serverMounted,
  );

  useEffect(() => {
    if (!open || !mounted) return;
    const previousFocus = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel?.contains(document.activeElement)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ),
        ).filter((node) => node.getClientRects().length > 0);
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          e.preventDefault();
          panel.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === panel)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === panel)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    lockScroll();
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      if (
        previousFocus instanceof HTMLElement &&
        document.contains(previousFocus)
      )
        previousFocus.focus();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-6xl",
  } as const;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade-in absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-slide-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl",
          workspace
            ? "h-dvh max-h-dvh rounded-none sm:h-[90dvh] sm:max-h-[92dvh] sm:rounded-2xl"
            : "",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-ink-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 rounded-lg p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div
          className={
            workspace
              ? "min-h-0 flex-1 overflow-y-auto bg-ink-50 p-3 sm:p-5"
              : "flex-1 overflow-y-auto px-5 py-5"
          }
        >
          {children}
        </div>
        {footer && (
          <div
            className={
              workspace
                ? "flex items-center gap-2 border-t border-ink-100 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5"
                : "flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3.5"
            }
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
