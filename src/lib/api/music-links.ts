import { HTTPError } from "ky";
import { useAuthStore } from "@/stores/auth-store";
import { api, httpErrorBody, isWrapped401Body } from "./client";

/**
 * `music-links/*` — the Songs block's editor-side API
 * (docs/api-contract.en.md §6). Every route needs the bearer token and answers
 * `200 { success: true, data }` or `{ success: false, error: { code, message,
 * …extra } }`. Failures throw `MusicLinksError` — branch on its `code`, never
 * on `message` (§9.1, §10.7).
 *
 * NEVER call these from a published-page renderer (§10.2): the canvas preview
 * renders the block from the page JSON only.
 *
 * Retries are OFF on every call: a `rate_limited` / `in_progress` answer is
 * handled by the UI (countdown / one delayed retry), and a blind retry of a
 * paid provider lookup is exactly what §10.3 asks us not to do.
 */

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * The §9.1 codes, plus three client-side ones:
 *  - `route_missing` — a 404 with no `error.code` (the backend has not deployed
 *    `music-links/*` yet: "Route not found");
 *  - `network`       — no HTTP answer at all (offline, timeout, CORS);
 *  - `unknown`       — an HTTP failure whose body carries no code.
 */
export type MusicLinksErrorCode =
  | "unauthorized"
  | "feature_not_in_plan"
  | "feature_disabled"
  | "invalid_request"
  | "unsupported_link"
  | "not_a_track"
  | "not_found"
  | "rate_limited"
  | "refresh_cooldown"
  | "in_progress"
  | "provider_unauthorized"
  | "upstream_error"
  | "internal_error"
  | "route_missing"
  | "network"
  | "unknown"
  | (string & {});

export class MusicLinksError extends Error {
  readonly code: MusicLinksErrorCode;
  /** HTTP status, `null` without a response. */
  readonly status: number | null;
  /** Seconds, from `error.retry_after` (or the Retry-After header). */
  readonly retryAfter: number | null;
  /** `unsupported_link`: the pasted link's host. */
  readonly host: string | null;
  /** `not_a_track`: what the link is instead (album, artist, …). */
  readonly type: string | null;
  /** `invalid_request`: the server's field details. */
  readonly details: unknown[] | null;

  constructor(init: {
    code: MusicLinksErrorCode;
    status?: number | null;
    message?: string;
    retryAfter?: number | null;
    host?: string | null;
    type?: string | null;
    details?: unknown[] | null;
  }) {
    super(init.message || init.code);
    this.name = "MusicLinksError";
    this.code = init.code;
    this.status = init.status ?? null;
    this.retryAfter = init.retryAfter ?? null;
    this.host = init.host ?? null;
    this.type = init.type ?? null;
    this.details = init.details ?? null;
  }

  /** "Try again later" family: provider down, unexpected, or no code at all. */
  get isServerSide(): boolean {
    return (
      this.code === "provider_unauthorized" ||
      this.code === "upstream_error" ||
      this.code === "internal_error" ||
      this.code === "unknown" ||
      (this.status != null && this.status >= 500 && this.code !== "feature_disabled")
    );
  }
}

const asNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const asStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Read a `{ success: false, error: {…} }` body (or anything else) into a
 * `MusicLinksError`. Exported for the save path, which reads the same
 * envelope off the profile save routes (§9.2).
 */
export function readMusicLinksErrorBody(
  status: number | null,
  body: unknown,
  retryAfterHeader?: string | null,
): MusicLinksError {
  const top = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const err = (top.error && typeof top.error === "object" ? top.error : {}) as Record<
    string,
    unknown
  >;
  let code = asStr(err.code);
  const message = asStr(err.message) ?? asStr(top.message) ?? (typeof top.error === "string" ? top.error : null);
  if (!code) {
    if (status === 401 || isWrapped401Body(body)) code = "unauthorized";
    else if (status === 404) code = "route_missing";
    else code = "unknown";
  }
  return new MusicLinksError({
    code,
    status,
    message: message ?? undefined,
    retryAfter: asNum(err.retry_after) ?? asNum(retryAfterHeader),
    host: asStr(err.host),
    type: asStr(err.type),
    details: Array.isArray(err.details) ? err.details : null,
  });
}

/** Any thrown value → `MusicLinksError`. */
export async function toMusicLinksError(e: unknown): Promise<MusicLinksError> {
  if (e instanceof MusicLinksError) return e;
  if (e instanceof HTTPError) {
    const body = await httpErrorBody(e);
    // An invalid session can arrive as a 400 wrapping a 401 — the client hook
    // only sees real 401s, so sign out here (the usual re-login flow, §9.1).
    if (e.response.status === 400 && isWrapped401Body(body)) {
      useAuthStore.getState().logout();
    }
    return readMusicLinksErrorBody(
      e.response.status,
      body,
      e.response.headers.get("retry-after"),
    );
  }
  return new MusicLinksError({
    code: "network",
    message: e instanceof Error ? e.message : String(e),
  });
}

