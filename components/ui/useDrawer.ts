"use client";

import { useEffect } from "react";
import { lockScroll, unlockScroll } from "./Modal";

/**
 * The behaviour a slide-over needs and a plain `{open && <div/>}` does not:
 * Escape closes it, the page behind stops scrolling, and it closes itself on
 * navigation (browser back included, which a per-link onClick never catches).
 *
 * Shares the modal's lock counter, so a dialog opened from inside a drawer
 * cannot leave the page unscrollable when both unmount together.
 */
export function useDrawer(open: boolean, onClose: () => void, routeKey?: string) {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    lockScroll();

    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) onClose();
    // Only the route matters here: re-running on `open` would close it instantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
}
