"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Lock, RotateCw } from "lucide-react";
import type { MusicLinksError } from "@/lib/api/music-links";
import { useUpgradeDialog } from "@/components/plan/upgrade-dialog";
import { musicErrorKey } from "./music-errors";

/** A failure plus the moment it happened (countdowns start there). */
export interface MusicErrorState {
  error: MusicLinksError;
  at: number;
}

/** Stamp a failure with "now" (module-level, so it is never a render-time call). */
export function errorState(error: MusicLinksError): MusicErrorState {
  return { error, at: Date.now() };
}

// One shared 1 s clock for every countdown on screen. It only runs while a
// countdown is subscribed, and restarts from the real time when it does.
let clockNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(onTick: () => void): () => void {
  clockListeners.add(onTick);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    clockListeners.delete(onTick);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}
const noSubscribe = () => () => {};
const readClock = () => clockNow;
const readZero = () => 0;

/**
 * Whole seconds left before a `retry_after` failure unlocks (0 when it is not
 * one), ticking once a second. "Now" is the shared clock, but never earlier
 * than the failure itself — so the first frame shows the full wait.
 */
export function useSecondsLeft(state: MusicErrorState | null): number {
  const until = unlockAt(state);
  const now = useSyncExternalStore(
    until == null ? noSubscribe : subscribeClock,
    until == null ? readZero : readClock,
    readZero,
  );
  if (until == null || state == null) return 0;
  return Math.max(0, Math.ceil((until - Math.max(now, state.at)) / 1000));
}

/** The moment a `retry_after` error unlocks again, or null. */
export function unlockAt(state: MusicErrorState | null): number | null {
  if (!state || state.error.retryAfter == null) return null;
  if (state.error.code !== "rate_limited" && state.error.code !== "refresh_cooldown") return null;
  return state.at + state.error.retryAfter * 1000;
}

/**
 * Inline error for a `music-links/*` failure (contract §9.1). `rate_limited`
 * counts down from `retry_after` and only then offers "Try again";
 * `feature_not_in_plan` offers the app's upgrade prompt.
 */
export function MusicErrorNote({
  state,
  onRetry,
}: {
  state: MusicErrorState;
  onRetry?: () => void;
}) {
  const t = useTranslations("musicLinks.errors");
  const tm = useTranslations("musicLinks");
  const showUpgrade = useUpgradeDialog((s) => s.show);
  const key = musicErrorKey(state.error);
  const left = useSecondsLeft(state);

  let text: string;
  if (key === "rateLimited") {
    text = left > 0 ? t("rateLimited", { seconds: left }) : t("rateLimitedNow");
  } else {
    text = t(key);
  }
  const retryable =
    onRetry &&
    left === 0 &&
    (key === "rateLimited" || key === "inProgress" || key === "server" || key === "network");

  return (
    <div
      role="alert"
      data-testid="music-error"
      data-code={state.error.code}
      className="flex items-start gap-2 rounded-xl bg-error/10 px-3 py-2.5 text-sm text-error"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p>{text}</p>
        {key === "notInPlan" && (
          <button
            type="button"
            onClick={showUpgrade}
            className="brand-gradient inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Lock className="size-3" />
            {tm("upgrade")}
          </button>
        )}
        {retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-error/15 px-3 py-1.5 text-xs font-semibold"
          >
            <RotateCw className="size-3" />
            {tm("tryAgain")}
          </button>
        )}
      </div>
    </div>
  );
}
