"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccount } from "@/lib/api/account";
import {
  fetchTempRedirect,
  startTempRedirect,
  stopTempRedirect,
  toTempRedirectError,
} from "@/lib/api/temp-redirect";
import type { TempRedirect } from "@/lib/temp-redirect/model";
import type { TempRedirectError } from "@/lib/temp-redirect/errors";
import {
  isTempRedirectPlanLocked,
  tempRedirectEntitlementOf,
  type TempRedirectEntitlement,
} from "@/lib/temp-redirect/entitlement";
import {
  clipTempRedirectText,
  TEMP_REDIRECT_MAX_LABEL_LENGTH,
  TEMP_REDIRECT_MAX_SOURCE_LENGTH,
} from "@/lib/temp-redirect/targets";

const DAY_MS = 86_400_000;
/** `setTimeout` fires immediately past a signed 32-bit delay (~24.8 days). */
const MAX_TIMER_MS = 2_147_483_647;

/** A v4 UUID. `crypto.randomUUID` exists only in secure contexts, so dev over
 *  plain-http LAN falls back to `getRandomValues`. */
function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context — fall through */
    }
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const tempRedirectQueryKey = (profileId: string) => ["tempRedirect", profileId] as const;

export interface TempRedirectGate {
  /** False until the account has loaded — nothing is decided before that. */
  loaded: boolean;
  /** The account read failed: start stays locked (reading and stopping never
   *  depend on it) and the entry point retries the read instead. */
  failed: boolean;
  retry: () => void;
  entitlement: TempRedirectEntitlement | null;
  /** Gates the START flow only. Reading and stopping are never gated. */
  planLocked: boolean;
  /** `null` = no ceiling (admin). */
  maxDays: number | null;
}

/**
 * The plan gate for starting a redirect. Reads `plan.planFeatures` through the
 * dedicated parser (missing code = disabled, "true"/"false" strings) — never
 * through `usePlan().isAvailable`, whose legacy semantics are the opposite.
 */
export function useTempRedirectGate(): TempRedirectGate {
  const { data: account, isError, refetch } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
    staleTime: 60_000,
  });
  const retry = () => void refetch();
  if (!account) {
    return {
      loaded: false,
      failed: isError,
      retry,
      entitlement: null,
      planLocked: true,
      maxDays: 0,
    };
  }
  const entitlement = tempRedirectEntitlementOf(account);
  return {
    loaded: true,
    failed: false,
    retry,
    entitlement,
    planLocked: isTempRedirectPlanLocked(entitlement),
    maxDays: entitlement.maxDays,
  };
}

export interface StartTempRedirectInput {
  url: string;
  label: string | null;
  source: string | null;
  endsAt: Date;
}

/** `ok: false` with `error: null` = refused because another action was in
 *  flight (mobile's `busy` guard) — not a success, nothing to show. */
export type TempRedirectOutcome =
  | { ok: true }
  | { ok: false; error: TempRedirectError | null };

export interface TempRedirectController {
  /** What the SERVER says is serving now; `undefined` until the first read. */
  active: TempRedirect | null | undefined;
  /** First read in flight with nothing to show — the banner shimmers. */
  waiting: boolean;
  /** The read failed and nothing trustworthy is on screen — "Couldn't check". */
  failed: boolean;
  busy: boolean;
  actionError: TempRedirectError | null;
  refetch: () => void;
  start: (input: StartTempRedirectInput) => Promise<TempRedirectOutcome>;
  stop: () => Promise<TempRedirectOutcome>;
  clearActionError: () => void;
}

/**
 * The one redirect a profile may have running (mobile `TempRedirectCubit`).
 *
 * The server is the only authority: nothing here expires a redirect locally.
 * It reads on mount (screen entry), on window focus (app resume), and once a
 * couple of seconds past `endsAt` — and that timer only re-READS.
 */
