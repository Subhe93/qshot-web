import { api as baseApi } from "./client";
import type { ApiResponse } from "@/lib/types/api";

// This feature's backend currently lives on speaknet.app (separate from the main
// qshot API base). Reuse the shared client's auth (bearer token + 401 handling)
// via `.extend`, but override the base URL for every /custom-links call.
// Override with NEXT_PUBLIC_CUSTOM_LINKS_API_BASE if it moves.
const CUSTOM_LINKS_BASE =
  process.env.NEXT_PUBLIC_CUSTOM_LINKS_API_BASE ?? "https://api.speaknet.app";
const api = baseApi.extend({ baseUrl: CUSTOM_LINKS_BASE });

// ─── Types ───────────────────────────────────────────────────────────────────

/** A metadata-source type hint understood by the link platform (cover/title
 * fetching). Distinct from {@link LinkPlatform}: has `vimeo`/`twitter`, no `x`. */
export type LinkType =
  | "youtube"
  | "spotify"
  | "tiktok"
  | "vimeo"
  | "instagram"
  | "facebook"
  | "twitter"
  | "custom";

/**
 * The link-SERVING platform (UpdatedApi.md §1): decides the short-URL subdomain
 * (`youtube.qshot.it/{slug}`, custom → `link.qshot.it`) and the scope of slug
 * uniqueness. Required on create, IMMUTABLE afterwards (stripped on update).
 * Seven frozen values — no `vimeo`, and Twitter is `x` here (metadata `type`
 * stays `twitter`).
 */
export type LinkPlatform =
  | "youtube"
  | "tiktok"
  | "spotify"
  | "instagram"
  | "x"
  | "facebook"
  | "custom";

/** Picker order for the create sheet (product decision 2026-07-22): YouTube
 * first (auto-selected), then Instagram/TikTok/Facebook/Spotify/X; `custom` is
 * hidden for now (still accepted for legacy rows). */
export const LINK_PLATFORMS: { platform: LinkPlatform; label: string }[] = [
  { platform: "youtube", label: "YouTube" },
  { platform: "instagram", label: "Instagram" },
  { platform: "tiktok", label: "TikTok" },
  { platform: "facebook", label: "Facebook" },
  { platform: "spotify", label: "Spotify" },
  { platform: "x", label: "X" },
];

/** platform → metadata `type` (UpdatedApi.md §1: platform "x" fetches metadata
 * with type "twitter"; every other value maps 1:1). */
export function platformToType(p: LinkPlatform): LinkType {
  return p === "x" ? "twitter" : p;
}

/** metadata `type` → platform. `twitter` → `x`; `vimeo` has no serving platform
 * of its own → `custom`. Unknown values also degrade to `custom`. */
export function typeToPlatform(t: string | undefined | null): LinkPlatform {
  if (t === "twitter") return "x";
  if (
    t === "youtube" ||
    t === "tiktok" ||
    t === "spotify" ||
    t === "instagram" ||
    t === "x" ||
    t === "facebook"
  ) {
    return t;
  }
  return "custom";
}

/** Short-URL subdomain host for a platform (custom is served from `link.`).
 * ONLY for display hints / legacy fallbacks — always prefer the server's
 * `short_url` (UpdatedApi.md §2.5: never compose the URL yourself). */
export function platformShortHost(p: LinkPlatform | string | undefined): string {
  const sub = !p || p === "custom" ? "link" : p;
  return `${sub}.qshot.it`;
}

/** Cover metadata Suwut resolved for a link (stored on the row). */
export interface LinkPayload {
  title?: string;
  subtitle?: string;
  image?: string;
  type?: string;
  [k: string]: unknown;
}

/**
 * A single smart-link row as returned by qshot (`/custom-links`). The public
 * share URL is the response's `short_url` (`https://{platform}.qshot.it/{slug}`
 * since the qshot.it migration) — ALWAYS read it, never build it (§2.5).
 * `qshot_id` is injected server-side and must NEVER be sent by the client.
 */
