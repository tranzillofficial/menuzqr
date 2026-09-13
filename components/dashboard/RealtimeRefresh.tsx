"use client";

/**
 * Deprecated.
 *
 * The live connection now lives in a single place — `LiveProvider`, mounted by
 * the dashboard and station layouts — so a page no longer opens its own
 * channel. Two subscriptions to the same topic was part of why events were
 * being missed. Kept as a no-op so nothing breaks mid-upgrade; safe to delete.
 */
export function RealtimeRefresh(_props: { restaurantId: string }) {
  void _props;
  return null;
}
