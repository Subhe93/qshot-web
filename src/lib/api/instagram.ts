import { HTTPError } from "ky";
import { api } from "./client";

/**
 * Instagram **Business Login** endpoints (`instagram/…`).
 *
 * Module-direct routes (NO `q-profile` prefix) backing the `SocialFeedModule`
 * with `configuration: "instagram"` in its *connected* shape. Contract:
 * `app-mobile-project/q-profile-flutter` →
 * `docs/plans/social-instagram-feed/server-contract.md` §2.
 *
 *   GET    instagram/connect            → { auth_url, state }   (owner)
 *   GET    instagram/callback?code&state→ Instagram redirect     (server-side)
 *   GET    instagram/feed               → PUBLIC render endpoint (server-side)
 *   DELETE instagram/connections/{id}   → drop a connection      (owner)
 *
 * ⚠️ This is a DIFFERENT app identity from `./meta`. Business Login for
 * Instagram uses an Instagram App ID/Secret and `api.instagram.com` +
 * `graph.instagram.com`; a Meta connection's token is not interchangeable, so
 * `meta/connections` rows must never be offered here. Note that `meta/feed`
 * separately accepts `platform=instagram` (Instagram-via-a-Facebook-Page) —
 * that is the OTHER integration and is not what this module talks to.
 *
 * `instagram/feed` is not called from the browser at all: it is the public
 * render path, hit server-side by the published site. The builder only ever
 * needs connect + list + delete.
 *
 * ⚠️ `GET instagram/connections` (the LIST) is **not** in the published
 * contract — mobile never needs it, because it learns the new `connection_id`
 * straight from the `qshot://social/connected?…` deep link. A browser cannot
 * read a cross-origin popup's result, so this client asks for the list anyway
 * (the natural REST sibling of the documented DELETE) and, when it is missing,
 * the call resolves `unavailable` and the sheet degrades to a plain "not
 * available right now" panel with Retry. Identical treatment to
 * `listTiktokConnections`.
 *
 * ⚠️ NONE of these routes are deployed yet. Verified 2026-08-06 against both
 * API hosts: `instagram/connect`, `instagram/connections` and `instagram/feed`
 * all answer the router's not-found envelope, while `meta/feed` and
 * `tiktok-integration/connect` answer for real. Every call below therefore
 * resolves to a result object carrying `unavailable` / `failed` instead of
 * throwing — same contract as `./meta` and `./tiktok` — so the UI never hangs
 * and never crashes.
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

/** Result wrapper: `unavailable` means the `instagram/*` routes are missing. */
export interface InstagramResult<T> {
  data: T;
  /** true when the host says the route does not exist — not deployed. */
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

/**
 * Is this failure "the route isn't deployed here" rather than "the call went
 * wrong"?
 *
 * 404/501 are the textbook answers and are what `./meta` and `./tiktok` look
 * for. The qshot API does NOT always use them: measured 2026-08-06, an unknown
 * path on api.qshot.com and api.speaknet.app answers **HTTP 400** with
 *
 *     {"error":{"name":"Not Found","description":"Route not found",…}}
 *
 * (`/nonsense/route` answers identically, which is what proves it is the
 * router's catch-all and not an argument complaint from a real handler). A
 * plain status check would classify the entire undeployed `instagram/*`
 * namespace as `failed`, i.e. show a generic error instead of the honest
 * "not available yet" panel. So we also sniff that envelope — and only that
 * envelope, so a genuine `400 invalid_request` from the live route later still
 * reads as a failure.
 */
async function isMissingRoute(e: unknown): Promise<boolean> {
  if (!(e instanceof HTTPError)) return false;
  const status = e.response.status;
  if (status === 404 || status === 501) return true;
  if (status !== 400) return false;
  try {
    // `clone()` so the caller's own error handling can still read the body.
    const body = (await e.response.clone().json()) as {
      error?: { name?: unknown; description?: unknown };
    } | null;
    const name = String(body?.error?.name ?? "").toLowerCase();
    const description = String(body?.error?.description ?? "").toLowerCase();
    return name === "not found" || description === "route not found";
  } catch {
    return false;
  }
}

async function guard<T>(
  run: () => Promise<T>,
  empty: T,
): Promise<InstagramResult<T>> {
  try {
    return { data: await run(), unavailable: false, failed: false };
  } catch (e) {
    const missing = await isMissingRoute(e);
    return { data: empty, unavailable: missing, failed: !missing };
  }
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * GET `instagram/connect` → the Instagram authorization URL to open in a popup.
 *
 * Contract §2.1 answers `{ auth_url, state }`; we accept the same aliases the
 * Meta/TikTok clients tolerate so one spelling difference never breaks the flow.
 * `state` is the server's single-use CSRF token — it is embedded in `auth_url`
 * and the client has no use for it, so it is not surfaced.
 *
 * There is NO `platform` parameter on this leg — the route itself is
 * provider-specific. Disambiguation happens on the RETURN (`isInstagramReturn`).
 */
export async function getInstagramConnectUrl(): Promise<
  InstagramResult<string | null>
> {
  return guard<string | null>(async () => {
    const d = unwrap(await api.get("instagram/connect").json());
    if (typeof d === "string") return d;
    const obj = (d ?? {}) as Record<string, unknown>;
    const url =
      obj.auth_url ?? obj.authUrl ?? obj.url ?? obj.redirect ?? obj.link;
    return typeof url === "string" && url ? url : null;
  }, null);
}

/**
 * GET `instagram/connections` → the user's stored Instagram connections.
 *
 * Undocumented (see the module header). A not-found here is expected on every
 * host today and resolves to `{ unavailable: true }` rather than an exception.
 */
export async function listInstagramConnections(): Promise<
  InstagramResult<InstagramConnection[]>
> {
  return guard<InstagramConnection[]>(
    async () =>
      pickArray<InstagramConnection>(
        await api.get("instagram/connections").json(),
        "connections",
        "instagram_connections",
      ).filter((c) => !!connectionId(c)),
    [],
  );
}

/** DELETE `instagram/connections/{id}` — contract §2.4, answers 204. */
export async function deleteInstagramConnection(
  id: string,
): Promise<InstagramResult<boolean>> {
  return guard<boolean>(async () => {
    await api.delete(`instagram/connections/${id}`);
    return true;
  }, false);
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