export interface CustomLink {
  id: number;
  user_id: number;
  qshot_id: string;
  /** The serving platform (new, §2.4). Absent only on pre-migration rows. */
  platform?: LinkPlatform | string;
  link: string;
  name: string;
  iOS: string;
  iPad: string;
  Android: string;
  Fallback: string;
  payload?: LinkPayload;
  total_clicks: number;
  short_url?: string;
  /** The pasted source URL the deep links were derived from (may be absent). */
  source_url?: string;
  created_at: string;
  updated_at: string;
  /** Per-day click tallies (show endpoint only). */
  clicks?: { type: string; date: string; count: number }[];
  [k: string]: unknown;
}

/**
 * The create/update body. Client builds the per-platform deep links and passes
 * them through; `type` + `source_url` let the backend auto-fetch cover/title.
 * `platform` is REQUIRED on create (400 without it) and immutable afterwards —
 * update strips it before sending (§2.1/§2.3).
 * NEVER include `qshot_id` — qshot injects it and strips any client value.
 */
export interface LinkInput {
  platform?: LinkPlatform;
  link: string;
  name: string;
  iOS: string;
  iPad: string;
  Android: string;
  Fallback: string;
  non_Google_Huawei?: string | null;
  Blackberry?: string | null;
  Fire_OS?: string | null;
  Windows_Mobile?: string | null;
  type?: LinkType;
  source_url?: string;
}

/** Result of `check-slug` — whether the candidate slug is free. */
export interface SlugCheck {
  available: boolean;
  normalized: string;
  suggestion: string;
  reason: string;
}

/** Cover metadata preview (no save). Suwut returns `[]` when it can't resolve. */
export interface MetadataPreview {
  title?: string;
  subtitle?: string;
  image?: string;
  color?: string | null;
  type?: string;
  fetched_at?: string;
}

/** Aggregate click analytics across all of the current user's links. */
export interface LinkStats {
  qshot_id: string;
  links_count: number;
  totals: {
    clicks: number;
    clicks_today: number;
    clicks_7d: number;
    clicks_30d: number;
    clicks_window: number;
  };
  by_platform: { type: string; count: number }[];
  daily: { date: string; count: number }[];
  by_link: {
    id: number;
    link: string;
    name: string;
    short_url: string;
    clicks: number;
    created_at: string;
  }[];
  window: { from: string; to: string; days: number };
}

