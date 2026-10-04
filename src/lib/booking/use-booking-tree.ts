"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchBookingServicesTree, type BookingServiceNode } from "./booking-tree";

/**
 * The public services tree for one profile, as the website booking block reads
 * it — the web twin of the mobile `BookingPublicRepository` +
 * `BookingPublicCubit` (docs/booking-block-layouts.md §5.2).
 *
 * React Query gives the repository's guarantees for free:
 *  - per-profile memo for 5 minutes (`staleTime`), so every booking block on a
 *    page, every rebuild and every preview toggle share one cached tree;
 *  - a shared in-flight request (observers of one key join the same fetch);
 *  - a failed background refresh keeps the tree already on screen — the error
 *    state is only shown when there is nothing to show yet (`isError && !data`).
 *
 * Freshness, mirroring mobile:
 *  - the editor forces a fresh fetch when it opens (§5.2): `refetchOnMount:
 *    "always"` on the query, and BuilderShell drops the cached tree when it
 *    loads a site ({@link invalidateBookingTree});
 *  - the booking dashboard lives in ANOTHER tab (opened by "Manage booking",
 *    see use-open-booking-dashboard.ts) with its own QueryClient, so its
 *    change events can never reach this tab's cache. Instead the tree is
 *    dropped when this window regains focus after the dashboard was opened
 *    ({@link useBookingFocusInvalidation}).
 */

export const BOOKING_TREE_KEY = "booking-services-tree";
const TTL_MS = 5 * 60 * 1000;

export function bookingTreeKey(profileId: string) {
  return [BOOKING_TREE_KEY, profileId] as const;
}

/** Drops the cached tree (and detaches any request in flight) so the next read
 *  goes to the network — mobile `invalidate(profileId)`. */
export function invalidateBookingTree(qc: QueryClient, profileId: string): void {
  void qc.invalidateQueries({ queryKey: bookingTreeKey(profileId) });
}

export function useBookingServicesTree(profileId: string | null) {
  return useQuery<BookingServiceNode[]>({
    queryKey: bookingTreeKey(profileId ?? ""),
    queryFn: () => fetchBookingServicesTree(profileId as string),
    enabled: !!profileId,
    staleTime: TTL_MS,
    gcTime: TTL_MS,
    // A block that (re)mounts fetches fresh data in the background while the
    // cached tree stays on screen (mobile: forced fetch on editor open).
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}

/** Set when "Manage booking" opened the dashboard in another tab; the next
 *  focus of this window drops that profile's tree (the owner may have edited
 *  services there). */
const pendingFocusInvalidation = new Set<string>();

export function markBookingDashboardOpened(profileId: string): void {
  pendingFocusInvalidation.add(profileId);
}

export function useBookingFocusInvalidation(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const onFocus = () => {
      for (const id of pendingFocusInvalidation) invalidateBookingTree(qc, id);
      pendingFocusInvalidation.clear();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [qc]);
}