export function useTempRedirect(profileId: string, enabled: boolean): TempRedirectController {
  const queryClient = useQueryClient();
  const queryKey = tempRedirectQueryKey(profileId);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchTempRedirect(profileId),
    enabled: enabled && Boolean(profileId),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Stamped so a newer successful read retires it — a failed Stop must not
  // leave its line under a banner that has since been re-read.
  const [failure, setFailure] = useState<{ error: TempRedirectError; at: number } | null>(null);
  const setActionError = useCallback(
    (error: TempRedirectError | null) => setFailure(error ? { error, at: Date.now() } : null),
    [],
  );
  // A confirming read that failed after a successful start: the redirect IS
  // running, so the banner must say "couldn't check" rather than keep showing
  // the pre-start "nothing active". Cleared by any newer successful read.
  const [confirmFailedAt, setConfirmFailedAt] = useState(0);

  const endsAt = query.data?.endsAt?.getTime() ?? null;
  useEffect(() => {
    if (!enabled || endsAt == null) return;
    const delay = endsAt - Date.now();
    // Past already, or beyond any plan ceiling: focus and remount cover both.
    if (delay < 0 || delay > 31 * DAY_MS || delay + 2_000 > MAX_TIMER_MS) return;
    const timer = setTimeout(() => {
      void queryClient.refetchQueries({ queryKey: tempRedirectQueryKey(profileId) });
    }, delay + 2_000);
    return () => clearTimeout(timer);
  }, [enabled, endsAt, profileId, queryClient]);

  const onFailure = useCallback(
    (error: TempRedirectError) => {
      if (error.isProfileNotFound) void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setActionError(error);
    },
    [queryClient, setActionError],
  );

  const start = useCallback(
    async (input: StartTempRedirectInput): Promise<TempRedirectOutcome> => {
      if (busyRef.current) return { ok: false, error: null };
      busyRef.current = true;
      setBusy(true);
      setActionError(null);
      const key = tempRedirectQueryKey(profileId);
      // One key per user tap (a "Change" is a new tap), reused only by the
      // CONFLICT retry below. The server answers an old key with the row it
      // created even after that row ended, so reusing one across taps would
      // report success while changing nothing.
      const clientRequestId = newRequestId();
      let allowConflictRetry = true;
      try {
        for (;;) {
          try {
            const started = await startTempRedirect({
              profileId,
              url: input.url,
              label: clipTempRedirectText(input.label, TEMP_REDIRECT_MAX_LABEL_LENGTH),
              source: clipTempRedirectText(input.source, TEMP_REDIRECT_MAX_SOURCE_LENGTH),
              endsAt: input.endsAt,
              clientRequestId,
            });
            // An older read still in flight must not land on top of this answer.
            await queryClient.cancelQueries({ queryKey: key });
            if (started) {
              queryClient.setQueryData(key, started);
            } else {
              // Succeeded, body unreadable: the redirect is running — re-read.
              try {
                await queryClient.fetchQuery({
                  queryKey: key,
                  queryFn: () => fetchTempRedirect(profileId),
                  staleTime: 0,
                });
              } catch {
                setConfirmFailedAt(Date.now());
              }
            }
            return { ok: true };
          } catch (e) {
            const error = await toTempRedirectError(e);
            // Two stores collided: retry ONCE with the SAME key (contract §7).
            if (allowConflictRetry && error.isConflict) {
              allowConflictRetry = false;
              continue;
            }
            onFailure(error);
            return { ok: false, error };
          }
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [profileId, queryClient, onFailure, setActionError],
  );

  const stop = useCallback(async (): Promise<TempRedirectOutcome> => {
    if (busyRef.current) return { ok: false, error: null };
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    const key = tempRedirectQueryKey(profileId);
    try {
      await stopTempRedirect(profileId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, null);
      return { ok: true };
    } catch (e) {
      const error = await toTempRedirectError(e);
      onFailure(error);
      return { ok: false, error };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [profileId, queryClient, onFailure, setActionError]);

  const hasData = query.data !== undefined;
  const confirmFailed = confirmFailedAt > query.dataUpdatedAt;
  return {
    active: confirmFailed ? undefined : query.data,
    waiting: !hasData && query.isFetching,
    failed: confirmFailed || (!hasData && query.isError && !query.isFetching),
    busy,
    actionError: failure && failure.at > query.dataUpdatedAt ? failure.error : null,
    refetch: () => {
      setConfirmFailedAt(0);
      setFailure(null);
      void query.refetch();
    },
    start,
    stop,
    clearActionError: () => setActionError(null),
  };
}
