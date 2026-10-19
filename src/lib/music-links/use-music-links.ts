"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useEditorStore } from "@/stores/editor-store";
import type { Block, MusicLinksBlock } from "@/lib/types/blocks";
import {
  getMusicEntitlements,
  getMusicPlatforms,
  musicLinksKeys,
  type MusicEntitlements,
} from "@/lib/api/music-links";

/**
 * `GET music-links/entitlements` — the Songs block's single source of truth
 * for "may this user add songs" (docs/api-contract.en.md §6.1, §7.1, §7.5).
 *
 * Fetched ONCE per editor open: the builder drops the cached answer when it
 * mounts (`resetMusicEntitlements`) and nothing refetches it afterwards. No
 * retry — a missing route (backend not deployed) or any failure simply means
 * "feature not available here" and must resolve quickly.
 */
export function useMusicEntitlements() {
  return useQuery({
    queryKey: musicLinksKeys.entitlements(),
    queryFn: getMusicEntitlements,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    // A failed answer (e.g. the route is not deployed) stays failed for this
    // editor session — a new reader must not ask again.
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Called by the builder on mount: the next reader fetches a fresh answer. */
export function resetMusicEntitlements(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: musicLinksKeys.entitlements() });
  void queryClient.prefetchQuery({
    queryKey: musicLinksKeys.entitlements(),
    queryFn: getMusicEntitlements,
    retry: false,
  });
}

/** `GET music-links/platforms` — names for the editor; static per session. */
export function useMusicPlatforms(enabled = true) {
  return useQuery({
    queryKey: musicLinksKeys.platforms(),
    queryFn: getMusicPlatforms,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    enabled,
    refetchOnWindowFocus: false,
  });
}

/** Tracks across EVERY Songs block of one page (§3 "per page", §7.5). */
export function countPageTracks(blocks: readonly Block[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type === "MusicLinksModule") n += ((b as MusicLinksBlock).tracks ?? []).length;
  }
  return n;
}

/** The page being edited — `store.blocks` holds exactly the current page. */
export function usePageTrackCount(): number {
  return useEditorStore((s) => countPageTracks(s.blocks));
}

/**
 * How the add-block menu treats "Songs" (§7.1):
 *  - `available` — enabled and switched on: add freely;
 *  - `locked`    — the plan lacks it but the service runs: the usual upgrade prompt;
 *  - `hidden`    — loading, failed, route missing (backend not deployed), or the
 *                  feature is switched off server-side.
 */
export type MusicMenuState = "available" | "locked" | "hidden";

export function musicMenuState(e: MusicEntitlements | undefined): MusicMenuState {
  if (!e) return "hidden";
  if (!e.service_available) return "hidden";
  return e.enabled ? "available" : "locked";
}

/**
 * Whether "Add song" may be used right now, and why not (§6.1, §7.5).
 * `max` is `null` for unlimited (Team plan, admins).
 */
export type AddSongState =
  | { kind: "ok"; max: number | null }
  | { kind: "limit"; max: number }
  | { kind: "locked" }
  | { kind: "unavailable" };

export function addSongState(
  e: MusicEntitlements | undefined,
  pageCount: number,
): AddSongState {
  if (!e || !e.service_available) return { kind: "unavailable" };
  if (!e.enabled) return { kind: "locked" };
  const max = e.is_admin ? null : e.max_tracks_per_page;
  if (max != null && pageCount >= max) return { kind: "limit", max };
  return { kind: "ok", max };
}
