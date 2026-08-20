import ky, { HTTPError } from "ky";
import { api, API_BASE } from "./client";
import { connectReturnUrl } from "./social-connect";

/**
 * Instagram **Business Login** endpoints (`instagram-integration/…`).
 *
 * Module-direct routes (NO `q-profile` prefix) backing the `SocialFeedModule`
 * with `configuration: "instagram_connected"` (and interim web-written
 * `"instagram"` blocks in the connected shape). Contract:
 * `app-mobile-project/q-profile-flutter` branch `feature/template-sites` →
 * `docs/plans/social-instagram-feed/server-contract.md` §2, mirrored by mobile
 * `Links.instagram*`. Note the base is `instagram-integration/`, not
 * `instagram/` — the same rename TikTok shipped with (`tiktok-integration/`):
 *
 *   GET    instagram-integration/connect            → { auth_url, state } (owner)
 *   GET    instagram-integration/callback           → Instagram redirect (server-side)
 *   GET    instagram-integration/feed               → PUBLIC normalized PostFeed
 *   DELETE instagram-integration/connections/{id}   → drop a connection  (owner)
 *
 * The routes are LIVE — verified 2026-08-12 on api.qshot.com:
 * `instagram-integration/feed?connection_id=x` answers the contract's own
 * `404 {"error":{"code":"not_found","message":"Unknown connection_id."}}` and
 * `instagram-integration/connect` answers `401 connection_unauthorized`
 * without a bearer — real handlers, not the router's catch-all. The old
 * `instagram/*` paths (an earlier draft of the contract) are dead, which is
 * why this module no longer sniffs the router's HTTP-400 "Route not found"
 * envelope: that special case existed to tell "namespace not deployed" apart
 * from a live route's 400, and a live `instagram-integration/feed` really does
 * answer `400 invalid_request` for bad params (§5).
 *
 * ⚠️ This is a DIFFERENT app identity from `./meta`. Business Login for
 * Instagram uses an Instagram App ID/Secret and `api.instagram.com` +
 * `graph.instagram.com`; a Meta connection's token is not interchangeable, so
 * `meta/connections` rows must never be offered here. Note that `meta/feed`
 * separately accepts `platform=instagram` (Instagram-via-a-Facebook-Page) —
 * that is the OTHER integration and is not what this module talks to.
 *
 * ⚠️ `GET instagram-integration/connections` (the LIST) is **not** in the
 * published contract — mobile never needs it, because
 * `instagram_connect_cubit.dart` learns the new `connection_id` straight from
 * the `qshot://social/connected?connection_id=…&platform=instagram&…` deep
 * link. A browser cannot read a cross-origin popup's result, so this client
 * asks for the list anyway, on the path mobile already reserves for it
 * (`Links.instagramConnections` = `instagram-integration/connections`, the
 * natural REST sibling of the documented DELETE). When the host doesn't serve
 * it, the call resolves `unavailable` and the sheet degrades to a plain "not
 * available right now" panel with Retry. Identical treatment to
 * `listTiktokConnections`.
 *
 * connect / list / delete resolve to a result object carrying `unavailable` /
 * `failed` instead of throwing — same contract as `./meta` and `./tiktok` — so
 * the UI never hangs and never crashes. `getInstagramConnectedFeed` is the one
 * deliberate exception; see its note.
 */

// ─── Models ─────────────────────────────────────────────────────────────────

/**
 * A stored Instagram OAuth connection — one `social_connections` row with
 * `platform = "instagram"` (server-contract.md §1):
 *   `id`               → the `connection_id` stored in the block
 *   `platform_user_id` → Instagram `user_id`
 *   `username`         → the handle
 * `_id` is accepted too because the Meta module returns Mongo ids under that
 * name; `connectionId()` picks whichever is present.
 */
export interface InstagramConnection {
  id?: string;
  _id?: string;
  /** Always `"instagram"` for rows this module returns. */
  platform?: string | null;
  /** Instagram `user_id`. Some builds may spell it out directly. */
  platform_user_id?: string | null;
  ig_user_id?: string | null;
  user_id?: string | null;
  /** Instagram handle. */
  username?: string | null;
  name?: string | null;
  /** `profile_picture_url` on the Instagram side. */
  avatar_url?: string | null;
  /** `active` | `expired` | `revoked`. */
  status?: string | null;
  [key: string]: unknown;
}

/** Result wrapper: `unavailable` means the endpoint is missing on this host. */
export interface InstagramResult<T> {
  data: T;
  /** true when the endpoint answered 404 / 501 — not served here. */
  unavailable: boolean;
  /** true for any other failure (network, 5xx, auth) — retrying may help. */
  failed: boolean;
}

// ─── Envelope helpers ───────────────────────────────────────────────────────