/** The Suwut service-account profile — integration health / whoami. */
export interface Connection {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  show_promotional_ad?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

// The list endpoint nests the rows under `data.links` alongside a count.
interface CustomLinkList {
  qshot_id?: string;
  links_count?: number;
  links?: CustomLink[];
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/** GET custom-links — every link owned by the current user. */
export async function listCustomLinks(): Promise<CustomLink[]> {
  const res = await api
    .get("custom-links")
    .json<ApiResponse<CustomLinkList>>();
  return res.data?.links ?? [];
}

/** GET custom-links/:id — one link (owned); 404 if not found / not owned. */
export async function getCustomLink(id: number | string): Promise<CustomLink> {
  const res = await api
    .get(`custom-links/${id}`)
    .json<ApiResponse<CustomLink>>();
  return res.data;
}

/** POST custom-links — create a link owned by the current user. `platform` is
 * required (400 without it, §2.1). */
export async function createCustomLink(
  input: LinkInput & { platform: LinkPlatform },
): Promise<CustomLink> {
  const res = await api
    .post("custom-links", { json: input })
    .json<ApiResponse<CustomLink>>();
  return res.data;
}

/** PUT custom-links/:id — update one of your links (same body as create).
 * `platform` is immutable — stripped here so we never rely on the server's
 * leniency (§2.3: it ignores the field, but the doc says don't send it). */
export async function updateCustomLink(
  id: number | string,
  input: LinkInput,
): Promise<CustomLink> {
  const body = { ...input };
  delete body.platform;
  const res = await api
    .put(`custom-links/${id}`, { json: body })
    .json<ApiResponse<CustomLink>>();
  return res.data;
}

/** DELETE custom-links/:id — delete one of your links. */
export async function deleteCustomLink(
  id: number | string,
): Promise<ApiResponse<unknown>> {
  return api.delete(`custom-links/${id}`).json<ApiResponse<unknown>>();
}

/**
 * GET custom-links/check-slug — confirm a slug is free before create/update.
 * Slug uniqueness is PER PLATFORM since the qshot.it migration, so `platform`
 * is a required query param (422 without it, §2.2) — re-check whenever the
 * user changes the platform. Pass `ignoreId` (the current link id) when
 * editing so its own slug isn't flagged as taken.
 */
export async function checkSlug(
  slug: string,
  platform: LinkPlatform | string,
  ignoreId?: number | string,
): Promise<SlugCheck> {
  const searchParams: Record<string, string> = { slug, platform: String(platform) };
  if (ignoreId != null) searchParams.ignore_id = String(ignoreId);
  const res = await api
    .get("custom-links/check-slug", { searchParams })
    .json<ApiResponse<SlugCheck>>();
  return res.data;
}

/**
 * GET custom-links/metadata/preview — live cover/title preview (no save).
 * Suwut returns `data: []` when it can't resolve → we return `null`.
 */
export async function previewMetadata(
  type: LinkType | string,
  url: string,
): Promise<MetadataPreview | null> {
  const res = await api
    .get("custom-links/metadata/preview", { searchParams: { type, url } })
    .json<ApiResponse<MetadataPreview | unknown[]>>();
  const data = res.data;
  if (Array.isArray(data)) return null;
  return (data as MetadataPreview) ?? null;
}

/**
 * POST custom-links/:id/refresh-metadata — re-fetch cover art/title. With no
 * body, Suwut reuses the link's stored `payload.type` and `Fallback` URL.
 */
export async function refreshMetadata(
  id: number | string,
  body?: { type?: LinkType | string; source_url?: string },
): Promise<CustomLink> {
  const res = await api
    .post(`custom-links/${id}/refresh-metadata`, { json: body ?? {} })
    .json<ApiResponse<CustomLink>>();
  return res.data;
}

/** GET custom-links/stats — aggregate analytics for my links (days 1..365). */
export async function getLinkStats(days = 30): Promise<LinkStats> {
  // Mobile clamps to the API's accepted window (days.clamp(1, 365)).
  const clamped = Math.min(Math.max(days, 1), 365);
  const res = await api
    .get("custom-links/stats", { searchParams: { days: String(clamped) } })
    .json<ApiResponse<LinkStats>>();
  return res.data;
}

/** GET custom-links/connection — Suwut service-account profile (health/whoami). */
export async function getConnection(): Promise<Connection> {
  const res = await api
    .get("custom-links/connection")
    .json<ApiResponse<Connection>>();
  return res.data;
}

// ─── Errors (UpdatedApi.md §6) ───────────────────────────────────────────────

/**
 * Resolve a user-displayable message for a /custom-links error. The backend
 * wraps everything in `{ error: { name, description } }`:
 *  - 400 (field validation): `description.message` is an ARRAY of displayable
 *    strings — show the first.
 *  - 422/404/…: `description` is just a tracing uuid (hidden in production) —
 *    NEVER show it; rely on the status code and show the local fallback.
 */
export async function customLinksErrorMessage(
  e: unknown,
  fallbacks: { taken: string; generic: string },
): Promise<{ message: string; status?: number }> {
  const res = (e as { response?: Response } | null)?.response;
  if (!res) return { message: fallbacks.generic };
  const status = res.status;
  if (status === 400) {
    try {
      const body = (await res.clone().json()) as {
        error?: { description?: { message?: unknown } };
      };
      const msgs = body?.error?.description?.message;
      if (Array.isArray(msgs) && msgs.length > 0) {
        return { message: String(msgs[0]), status };
      }
    } catch {
      /* not JSON — fall through */
    }
  }
  if (status === 422) return { message: fallbacks.taken, status };
  return { message: fallbacks.generic, status };
}
