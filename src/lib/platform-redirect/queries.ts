"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimCode,
  deletePlatformLink,
  getPlatformRedirect,
  getPlatformRegistry,
  relabelCode,
  setPlatformLink,
  toPlatformRedirectError,
  unlinkCode,
} from "@/lib/api/platform-redirect";
import type {
  ClaimResult,
  PlatformCode,
  PlatformLink,
  PlatformRedirectOverview,
} from "./model";
import { PlatformRedirectError } from "./errors";

/**
 * Query keys. `platformRedirectKeys.overview` is ALSO invalidated by the live
 * plan channel (`components/plan/plan-live-updates.tsx`) — the "plan-change
 * signal" reload of integration guide §7.2.
 */
export const platformRedirectKeys = {
  overview: ["platform-redirect"] as const,
  registry: ["platform-redirect", "platforms"] as const,
};

export function usePlatformRedirect(enabled = true) {
  return useQuery({
    queryKey: platformRedirectKeys.overview,
    queryFn: getPlatformRedirect,
    enabled,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

/** Public registry — cacheable for a minute (api-design §3.1). */
export function usePlatformRegistry(enabled = true) {
  return useQuery({
    queryKey: platformRedirectKeys.registry,
    queryFn: getPlatformRegistry,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

// ── Local updates from write responses (§7.2 "or update the item locally") ──

type Updater = (prev: PlatformRedirectOverview) => PlatformRedirectOverview;

function withPlatform(
  prev: PlatformRedirectOverview,
  platform: string,
  map: (entry: PlatformRedirectOverview["platforms"][number]) => PlatformRedirectOverview["platforms"][number],
): PlatformRedirectOverview {
  return {
    ...prev,
    platforms: prev.platforms.map((p) => (p.platform === platform ? map(p) : p)),
  };
}

export function applyLinkSaved(platform: string, link: PlatformLink): Updater {
  return (prev) => withPlatform(prev, platform, (p) => ({ ...p, link }));
}

export function applyLinkDeleted(platform: string): Updater {
  return (prev) => withPlatform(prev, platform, (p) => ({ ...p, link: null }));
}

export function applyCodeClaimed(platform: string, code: PlatformCode): Updater {
  return (prev) => {
    const existing = prev.platforms
      .find((p) => p.platform === platform)
      ?.codes.some((c) => c.code === code.code);
    const next = withPlatform(prev, platform, (p) => ({
      ...p,
      codes: existing
        ? p.codes.map((c) => (c.code === code.code ? code : c))
        : [...p.codes, code],
    }));
    return existing ? next : { ...next, quota: { ...next.quota, used: next.quota.used + 1 } };
  };
}

export function applyCodeRelabeled(platform: string, code: PlatformCode): Updater {
  return (prev) =>
    withPlatform(prev, platform, (p) => ({
      ...p,
      codes: p.codes.map((c) => (c.code === code.code ? { ...c, label: code.label } : c)),
    }));
}

export function applyCodeUnlinked(platform: string, code: string): Updater {
  return (prev) => {
    const had = prev.platforms.find((p) => p.platform === platform)?.codes.some((c) => c.code === code);
    const next = withPlatform(prev, platform, (p) => ({
      ...p,
      codes: p.codes.filter((c) => c.code !== code),
    }));
    return had ? { ...next, quota: { ...next.quota, used: Math.max(0, next.quota.used - 1) } } : next;
  };
}

export type WriteOutcome<T> = { ok: true; value: T } | { ok: false; error: PlatformRedirectError };

/**
 * The write side. Every action: call → apply the response to the cached
 * overview immediately → invalidate so the server's truth lands next. A 200
 * whose body could not be read still counts as success and forces a re-read.
 * `busy` serialises actions (mobile's `busy` guard); `onError` lets the screen
 * react globally (reload on PLATFORM_PAUSED, upgrade sheet on 403).
 */
export function usePlatformRedirectActions(options?: {
  onError?: (error: PlatformRedirectError) => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onError = options?.onError;

  const run = useCallback(
    async <T,>(
      call: () => Promise<T | null>,
      apply: (value: T) => Updater,
    ): Promise<WriteOutcome<T | null>> => {
      setBusy(true);
      try {
        const value = await call();
        await queryClient.cancelQueries({ queryKey: platformRedirectKeys.overview });
        if (value != null) {
          queryClient.setQueryData<PlatformRedirectOverview>(platformRedirectKeys.overview, (prev) =>
            prev ? apply(value)(prev) : prev,
          );
        }
        void queryClient.invalidateQueries({ queryKey: platformRedirectKeys.overview });
        return { ok: true, value };
      } catch (e) {
        const error = await toPlatformRedirectError(e);
        if (error.needsReload) {
          void queryClient.invalidateQueries({ queryKey: platformRedirectKeys.overview });
        }
        onError?.(error);
        return { ok: false, error };
      } finally {
        setBusy(false);
      }
    },
    [queryClient, onError],
  );

  const saveLink = useCallback(
    (platform: string, url: string) =>
      run<PlatformLink>(
        () => setPlatformLink(platform, url),
        (link) => applyLinkSaved(platform, link),
      ),
    [run],
  );

  const removeLink = useCallback(
    (platform: string) =>
      run<boolean>(
        async () => deletePlatformLink(platform),
        () => applyLinkDeleted(platform),
      ),
    [run],
  );

  const claim = useCallback(
    (platform: string, code: string, label: string | null) =>
      run<ClaimResult>(
        () => claimCode({ platform, code, label }),
        (result) => applyCodeClaimed(platform, result.code),
      ),
    [run],
  );

  const rename = useCallback(
    (platform: string, code: string, label: string | null) =>
      run<PlatformCode>(
        () => relabelCode(platform, code, label),
        (row) => applyCodeRelabeled(platform, row),
      ),
    [run],
  );

  const unlink = useCallback(
    (platform: string, code: string) =>
      run<PlatformCode | boolean>(
        async () => (await unlinkCode(platform, code)) ?? true,
        () => applyCodeUnlinked(platform, code),
      ),
    [run],
  );

  return { busy, saveLink, removeLink, claim, rename, unlink };
}