/** Unwrap one optional `data` level (`{ status, data }` vs bare JSON). */
function unwrap(res: unknown): unknown {
  const d = (res as { data?: unknown } | null)?.data;
  return d === undefined ? res : d;
}

/** Pull an array out of `res`, tolerating `[…]`, `{data:[…]}` and `{data:{<key>:[…]}}`. */
function pickArray<T>(res: unknown, ...keys: string[]): T[] {
  const d = unwrap(res);
  if (Array.isArray(d)) return d as T[];
  const obj = d && typeof d === "object" ? (d as Record<string, unknown>) : null;
  if (!obj) return [];
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k] as T[];
  }
  return [];
}

/** 404/501 ⇒ the endpoint simply isn't served on this API host. */
function isMissingRoute(e: unknown): boolean {
  return (
    e instanceof HTTPError &&
    (e.response.status === 404 || e.response.status === 501)
  );
}

async function guard<T>(
  run: () => Promise<T>,
  empty: T,
): Promise<InstagramResult<T>> {
  try {
    return { data: await run(), unavailable: false, failed: false };
  } catch (e) {
    return {
      data: empty,
      unavailable: isMissingRoute(e),
      failed: !isMissingRoute(e),
    };
  }
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * GET `instagram-integration/connect` → the Instagram authorization URL to
 * open in a popup.
 *
 * Contract §2.1 answers `{ auth_url, state }`; mobile reads
 * `data["auth_url"] ?? data["data"]?["auth_url"]` and we accept the same two
 * shapes plus the aliases the Meta client happens to use, so one spelling
 * difference never breaks the flow. `state` is the server's single-use CSRF
 * token — it is embedded in `auth_url` and the client has no use for it, so it
 * is not surfaced.
 *
 * There is NO `platform` parameter on this leg — the route itself is
 * provider-specific. Disambiguation happens on the RETURN (`isInstagramReturn`).
 */
export async function getInstagramConnectUrl(): Promise<
  InstagramResult<string | null>
> {
  return guard<string | null>(async () => {
    // `client=web` + `return_to`: the backend's web-return contract (see
    // social-connect.ts) — the callback redirects the popup back to us with
    // `?status=…&platform=instagram&…` instead of the app's `qshot://` link.
    const returnTo = connectReturnUrl();
    const d = unwrap(
      await api
        .get("instagram-integration/connect", {
          searchParams: returnTo
            ? { client: "web", return_to: returnTo }
            : undefined,
        })
        .json(),
    );
    if (typeof d === "string") return d;
    const obj = (d ?? {}) as Record<string, unknown>;
    const url =
      obj.auth_url ?? obj.authUrl ?? obj.url ?? obj.redirect ?? obj.link;
    return typeof url === "string" && url ? url : null;
  }, null);
}

/**
 * GET `instagram-integration/connections` → the user's stored Instagram
 * connections.
 *
 * Undocumented (see the module header). A 404/501 here is expected on hosts
 * that only deployed the four contracted routes and resolves to
 * `{ unavailable: true }` rather than an exception.
 */
export async function listInstagramConnections(): Promise<
  InstagramResult<InstagramConnection[]>
> {
  return guard<InstagramConnection[]>(
    async () =>
      pickArray<InstagramConnection>(
        await api.get("instagram-integration/connections").json(),
        "connections",
        "instagram_connections",
      ).filter((c) => !!connectionId(c)),
    [],
  );
}

/** DELETE `instagram-integration/connections/{id}` — contract §2.4, answers 204. */
export async function deleteInstagramConnection(
  id: string,
): Promise<InstagramResult<boolean>> {
  return guard<boolean>(async () => {
    await api.delete(`instagram-integration/connections/${id}`);
    return true;
  }, false);
}

// ─── Normalized feed (PostFeed) ─────────────────────────────────────────────

/**
 * The server's normalized post-feed envelope (contract §4) — "same envelope as
 * the other feeds so the app has one model". Field-for-field mirror of mobile
 * `post_feed.dart` (`PostFeed` / `PostProfile` / `PostFeedItem`), including
 * its parse fallbacks, in the contract's own snake_case.
 */
export interface PostFeed {
  profile: PostFeedProfile | null;
  items: PostFeedItem[];
}

export interface PostFeedProfile {
  /** `"instagram"` here; the envelope is shared with meta/tiktok. */
  platform: string;
  username: string;
  /** Mobile falls back to `username` when the server omits `name`; so do we. */
  name: string;
  avatar_url: string | null;
  followers_count: number | null;
  profile_url: string | null;
}

/** Mobile `PostMediaType.parse`: anything unknown reads as `image`. */
export type PostMediaType = "image" | "video" | "article";

export interface PostFeedItem {
  id: string;
  type: PostMediaType;
  /**
   * Required on every item (§4). The server already falls back to `media_url`
   * for images; mobile repeats that fallback client-side and so do we.
   */
  thumbnail_url: string;
  media_url: string | null;
  permalink: string | null;
  title: string | null;
  caption: string | null;
  /** ISO-8601 UTC. */
  timestamp: string | null;
}

const asStrOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

function parsePostMediaType(v: unknown): PostMediaType {
  return v === "video" || v === "article" ? v : "image";
}

function parsePostProfile(raw: Record<string, unknown>): PostFeedProfile {
  const username = asStrOrNull(raw.username) ?? "";
  return {
    platform: asStrOrNull(raw.platform) ?? "",
    username,
    name: asStrOrNull(raw.name) ?? username,
    avatar_url: asStrOrNull(raw.avatar_url),
    followers_count:
      typeof raw.followers_count === "number" ? raw.followers_count : null,
    profile_url: asStrOrNull(raw.profile_url),
  };
}

function parsePostFeedItem(raw: Record<string, unknown>): PostFeedItem {
  return {
    id: asStrOrNull(raw.id) ?? "",
    type: parsePostMediaType(raw.type),
    thumbnail_url:
      asStrOrNull(raw.thumbnail_url) ?? asStrOrNull(raw.media_url) ?? "",
    media_url: asStrOrNull(raw.media_url),
    permalink: asStrOrNull(raw.permalink),
    title: asStrOrNull(raw.title),
    caption: asStrOrNull(raw.caption),
    timestamp: asStrOrNull(raw.timestamp),
  };
}

/** `PostFeed.fromJson`, tolerating the optional `{ status, data }` envelope. */
export function parsePostFeed(res: unknown): PostFeed {
  const d = unwrap(res);
  const obj = d && typeof d === "object" ? (d as Record<string, unknown>) : {};
  const profile =
    obj.profile && typeof obj.profile === "object"
      ? parsePostProfile(obj.profile as Record<string, unknown>)
      : null;
  const items = Array.isArray(obj.items)
    ? obj.items
        .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
        .map(parsePostFeedItem)
    : [];
  return { profile, items };
}

/**
 * `instagram-integration/feed` is PUBLIC (§2.3): the unguessable
 * `connection_id` is the key, no bearer involved. It is deliberately NOT
 * called through the shared `api` client: that client's afterResponse hook
 * logs the user out of qshot on ANY 401, and this endpoint answers
 * `401 connection_unauthorized` when the *Instagram* token has expired or been
 * revoked (§5) — a condition that must surface as "reconnect this feed", never
 * end the builder session. Same base URL and timeout/retry, no auth hooks.
 */
const publicApi = ky.create({
  baseUrl: API_BASE,
  timeout: 30_000,
  retry: { limit: 1, methods: ["get"] },
});

/**
 * GET `instagram-integration/feed` → the normalized `PostFeed` for one
 * connection, for the builder preview. Mirrors mobile
 * `InstagramConnectDataSource.getFeed`: `connection_id` required, `ig_user_id`
 * sent only when non-empty ("a redundant safety check against the
 * connection"), `limit` defaults to 12 (the server's default; max 24).
 *
 * Unlike connect/list/delete this THROWS (ky `HTTPError`) instead of resolving
 * an `unavailable`/`failed` wrapper — exactly like the mobile data source. The
 * guard's 404 ⇒ "route not deployed" reading would be WRONG here: on this
 * route 404 is the contract's own `not_found` ("Unknown connection_id"), and
 * 401 is `connection_unauthorized` (reconnect needed) — statuses a caller must
 * tell apart via `HTTPError.response.status`, not blur into one flag.
 */
export async function getInstagramConnectedFeed(
  connectionId: string,
  igUserId?: string,
  limit = 12,
): Promise<PostFeed> {
  const searchParams: Record<string, string | number> = {
    connection_id: connectionId,
    limit,
  };
  if (igUserId) searchParams.ig_user_id = igUserId;
  return parsePostFeed(
    await publicApi.get("instagram-integration/feed", { searchParams }).json(),
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** The value that goes into `info.connection_id`, whichever key carries it. */
export function connectionId(c: InstagramConnection | null | undefined): string {
  return String(c?.id ?? c?._id ?? "");
}

/** The value that goes into `info.ig_user_id` (optional in the contract). */
export function igUserId(c: InstagramConnection | null | undefined): string {
  return String(c?.platform_user_id ?? c?.ig_user_id ?? c?.user_id ?? "");
}

/** The value that goes into `info.username` — the Instagram handle. */
export function displayName(c: InstagramConnection | null | undefined): string {
  return String(c?.username ?? c?.name ?? "");
}