// ─── Typed readers ───────────────────────────────────────────────────────────

export interface MusicEntitlements {
  /** Show "Songs" in the add-block menu and allow adding songs. */
  enabled: boolean;
  /** `false` while switched off server-side: existing blocks render, no adding. */
  service_available: boolean;
  /** Ceiling per page; `null` = unlimited. */
  max_tracks_per_page: number | null;
  is_admin: boolean;
  /** How many platforms to pre-select before "Show more" (6). */
  default_visible_count: number;
}

export interface MusicPlatform {
  id: string;
  name_ar: string;
  name_en: string;
  order: number;
  /** `false` = the server does not fetch it today (TikTok). */
  enabled: boolean;
}

export interface MusicPlatformsResponse {
  default_visible_count: number;
  platforms: MusicPlatform[];
}

export interface MusicSearchCandidate {
  title: string;
  artist: string | null;
  artists: string[];
  cover_url: string | null;
  /** What to send to `resolve` when the user picks it. */
  link: string;
  /** Not null when the server already stores the song (instant resolve). */
  known_isrc: string | null;
}

export interface MusicSearchResponse {
  query: string;
  country: string | null;
  source: "provider" | "cache" | string;
  candidates: MusicSearchCandidate[];
}

export interface MusicResolvedTrack {
  isrc: string;
  title: string;
  artist: string | null;
  artists: string[];
  cover_url: string | null;
  preview_url: string | null;
  duration_ms: number | null;
}

export interface MusicResolvedPlatform {
  platform: string;
  name_ar: string;
  name_en: string;
  order: number;
  /** Pre-select + show before "Show more". */
  default_visible: boolean;
  /** Keep EXACTLY as returned (§10.5). */
  url: string;
}

