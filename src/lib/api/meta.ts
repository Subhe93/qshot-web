import { HTTPError } from "ky";
import { api } from "./client";
import { connectReturnUrl } from "./social-connect";

/**
 * Meta (Facebook Page) feed endpoints.
 *
 * These are module-direct routes (NO `q-profile` prefix) that back the
 * `SocialFeedModule` with `configuration: "facebook"`:
 *
 *   GET    meta/connect                    → { url } OAuth URL to open
 *   GET    meta/callback                   → Meta redirect (server-side only)
 *   GET    meta/pages?connection_id=…      → the connection's Facebook Pages
 *   GET    meta/connections                → the user's Meta connections
 *   DELETE meta/connections/{id}           → drop a connection
 *   GET    meta/feed                       → PUBLIC render endpoint (server-side)
 *
 * IMPORTANT: the routes are deployed on some API hosts only — on others the
 * whole `meta/*` namespace 404s ("Route not found"). Every call below therefore
 * resolves to a result object carrying an `unavailable` flag instead of
 * throwing, so the UI can degrade to a plain "not available right now" state.
 * We never special-case a hostname; availability is discovered at runtime.
 */

// ─── Models ─────────────────────────────────────────────────────────────────

/** A stored Meta OAuth connection. `_id` is what goes into `info.connection_id`. */
export interface MetaConnection {
  _id: string;
  /** Meta user id / account name, when the backend returns them (display only). */
  name?: string | null;
  username?: string | null;
  email?: string | null;
  expired?: boolean | null;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * A Facebook Page reachable through a connection.
 *
 * The server has been seen answering with Graph-style `id`/`name` and with the
 * snake_case shape mobile models (`meta_models.dart` · `MetaPage`:
 * `page_id`, `page_name`, `has_instagram`, `ig_username`). `listMetaPages`
 * normalises both into `id`/`name` so callers only ever read those.
 */
export interface MetaPage {
  id: string;
  name: string;
  /** Optional avatar URL — shapes vary, `pagePicture()` normalises them. */
  picture?: unknown;
  category?: string | null;
  /** Mobile shows an "Instagram linked" hint for these. */
  has_instagram?: boolean | null;
  ig_username?: string | null;
  [key: string]: unknown;
}

/** Result wrapper: `unavailable` means the meta/* routes aren't deployed. */
export interface MetaResult<T> {
  data: T;
  /** true when the endpoint answered 404 / 501 — the feature isn't deployed. */
  unavailable: boolean;
  /** true for any other failure (network, 5xx, auth) — retrying may help. */
  failed: boolean;
}

// ─── Envelope helpers ───────────────────────────────────────────────────────

/**
 * The meta module answers either bare JSON or the q-profile `{ status, data }`
 * envelope depending on the route, so unwrap one optional `data` level.
 */
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

/** 404/501 from the meta namespace ⇒ the routes simply aren't deployed here. */
function isMissingRoute(e: unknown): boolean {
  return (
    e instanceof HTTPError &&
    (e.response.status === 404 || e.response.status === 501)
  );
}

async function guard<T>(
  run: () => Promise<T>,
  empty: T,
): Promise<MetaResult<T>> {
  try {
    return { data: await run(), unavailable: false, failed: false };
  } catch (e) {
    return { data: empty, unavailable: isMissingRoute(e), failed: !isMissingRoute(e) };
  }
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * GET meta/connect → the Meta OAuth consent URL to open in a popup. The backend
 * finishes the handshake on `meta/callback` and stores the connection, so the
 * client only has to re-list connections once the popup closes.
 */
export async function getMetaConnectUrl(): Promise<MetaResult<string | null>> {
  return guard<string | null>(async () => {
    // `client=web` + `return_to`: the backend's web-return contract (see
    // social-connect.ts) — the callback redirects the popup back to us with
    // `?status=…&platform=meta&…` instead of the app's `qshot://` deep link.
    const returnTo = connectReturnUrl();
    const d = unwrap(
      await api
        .get("meta/connect", {
          searchParams: returnTo
            ? { client: "web", return_to: returnTo }
            : undefined,
        })
        .json(),
    );
    if (typeof d === "string") return d;
    const obj = (d ?? {}) as Record<string, unknown>;
    const url = obj.url ?? obj.authUrl ?? obj.auth_url ?? obj.redirect ?? obj.link;
    return typeof url === "string" && url ? url : null;
  }, null);
}

/** GET meta/connections → the user's stored Meta connections. */
export async function listMetaConnections(): Promise<MetaResult<MetaConnection[]>> {
  return guard<MetaConnection[]>(
    async () =>
      pickArray<MetaConnection>(
        await api.get("meta/connections").json(),
        "connections",
        "meta_connections",
      ),
    [],
  );
}

/**
 * GET meta/pages?connection_id= → the Facebook Pages that connection manages.
 * Accepts both the Graph (`id`/`name`) and the mobile (`page_id`/`page_name`)
 * spellings and normalises them to `id`/`name`.
 */
export async function listMetaPages(
  connectionId: string,
): Promise<MetaResult<MetaPage[]>> {
  return guard<MetaPage[]>(
    async () =>
      pickArray<MetaPage>(
        await api
          .get("meta/pages", { searchParams: { connection_id: connectionId } })
          .json(),
        "pages",
        "accounts",
      )
        .filter((p) => p != null)
        .map((p) => ({
          ...p,
          id: String(p.id ?? p.page_id ?? ""),
          name: String(p.name ?? p.page_name ?? ""),
        }))
        .filter((p) => p.id !== ""),
    [],
  );
}

/** DELETE meta/connections/{id}. */
export async function deleteMetaConnection(id: string): Promise<MetaResult<boolean>> {
  return guard<boolean>(async () => {
    await api.delete(`meta/connections/${id}`);
    return true;
  }, false);
}

/**
 * Normalise the many shapes a Graph API picture can take
 * (`"https://…"`, `{ url }`, `{ data: { url } }`) into a plain URL.
 */
export function pagePicture(page: MetaPage | null | undefined): string | null {
  const p: unknown = page?.picture;
  if (typeof p === "string") return p || null;
  const o = p && typeof p === "object" ? (p as Record<string, unknown>) : null;
  if (!o) return null;
  if (typeof o.url === "string") return o.url;
  const inner = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : null;
  return typeof inner?.url === "string" ? inner.url : null;
}
