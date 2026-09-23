/**
 * One-tap durations for a temporary redirect (mobile
 * `domain/temp_redirect_durations.dart`). The guarantee: the app never offers
 * a duration the server would refuse — the top rung is always exactly the
 * plan ceiling, so raising `temporary_redirect_max_days` on the server moves
 * the chips with no release.
 */

/** Rungs a ladder may pass through below the ceiling. */
export const TEMP_REDIRECT_LADDER_STEPS = [1, 3, 7, 14, 30, 60, 90, 180, 365] as const;

/** Top one-tap rung for an admin, who has no ceiling. */
export const TEMP_REDIRECT_UNCAPPED_TOP_DAYS = 30;

/**
 * The largest ceiling the UI is built for, whatever the dashboard says. The
 * value is typed by hand into a backend dashboard; a typo must cost a capped
 * picker, not an end date that overflows. UI only — the server enforces its own.
 */
export const TEMP_REDIRECT_MAX_SANE_DAYS = 3650;

/** At most this many day rungs (plus the 1-hour rung the caller prepends). */
export const TEMP_REDIRECT_MAX_DAY_RUNGS = 3;

/** The server refuses an end time closer than this. */
export const TEMP_REDIRECT_MIN_LEAD_MS = 60_000;

/**
 * Slack on the client's ceiling check. Mobile only enforces the 60 s minimum
 * locally; the top chip is `now + ceiling` taken at tap time, and a slightly
 * stale "now" must never disable it. The server stays the authority.
 */
export const TEMP_REDIRECT_CEILING_SLACK_MS = 60_000;

/** How far the date picker reaches for an admin (mobile `365 * 5`). */
export const TEMP_REDIRECT_ADMIN_PICKER_DAYS = 365 * 5;

const DAY_MS = 86_400_000;

/**
 * Day rungs for a plan whose ceiling is `maxDays` (`null` = admin). The last
 * entry is always exactly the (clamped) ceiling; below it: 1 day plus the
 * largest step at or under half the ceiling — 7 → 1·3·7, 90 → 1·30·90.
 */
export function tempRedirectLadderDays(maxDays: number | null): number[] {
  const requested = maxDays ?? TEMP_REDIRECT_UNCAPPED_TOP_DAYS;
  const top = requested > TEMP_REDIRECT_MAX_SANE_DAYS ? TEMP_REDIRECT_MAX_SANE_DAYS : requested;
  // 0 means the plan does not allow the feature; the sheet is locked first.
  if (top < 1) return [];

  const rungs = new Set<number>();
  if (top > 1) rungs.add(1);
  const half = Math.floor(top / 2);
  let midpoint = 0;
  for (const step of TEMP_REDIRECT_LADDER_STEPS) {
    if (step <= half && step < top) midpoint = step;
  }
  if (midpoint > 1) rungs.add(midpoint);
  rungs.add(top);

  const ordered = [...rungs].sort((a, b) => a - b);
  return ordered.length <= TEMP_REDIRECT_MAX_DAY_RUNGS
    ? ordered
    : ordered.slice(ordered.length - TEMP_REDIRECT_MAX_DAY_RUNGS);
}

/** The latest end the picker may offer, from `now` (`null` ceiling = admin). */
export function tempRedirectLatestEnd(maxDays: number | null, now: Date): Date {
  const days = Math.min(maxDays ?? TEMP_REDIRECT_ADMIN_PICKER_DAYS, TEMP_REDIRECT_MAX_SANE_DAYS);
  return new Date(now.getTime() + days * DAY_MS);
}

/**
 * Whether `endsAt` may be sent: at least 60 s ahead and, for a capped plan,
 * within the ceiling. The server stays the authority either way.
 */
export function isTempRedirectEndValid(
  endsAt: Date,
  maxDays: number | null,
  now: Date,
): boolean {
  const at = endsAt.getTime();
  if (!Number.isFinite(at)) return false;
  if (at <= now.getTime() + TEMP_REDIRECT_MIN_LEAD_MS) return false;
  return (
    maxDays == null ||
    at <= tempRedirectLatestEnd(maxDays, now).getTime() + TEMP_REDIRECT_CEILING_SLACK_MS
  );
}
