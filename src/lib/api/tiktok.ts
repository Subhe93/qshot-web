import { HTTPError } from "ky";
import { api } from "./client";
import { connectReturnUrl } from "./social-connect";

/**
 * TikTok feed endpoints (`tiktok-integration/…`).
 *
 * Module-direct routes (NO `q-profile` prefix) backing the `SocialFeedModule`
 * with `configuration: "tiktok"`. Note the base is `tiktok-integration/`, not
 * `tiktok/` — mirrors mobile `Links.tiktok*` (commit 121470ef):
 *
 *   GET    tiktok-integration/connect              → { auth_url } consent URL
 *   GET    tiktok-integration/callback             → TikTok redirect (server-side)
 *   GET    tiktok-integration/feed                 → PUBLIC render endpoint
 *   DELETE tiktok-integration/connections/{id}     → drop a connection
 *
 * ⚠️ `GET tiktok-integration/connections` (the LIST) is **not** in the published
 * server contract — mobile never needs it, because it learns the new
 * `connection_id` straight from the `qshot://social/connected?…` deep link.
 * A browser cannot read a cross-origin popup's result, so this client asks for
 * the list anyway (the natural REST sibling of the documented DELETE) and, when
 * it is missing, the call resolves `unavailable` and the sheet degrades to a
 * plain "not available right now" panel with Retry. See `listTiktokConnections`.
 *
 * All TikTok tokens stay on the server; the client only ever sees connection
 * ids and (server-side) the normalized feed. Every call resolves to a result
 * object carrying `unavailable` / `failed` instead of throwing — identical
 * contract to `./meta`, so the UI never hangs and never crashes.
 */

// ─── Models ─────────────────────────────────────────────────────────────────

/**
 * A stored TikTok OAuth connection. Field names follow the server contract's
 * `social_connections` row (`id`, `platform_user_id` = TikTok `open_id`,
 * `username` = display name); `_id` is accepted too because the Meta module
 * returns Mongo ids under that name. `connectionId()` picks whichever is there.
 */
export interface TiktokConnection {
  id?: string;
  _id?: string;
  /** Always `"tiktok"` for rows this module returns. */
  platform?: string | null;
  /** TikTok `open_id`. Some builds spell it `open_id` directly. */
  platform_user_id?: string | null;
  open_id?: string | null;
  /** TikTok `display_name` — display only. */
  username?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  /** `active` | `expired` | `revoked`. */
  status?: string | null;
  [key: string]: unknown;
}

/** Result wrapper: `unavailable` means the tiktok-integration/* routes are missing. */
export interface TiktokResult<T> {
  data: T;
  /** true when the endpoint answered 404 / 501 — the feature isn't deployed. */
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

/** 404/501 ⇒ the routes simply aren't deployed on this API host. */
function isMissingRoute(e: unknown): boolean {
  return (
    e instanceof HTTPError &&
    (e.response.status === 404 || e.response.status === 501)
  );
}

async function guard<T>(
  run: () => Promise<T>,
  empty: T,
): Promise<TiktokResult<T>> {
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
 * GET tiktok-integration/connect → the TikTok consent URL to open in a popup.
 *
 * Mobile reads `data["auth_url"] ?? data["data"]?["auth_url"]`; we accept the
 * same two shapes plus the aliases the Meta module happens to use, so one
 * spelling difference never breaks the flow.
 *
 * There is NO `platform` parameter here — the route itself is provider-specific.
 * Disambiguation happens on the RETURN leg (see `isTiktokReturn`).
 */
export async function getTiktokConnectUrl(): Promise<TiktokResult<string | null>> {
  return guard<string | null>(async () => {
    // `client=web` + `return_to`: the backend's web-return contract (see
    // social-connect.ts) — the callback redirects the popup back to us with
    // `?status=…&platform=tiktok&…` instead of the app's `qshot://` deep link.
    const returnTo = connectReturnUrl();
    const d = unwrap(
      await api
        .get("tiktok-integration/connect", {
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
 * GET tiktok-integration/connections → the user's stored TikTok connections.
 *
 * Undocumented (see the module header). A 404/501 here is expected on hosts
 * that only deployed the four contracted routes and resolves to
 * `{ unavailable: true }` rather than an exception.
 */
export async function listTiktokConnections(): Promise<
  TiktokResult<TiktokConnection[]>
> {
  return guard<TiktokConnection[]>(
    async () =>
      pickArray<TiktokConnection>(
        await api.get("tiktok-integration/connections").json(),
        "connections",
        "tiktok_connections",
      ).filter((c) => !!connectionId(c)),
    [],
  );
}

/** DELETE tiktok-integration/connections/{id}. */
export async function deleteTiktokConnection(
  id: string,
): Promise<TiktokResult<boolean>> {
  return guard<boolean>(async () => {
    await api.delete(`tiktok-integration/connections/${id}`);
    return true;
  }, false);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** The value that goes into `info.connection_id`, whichever key carries it. */
export function connectionId(c: TiktokConnection | null | undefined): string {
  return String(c?.id ?? c?._id ?? "");
}

/** The value that goes into `info.open_id` (optional in the contract). */
export function openId(c: TiktokConnection | null | undefined): string {
  return String(c?.platform_user_id ?? c?.open_id ?? "");
}

/** The value that goes into `info.username` (display only). */
export function displayName(c: TiktokConnection | null | undefined): string {
  return String(c?.username ?? c?.name ?? "");
}
