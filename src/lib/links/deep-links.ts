/**
 * Per-platform DEEP-LINK builder for Smart (Custom) Links.
 *
 * Given a social platform `type` and a `sourceUrl`, produce the native-app
 * deep links Suwut serves so a smart link opens the installed app on the
 * visitor's device, or continues in the browser (`Fallback`) when the app is
 * absent. The output shape maps 1:1 to the create/update body fields
 * (`iOS`, `iPad`, `Android`, `Fallback`) documented in CUSTOM-LINKS-API.md.
 *
 * Three link flavours are produced per platform:
 *   - iOS/iPad  : a custom URI *scheme* (e.g. `youtube://…`) when the app
 *                 registers a reliable one, OTHERWISE the plain https
 *                 *universal link* (iOS opens the app if it claims the domain).
 *   - Android   : an `intent://<host+path>#Intent;package=<pkg>;scheme=https;end`
 *                 string — opens the app by package, or falls through to the
 *                 https URL via `scheme=https` when the app is missing.
 *   - Fallback  : the normalized https URL (always a valid browser link).
 *
 * Scheme / package sources (verified 2026-07, current apps):
 *   - youtube   `youtube://watch?v=ID`            pkg com.google.android.youtube
 *   - spotify   `spotify:<kind>:<id>` (URI)       pkg com.spotify.music
 *               (developer.spotify.com content-linking: `spotify:` URI scheme)
 *   - vimeo     `vimeo://videos/<id>`             pkg com.vimeo.android.videoapp
 *   - tiktok    https universal link on iOS       pkg com.zhiliaoapp.musically
 *               (TikTok exposes no stable public iOS scheme for arbitrary
 *                video/profile URLs — its universal links are the reliable
 *                app-open path; Android intent by package is reliable.)
 *   - instagram `instagram://user?username=<u>`   pkg com.instagram.android
 *               (dev.to/ahandsel/instagram-url-schemes; profiles only. Posts
 *                — /p, /reel, /tv — carry a shortcode, NOT the numeric media id
 *                the `instagram://media?id=` scheme wants, so posts use the
 *                https universal link on iOS.)
 *   - facebook  `fb://facewebmodal/f?href=<enc>`  pkg com.facebook.katana
 *               (github.com/lucaslarroche/facebook-deep-linking — the modal
 *                href form opens most Facebook web URLs in-app.)
 *   - twitter/x `twitter://user?screen_name=<u>`  pkg com.twitter.android
 *               `twitter://status?id=<id>`
 *               (The X app still registers the legacy `twitter://` scheme and
 *                the com.twitter.android package.)
 *
 * Parsing is defensive: any URL we cannot understand degrades to an
 * all-fields-equal https link so a producible link is ALWAYS returned.
 */

export interface DeepLinks {
  iOS: string;
  iPad: string;
  Android: string;
  Fallback: string;
  type: string;
  source_url: string;
}

/** Supported platform hints (matches the API's `type` enum). */
export const LINK_TYPES: { type: string; label: string }[] = [
  { type: "youtube", label: "YouTube" },
  { type: "spotify", label: "Spotify" },
  { type: "tiktok", label: "TikTok" },
  { type: "vimeo", label: "Vimeo" },
  { type: "instagram", label: "Instagram" },
  { type: "facebook", label: "Facebook" },
  { type: "twitter", label: "Twitter / X" },
  { type: "custom", label: "Custom" },
];

const KNOWN_TYPES = new Set(LINK_TYPES.map((t) => t.type));

/** Android app package ids per platform (see block comment for sources). */
const PKG = {
  youtube: "com.google.android.youtube",
  spotify: "com.spotify.music",
  vimeo: "com.vimeo.android.videoapp",
  tiktok: "com.zhiliaoapp.musically",
  instagram: "com.instagram.android",
  facebook: "com.facebook.katana",
  twitter: "com.twitter.android",
} as const;

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Coerce loose user input into a canonical https URL string.
 * - trims, prepends `https://` when no scheme is present
 * - leaves an already-explicit non-http scheme (e.g. `spotify:`) untouched
 * - returns null when it cannot be parsed into something with a host
 */
