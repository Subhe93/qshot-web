/**
 * ⚠️ Shared return-path disambiguation for the social **connect** flows
 * (Meta/Facebook, TikTok and Instagram Business Login).
 *
 * All of them finish on ONE return path. On mobile the deep-link handler
 * matches on the `/connected` path tail and fires the same tag for every
 * provider, so `TiktokConnectCubit` and `MetaConnectCubit` would each consume
 * the other's callback. Mobile commit 121470ef fixed that by filtering on the
 * `platform` query parameter the server puts on its redirect:
 *
 *     qshot://social/connected?connection_id={id}&platform=tiktok&username={name}
 *     qshot://social/error?platform=tiktok&reason={code}
 *
 * The filters are deliberately ASYMMETRIC:
 *
 * - `tiktok_connect_cubit.dart` — strict allow-list:
 *   `if (uri.queryParameters['platform'] != 'tiktok') return;`
 *   TikTok is the newer arrival, so every TikTok callback is guaranteed to
 *   carry the parameter.
 * - `meta_connect_cubit.dart` — tolerant deny-list: ignore only when `platform`
 *   is PRESENT and is neither `meta` nor `facebook`. Meta callbacks predate the
 *   parameter and may still arrive without it, so a missing value must still
 *   count as Meta.
 *
 * The web port has the identical collision, just on a different transport:
 * `window.postMessage` is a global channel, so a TikTok popup posting back
 * could otherwise resolve an open Facebook sheet (and vice versa). There is no
 * `platform` on the OUTBOUND leg in any client — `meta/connect`,
 * `tiktok-integration/connect` and `instagram-integration/connect` are separate routes;
 * disambiguation is purely a property of the RETURN.
 */

/**
 * The `return_to` sent (with `client=web`) on every `GET …/connect` request —
 * the backend's web-return contract:
 *
 *   GET …/connect?client=web&return_to=<this URL>
 *     → …?status=connected&connection_id=…&platform=meta|tiktok|instagram&username=…
 *
 * i.e. the server's OAuth callback sends the BROWSER here instead of the
 * mobile app's `qshot://social` deep link, appending the result params ITSELF
 * — which is why this URL must be BARE (no query of our own): the callback
 * appends `?status=…&platform=…`, and a pre-existing `?` would corrupt it.
 * Note Facebook comes back as `platform=meta` — `isMetaReturn()` below accepts
 * it. The landing page (`/social-connected`) posts `{platform, status}` to the
 * builder window and closes; `returnPlatform()` reads exactly that shape.
 *
 * Origin-based on purpose: app.qshot.com in production (the URL the backend
 * allow-lists), localhost in dev. The refocus + re-list fallback stays for
 * blocked `window.close()` and for hosts predating this contract.
 */
export function connectReturnUrl(): string | null {
  if (typeof window === "undefined") return null;
  return `${window.location.origin}/social-connected`;
}

/** Reads `platform` off a posted message payload, a URL, or a URL string. */
export function returnPlatform(payload: unknown): string | null {
  if (payload instanceof URL) return payload.searchParams.get("platform");
  if (typeof payload === "string") {
    try {
      return new URL(payload, window.location.origin).searchParams.get("platform");
    } catch {
      return null;
    }
  }
  const o =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const p = o?.platform;
  return typeof p === "string" ? p : null;
}

/** Strict allow-list — mirrors `tiktok_connect_cubit.dart`. */
export function isTiktokReturn(payload: unknown): boolean {
  return returnPlatform(payload) === "tiktok";
}

/** Tolerant filter — mirrors the guard added to `meta_connect_cubit.dart`. */
export function isMetaReturn(payload: unknown): boolean {
  const p = returnPlatform(payload);
  return p == null || p === "meta" || p === "facebook";
}

/**
 * Strict allow-list — the same shape as `isTiktokReturn`, and for the same
 * reason, not by copy-paste.
 *
 * Business Login for Instagram is the NEWEST arrival of the three, so like
 * TikTok it has no pre-`platform` history to be tolerant of: its return hop is
 * specified with the parameter from day one —
 *
 *     qshot://social/connected?connection_id={id}&platform=instagram&username={name}
 *     qshot://social/error?platform=instagram&reason={code}
 *
 * (`docs/plans/social-instagram-feed/server-contract.md` §2.2) — so a payload
 * without `platform` can never be an Instagram callback, and treating one as
 * Instagram could only ever steal Meta's.
 *
 * The three filters compose without a gap, which is the point of the asymmetry:
 * `platform=instagram` is rejected by Meta's deny-list (it is neither `meta`
 * nor `facebook`) and by TikTok's allow-list, while a MISSING `platform` — the
 * legacy Meta case — is claimed by Meta alone. Note that Meta separately
 * supports Instagram-via-a-Facebook-Page (`meta/feed?platform=facebook|
 * instagram`); that is a different integration whose CONNECT leg still returns
 * `platform=meta`/`facebook`, so it does not collide either.
 */
export function isInstagramReturn(payload: unknown): boolean {
  return returnPlatform(payload) === "instagram";
}