/** `resolve`, `tracks/:isrc` and `tracks/:isrc/refresh` share this `data`. */
export interface MusicResolveResponse {
  source: "provider" | "cache" | string;
  fetched_at: string | null;
  refreshed_at: string | null;
  track: MusicResolvedTrack;
  /** Only platforms WITH a link, in display order. */
  platforms: MusicResolvedPlatform[];
  /** Platforms where the song was not found — no button for them. */
  missing: string[];
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** `data` of a success envelope; a body without one is a protocol error. */
function dataOf(body: unknown): Raw {
  const top = obj(body);
  if (top.success === false) throw readMusicLinksErrorBody(200, body);
  return obj(top.data);
}

export function readEntitlements(body: unknown): MusicEntitlements {
  const d = dataOf(body);
  const max = d.max_tracks_per_page;
  return {
    enabled: d.enabled === true,
    service_available: d.service_available !== false,
    max_tracks_per_page: typeof max === "number" && Number.isFinite(max) ? max : null,
    is_admin: d.is_admin === true,
    default_visible_count: asNum(d.default_visible_count) ?? 6,
  };
}

export function readPlatforms(body: unknown): MusicPlatformsResponse {
  const d = dataOf(body);
  const platforms = (Array.isArray(d.platforms) ? d.platforms : [])
    .map(obj)
    .filter((p) => typeof p.id === "string" && p.id)
    .map((p) => ({
      id: str(p.id),
      name_ar: str(p.name_ar),
      name_en: str(p.name_en),
      order: asNum(p.order) ?? 0,
      enabled: p.enabled !== false,
    }));
  return { default_visible_count: asNum(d.default_visible_count) ?? 6, platforms };
}

export function readSearch(body: unknown): MusicSearchResponse {
  const d = dataOf(body);
  const candidates = (Array.isArray(d.candidates) ? d.candidates : [])
    .map(obj)
    .filter((c) => typeof c.link === "string" && c.link)
    .map((c) => ({
      title: str(c.title),
      artist: strOrNull(c.artist),
      artists: strList(c.artists),
      cover_url: strOrNull(c.cover_url),
      link: str(c.link),
      known_isrc: strOrNull(c.known_isrc),
    }));
  return {
    query: str(d.query),
    country: strOrNull(d.country),
    source: str(d.source),
    candidates,
  };
}

export function readResolve(body: unknown): MusicResolveResponse {
  const d = dataOf(body);
  const t = obj(d.track);
  const platforms = (Array.isArray(d.platforms) ? d.platforms : [])
    .map(obj)
    .filter((p) => typeof p.platform === "string" && p.platform && typeof p.url === "string" && p.url)
    .map((p) => ({
      platform: str(p.platform),
      name_ar: str(p.name_ar),
      name_en: str(p.name_en),
      order: asNum(p.order) ?? 0,
      default_visible: p.default_visible === true,
      url: str(p.url),
    }));
  return {
    source: str(d.source),
    fetched_at: strOrNull(d.fetched_at),
    refreshed_at: strOrNull(d.refreshed_at),
    track: {
      isrc: str(t.isrc),
      title: str(t.title),
      artist: strOrNull(t.artist),
      artists: strList(t.artists),
      cover_url: strOrNull(t.cover_url),
      preview_url: strOrNull(t.preview_url),
      duration_ms: asNum(t.duration_ms),
    },
    platforms,
    missing: strList(d.missing),
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

async function call<T>(run: () => Promise<unknown>, read: (body: unknown) => T): Promise<T> {
  let body: unknown;
  try {
    body = await run();
  } catch (e) {
    throw await toMusicLinksError(e);
  }
  return read(body);
}

/** §6.1 — call once when the editor opens; never fails because of the plan. */
export function getMusicEntitlements(): Promise<MusicEntitlements> {
  return call(() => api.get("music-links/entitlements", { retry: 0 }).json(), readEntitlements);
}

/** §6.2 — the registry, for names (icons are vendored locally). */
export function getMusicPlatforms(): Promise<MusicPlatformsResponse> {
  return call(() => api.get("music-links/platforms", { retry: 0 }).json(), readPlatforms);
}

/** §6.3 — `q` must be 2–120 chars (callers debounce ≥ 400 ms, §10.3). */
export function searchMusic(
  q: string,
  country?: string,
  signal?: AbortSignal,
): Promise<MusicSearchResponse> {
  const searchParams: Record<string, string> = { q };
  if (country) searchParams.country = country;
  return call(
    () => api.get("music-links/search", { searchParams, retry: 0, signal }).json(),
    readSearch,
  );
}

/** §6.4 — exactly one of `link` / `isrc`. Up to ~5 s for a new song. */
export function resolveMusic(
  input: { link: string; country?: string } | { isrc: string; country?: string },
): Promise<MusicResolveResponse> {
  return call(
    () => api.post("music-links/resolve", { json: input, retry: 0 }).json(),
    readResolve,
  );
}

/** §6.5 — cache only; `not_found` → fall back to `resolve { isrc }`. */
export function getMusicTrack(isrc: string): Promise<MusicResolveResponse> {
  return call(
    () => api.get(`music-links/tracks/${encodeURIComponent(isrc)}`, { retry: 0 }).json(),
    readResolve,
  );
}

/** §6.6 — once per 7 days per song (`refresh_cooldown` + `retry_after`). */
export function refreshMusicTrack(isrc: string): Promise<MusicResolveResponse> {
  return call(
    () => api.post(`music-links/tracks/${encodeURIComponent(isrc)}/refresh`, { retry: 0 }).json(),
    readResolve,
  );
}

/** `GET tracks/:isrc`, falling back to `resolve { isrc }` on `not_found` (§6.5). */
export async function loadMusicTrack(isrc: string): Promise<MusicResolveResponse> {
  try {
    return await getMusicTrack(isrc);
  } catch (e) {
    if (e instanceof MusicLinksError && e.code === "not_found") return resolveMusic({ isrc });
    throw e;
  }
}

// ─── react-query keys ────────────────────────────────────────────────────────

export const musicLinksKeys = {
  all: ["music-links"] as const,
  entitlements: () => ["music-links", "entitlements"] as const,
  platforms: () => ["music-links", "platforms"] as const,
  search: (q: string, country?: string) => ["music-links", "search", q, country ?? ""] as const,
  track: (isrc: string) => ["music-links", "track", isrc] as const,
};

// ─── Save-route errors (§9.2) ────────────────────────────────────────────────

/** A Songs-specific refusal from a profile/page save route. */
export interface MusicSaveError {
  code: "track_limit_exceeded" | "feature_not_in_plan" | "feature_disabled";
  /** `track_limit_exceeded`: the page ceiling and the count the save carried. */
  limit: number | null;
  count: number | null;
}

/**
 * Read §9.2's 403 / 503 bodies off a failed `q-profile/user/edit`,
 * `user/create`, `multi-page/store` or `multi-page/update-info`:
 * `{ success: false, error: { code, message, limit?, count?, feature? } }`.
 * Anything else (incl. the 422 `ProfileValidationError`) → `null`, so the
 * caller's existing handling runs. A `feature_not_in_plan` naming a DIFFERENT
 * plan feature is not ours either.
 */
export async function readMusicSaveError(e: unknown): Promise<MusicSaveError | null> {
  if (!(e instanceof HTTPError)) return null;
  const status = e.response.status;
  if (status !== 403 && status !== 503) return null;
  const err = obj(obj(await httpErrorBody(e)).error);
  const code = err.code;
  if (code !== "track_limit_exceeded" && code !== "feature_not_in_plan" && code !== "feature_disabled") {
    return null;
  }
  if (typeof err.feature === "string" && err.feature && !err.feature.startsWith("music_links")) {
    return null;
  }
  return { code, limit: asNum(err.limit), count: asNum(err.count) };
}