export function normalizeUrl(url: string): string | null {
  if (!url) return null;
  let s = url.trim();
  if (!s) return null;

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    // no scheme at all → assume https
    s = "https://" + s;
  }
  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    let out = u.toString();
    // Dart's Uri keeps an empty path empty; WHATWG URL forces "/". Match Dart
    // (mobile is the serialization source of truth): strip the injected slash
    // when the input had no "/" right after the authority.
    if (u.pathname === "/") {
      const rest = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
      const cut = rest.search(/[/?#]/);
      const authorityEnd = cut === -1 ? rest.length : cut;
      if (rest[authorityEnd] !== "/") {
        out = out.replace(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)\//i, "$1");
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** Bare host without a leading `www.` (lower-cased). */
function bareHost(u: URL): string {
  return u.hostname.replace(/^www\./i, "").toLowerCase();
}

/** Path segments with empty parts removed. */
function segments(u: URL): string[] {
  return u.pathname.split("/").filter(Boolean);
}

/**
 * Build an Android `intent://` string.
 * @param hostPath host + path (+ query), e.g. `www.youtube.com/watch?v=abc`
 * @param pkg      Android package id
 */
function androidIntent(hostPath: string, pkg: string): string {
  return `intent://${hostPath}#Intent;package=${pkg};scheme=https;end`;
}

/**
 * `?`-prefixed query, matching Dart's `u.hasQuery` semantics: a bare trailing
 * `?` (empty query) still yields `"?"`, which WHATWG `u.search` reports as `""`.
 */
function searchOf(u: URL): string {
  if (u.search !== "") return u.search;
  return /\?(?=#|$)/.test(u.href) ? "?" : "";
}

/** host + path + query, as an app-agnostic intent target (no port — Dart's `Uri.host` never carries one). */
function hostPathQuery(u: URL): string {
  return `${u.hostname}${u.pathname}${searchOf(u)}`;
}

/**
 * Detect the platform from a URL's host. Returns `custom` for anything
 * unrecognized or unparseable.
 */
export function detectPlatform(url: string): string {
  const norm = normalizeUrl(url);
  if (!norm) return "custom";
  let u: URL;
  try {
    u = new URL(norm);
  } catch {
    return "custom";
  }
  const host = bareHost(u);

  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com")
    return "youtube";
  if (host === "spotify.com" || host === "open.spotify.com") return "spotify";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "vimeo.com" || host === "player.vimeo.com") return "vimeo";
  if (host === "instagram.com" || host.endsWith(".instagram.com"))
    return "instagram";
  if (host === "facebook.com" || host === "fb.com" || host === "fb.watch")
    return "facebook";
  if (host === "twitter.com" || host === "x.com" || host === "mobile.twitter.com")
    return "twitter";

  return "custom";
}

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

/**
 * All four links equal to `url`. Used for the `custom` type and as the safe
 * degrade path when a platform URL can't be parsed to an app target. Keeps the
 * platform `type` so Suwut can still fetch cover metadata.
 */
function allEqual(url: string, type: string): DeepLinks {
  return { iOS: url, iPad: url, Android: url, Fallback: url, type, source_url: url };
}

// --- youtube ---------------------------------------------------------------
function youtube(u: URL, source: string): DeepLinks {
  const host = bareHost(u);
  let id = "";

  if (host === "youtu.be") {
    id = segments(u)[0] ?? "";
  } else {
    // Dart's `queryParameters` is last-write-wins for duplicate `?v=` params.
    const vs = u.searchParams.getAll("v");
    const v = vs.length ? vs[vs.length - 1] : "";
    if (v) {
      id = v;
    } else {
      // /shorts/ID, /embed/ID, /v/ID (case-sensitive, like mobile)
      const m = u.pathname.match(/\/(?:shorts|embed|v)\/([^/?#]+)/);
      if (m) id = m[1];
    }
  }

  if (id) {
    const ios = `youtube://watch?v=${id}`;
    return {
      iOS: ios,
      iPad: ios,
      Android: androidIntent(`www.youtube.com/watch?v=${id}`, PKG.youtube),
      Fallback: `https://www.youtube.com/watch?v=${id}`,
      type: "youtube",
      source_url: source,
    };
  }

  // channel / playlist / user pages have no single video id → https-only.
  return { ...allEqual(source, "youtube") };
}

// --- spotify ---------------------------------------------------------------
function spotify(u: URL, source: string): DeepLinks {
  // Match anywhere so locale prefixes (`/intl-de/track/ID`) still resolve.
  // Case-sensitive, id = any non-`/?#` run, kind verbatim — like mobile.
  const m = u.pathname.match(
    /\/(track|album|playlist|artist|show|episode)\/([^/?#]+)/
  );
  if (m) {
    const kind = m[1];
    const id = m[2];
    return {
      iOS: `spotify:${kind}:${id}`,
      iPad: `spotify:${kind}:${id}`,
      Android: androidIntent(`open.spotify.com/${kind}/${id}`, PKG.spotify),
      Fallback: `https://open.spotify.com/${kind}/${id}`,
      type: "spotify",
      source_url: source,
    };
  }
  return { ...allEqual(source, "spotify") };
}

// --- vimeo -----------------------------------------------------------------
function vimeo(u: URL, source: string): DeepLinks {
  // Last numeric path segment is the video id (handles /channels/x/ID etc.).
  const id = segments(u)
    .reverse()
    .find((s) => /^\d+$/.test(s));
  if (id) {
    const ios = `vimeo://videos/${id}`;
    return {
      iOS: ios,
      iPad: ios,
      Android: androidIntent(`vimeo.com/${id}`, PKG.vimeo),
      Fallback: `https://vimeo.com/${id}`,
      type: "vimeo",
      source_url: source,
    };
  }
  return { ...allEqual(source, "vimeo") };
}

// --- tiktok ----------------------------------------------------------------
function tiktok(u: URL, source: string): DeepLinks {
  // No reliable public iOS scheme for arbitrary URLs → use the https universal
  // link for iOS/iPad (opens the app when installed). Android via package.
  return {
    iOS: source,
    iPad: source,
    Android: androidIntent(hostPathQuery(u), PKG.tiktok),
    Fallback: source,
    type: "tiktok",
    source_url: source,
  };
}

// --- instagram -------------------------------------------------------------
// First path segments that are NOT usernames.
const IG_RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "explore",
  "stories",
  "accounts",
  "direct",
  "about",
  "developer",
]);

function instagram(u: URL, source: string): DeepLinks {
  const segs = segments(u);
  const first = segs[0]?.toLowerCase();

  let ios = source; // default: universal link (posts, and anything unusual)
  if (segs.length === 1 && first && !IG_RESERVED.has(first)) {
    // Profile URL: instagram.com/<username>
    ios = `instagram://user?username=${segs[0]}`;
  }
  // Posts (/p, /reel, /tv) carry a shortcode, not the numeric media id the
  // `instagram://media?id=` scheme needs, so they keep the https universal link.

  return {
    iOS: ios,
    iPad: ios,
    Android: androidIntent(hostPathQuery(u), PKG.instagram),
    Fallback: source,
    type: "instagram",
    source_url: source,
  };
}

// --- facebook --------------------------------------------------------------
function facebook(u: URL, source: string): DeepLinks {
  // The facewebmodal form opens most Facebook web URLs inside the app.
  const ios = `fb://facewebmodal/f?href=${encodeURIComponent(source)}`;
  return {
    iOS: ios,
    iPad: ios,
    Android: androidIntent(hostPathQuery(u), PKG.facebook),
    Fallback: source,
    type: "facebook",
    source_url: source,
  };
}

// --- twitter / x -----------------------------------------------------------
// First path segments that are NOT usernames.
const TW_RESERVED = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "search",
  "settings",
  "i",
  "hashtag",
  "compose",
  "intent",
]);

function twitter(u: URL, source: string): DeepLinks {
  const segs = segments(u);

  // Normalize the browser Fallback host to `x.com`: twitter.com now 301s to
  // x.com, so x.com is the canonical live domain. The app scheme (`twitter://`)
  // and package (com.twitter.android) are unchanged by the rebrand.
  const path = u.pathname + searchOf(u);
  const fallback = `https://x.com${path}`;

  let ios = fallback; // default: universal link
  // Substring match on the raw path, case-sensitive, digit-prefix — like mobile.
  const m = u.pathname.match(/status\/(\d+)/);
  if (m) {
    // Tweet permalink: /<user>/status/<id> or /status/<id>
    ios = `twitter://status?id=${m[1]}`;
  } else if (segs.length >= 1 && !TW_RESERVED.has(segs[0].toLowerCase())) {
    // Profile: /<username>
    ios = `twitter://user?screen_name=${segs[0]}`;
  }

  return {
    iOS: ios,
    iPad: ios,
    Android: androidIntent(`x.com${path}`, PKG.twitter),
    Fallback: fallback,
    type: "twitter",
    source_url: source,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Build the per-platform deep links for a smart link.
 *
 * @param type      platform hint (one of {@link LINK_TYPES}); when empty or
 *                  unknown the platform is inferred from the URL host.
 * @param sourceUrl the pasted source URL (any of the many shapes per platform).
 * @returns the four device links plus the resolved `type` and `source_url`.
 *          NEVER throws — malformed input degrades to an all-equal https link.
 */
export function buildDeepLinks(type: string, sourceUrl: string): DeepLinks {
  const norm = normalizeUrl(sourceUrl);

  // Unparseable → produce a custom, all-equal link from the raw input so a
  // link is always producible.
  if (!norm) {
    const raw = (sourceUrl ?? "").trim();
    return allEqual(raw, "custom");
  }

  let u: URL;
  try {
    u = new URL(norm);
  } catch {
    return allEqual(norm, "custom");
  }

  const requested = (type ?? "").toLowerCase();
  // Trust an explicit, known hint; otherwise infer from the host.
  const platform =
    requested && KNOWN_TYPES.has(requested) ? requested : detectPlatform(norm);

  switch (platform) {
    case "youtube":
      return youtube(u, norm);
    case "spotify":
      return spotify(u, norm);
    case "vimeo":
      return vimeo(u, norm);
    case "tiktok":
      return tiktok(u, norm);
    case "instagram":
      return instagram(u, norm);
    case "facebook":
      return facebook(u, norm);
    case "twitter":
      return twitter(u, norm);
    case "custom":
    default:
      return allEqual(norm, "custom");
  }
}
