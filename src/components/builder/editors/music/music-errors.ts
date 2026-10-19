import type { MusicLinksError } from "@/lib/api/music-links";

/**
 * `MusicLinksError` → message key under `musicLinks.errors` (contract §9.1).
 * Branches on `code` only — never on the server's `message` (§10.7).
 * `rate_limited` / `refresh_cooldown` carry a countdown and are rendered by
 * their callers; `unauthorized` is the usual re-login flow (the API client has
 * already signed the user out).
 */
export type MusicErrorKey =
  | "unsupportedLink"
  | "notATrack"
  | "notFound"
  | "rateLimited"
  | "inProgress"
  | "notInPlan"
  | "disabled"
  | "invalid"
  | "unauthorized"
  | "network"
  | "server";

export function musicErrorKey(e: MusicLinksError): MusicErrorKey {
  switch (e.code) {
    case "unsupported_link":
      return "unsupportedLink";
    case "not_a_track":
      return "notATrack";
    case "not_found":
      return "notFound";
    case "rate_limited":
    case "refresh_cooldown":
      return "rateLimited";
    case "in_progress":
      return "inProgress";
    case "feature_not_in_plan":
      return "notInPlan";
    case "feature_disabled":
    case "route_missing":
      return "disabled";
    case "invalid_request":
      return "invalid";
    case "unauthorized":
      return "unauthorized";
    case "network":
      return "network";
    default:
      return "server";
  }
}

/** Seconds → the largest whole unit, for "available in …". */
export function cooldownParts(seconds: number): { unit: "days" | "hours" | "minutes" | "seconds"; n: number } {
  const s = Math.max(0, Math.ceil(seconds));
  if (s >= 86400) return { unit: "days", n: Math.ceil(s / 86400) };
  if (s >= 3600) return { unit: "hours", n: Math.ceil(s / 3600) };
  if (s >= 60) return { unit: "minutes", n: Math.ceil(s / 60) };
  return { unit: "seconds", n: s };
}
