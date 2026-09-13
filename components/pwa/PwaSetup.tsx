"use client";

import { useEffect } from "react";

/** Registers the service worker once per session. */
export function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      // Service workers need a secure context; on a LAN IP this simply
      // does not apply and the dashboard still works while it is open.
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // An older browser, or a private window — never block the app.
    });
  }, []);

  return null;
}
