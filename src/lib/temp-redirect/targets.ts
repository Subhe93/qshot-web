import { canonicalTempRedirectHost, isAllowedTempRedirectDomain } from "./domains";

/**
 * Where a profile link can be pointed (mobile
 * `domain/temp_redirect_targets.dart`). Pure over the raw profile JSON — the
 * shape `q-profile/user/index` returns — so the rules are testable alone.
 */

/** One destination: display `label` (≤ 60 on the wire), the resolved absolute
 *  `url`, and `source` provenance (≤ 40, never validated by the server). */
export interface TempRedirectTarget {
  label: string;
  url: string;
  source: string;
}

export const TEMP_REDIRECT_SOURCES = {
  floatingButton: "floating_button",
  socialLink: "social_link",
  custom: "custom",
} as const;

/** The ONLY schemes the server accepts — `tel:`/`mailto:` are rejected, which
 *  is why phone and email cannot be offered. */
export const TEMP_REDIRECT_SCHEMES: ReadonlySet<string> = new Set(["http", "https"]);

export const TEMP_REDIRECT_MAX_URL_LENGTH = 2048;
export const TEMP_REDIRECT_MAX_LABEL_LENGTH = 60;
export const TEMP_REDIRECT_MAX_SOURCE_LENGTH = 40;

/** Registrable first-party domains; a redirect to one is a loop the server
 *  refuses as `first_party`. */
export const TEMP_REDIRECT_FIRST_PARTY_DOMAINS: readonly string[] = ["qshot.com", "speaknet.app"];

// ── URL parsing, Dart `Uri` flavoured ──────────────────────────────────────
// WHATWG `URL` adds a trailing "/" to a bare origin and rewrites paths, so a
// resolved URL would not dedupe or compare the way mobile's does. This keeps
// the text the user wrote, lower-casing only the scheme and host.

const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const HOST_PATTERN = /^(?:[a-z0-9\-._~!$&'()*+,;=%]+|\[[0-9a-f:.]+\])$/;

interface ParsedUrl {
  scheme: string;
  host: string;
  href: string;
}

/** Percent-encode what Dart's `Uri.parse` would, leaving existing escapes. */
function encodeLoose(text: string): string {
  let out = "";
  for (const ch of text) {
    out += /[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/.test(ch) ? ch : encodeURIComponent(ch);
  }
  return out;
}

function parseHierarchical(text: string): ParsedUrl | null {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([\s\S]*)$/.exec(text);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const authority = match[2];
  const rest = match[3];
  const at = authority.lastIndexOf("@");
  // Encoded like Dart's `Uri.parse`: a raw "\" in userinfo is a path
  // separator to browsers, which would move the real host out from under the
  // checks (`https://evil.com\@instagram.com` opens evil.com).
  const userinfo = at >= 0 ? encodeLoose(authority.slice(0, at + 1)) : "";
  let hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  let port = "";
  const portMatch = /:(\d*)$/.exec(hostPort);
  if (portMatch && !hostPort.endsWith("]")) {
    port = portMatch[0];
    hostPort = hostPort.slice(0, portMatch.index);
  }
  const host = hostPort.toLowerCase();
  if (host && !HOST_PATTERN.test(host)) return null;
  const href = `${scheme}://${userinfo}${host}${port}${encodeLoose(rest)}`;
  // The host every check ran on must be the host a browser will open.
  if (host) {
    try {
      if (new URL(href).hostname !== host) return null;
    } catch {
      return null;
    }
  }
  return { scheme, host, href };
}

/**
 * A stored or typed value → the absolute `http`/`https` URL the server accepts,
 * or `null`. A missing scheme becomes `https://`; `//host` and `/path` are
 * relative and refused rather than guessed at; the 2048 cap is measured on
 * what would be SENT.
 */
export function normaliseTempRedirectUrl(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;
  if (!SCHEME_PATTERN.test(text)) {
    if (text.startsWith("/")) return null;
    text = `https://${text}`;
  }
  if (text.length > TEMP_REDIRECT_MAX_URL_LENGTH) return null;
  const scheme = SCHEME_PATTERN.exec(text)![0].slice(0, -1).toLowerCase();
  if (!TEMP_REDIRECT_SCHEMES.has(scheme)) return null;
  const parsed = parseHierarchical(text);
  if (!parsed || !parsed.host) return null;
  return parsed.href;
}

/** The host of a URL `normaliseTempRedirectUrl` produced (or any http URL). */
export function tempRedirectUrlHost(url: string): string {
  return parseHierarchical(url)?.host ?? "";
}

/** `*.qshot.com` (api./cdn. included) and `*.speaknet.app`. */
export function isTempRedirectFirstParty(host: string): boolean {
  const value = canonicalTempRedirectHost(host);
  return TEMP_REDIRECT_FIRST_PARTY_DOMAINS.some(
    (domain) => value === domain || value.endsWith(`.${domain}`),
  );
}

/**
 * `normaliseTempRedirectUrl` plus the loop checks — a first-party host or the
 * profile's own host (`profileHost`) would point the profile at itself.
 * `requireKnownDomain` adds the platform allowlist LAST; the sheet applies it
 * as a separate step instead, so it can say which rule was broken.
 */
export function resolveTempRedirectUrl(
  raw: string,
  options: { profileHost?: string | null; requireKnownDomain?: boolean } = {},
): string | null {
  const url = normaliseTempRedirectUrl(raw);
  if (url == null) return null;
  const host = canonicalTempRedirectHost(tempRedirectUrlHost(url));
  if (isTempRedirectFirstParty(host)) return null;
  if (options.profileHost != null && host === canonicalTempRedirectHost(options.profileHost)) {
    return null;
  }
  if (options.requireKnownDomain && !isAllowedTempRedirectDomain(host)) return null;
  return url;
}

// ── The profile model, as the list endpoint returns it ─────────────────────

type Json = Record<string, unknown>;

/** The fields the builders read — the raw `q-profile/user/index` row. */
export interface TempRedirectProfileSource {
  _id?: string;
  id?: string;
  name?: string;
  user_name?: string;
  externalDomains?: unknown;
  settings?: unknown;
  info?: unknown;
}

function asMap(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * The host the profile is served on (mobile `WebsiteUtils.extractDomain`): the
 * first custom domain when there is one, else `<name>.<siteDomain>`.
 */
export function tempRedirectProfileHost(
  profile: TempRedirectProfileSource,
  siteDomain: string,
): string {
  const domains = Array.isArray(profile.externalDomains) ? profile.externalDomains : [];
  const first = asText(domains[0]);
  if (first) return first.toLowerCase();
  const name = profile.user_name || profile.name || "";
  return `${name}.${siteDomain}`.toLowerCase();
}

/** Mobile `LinkConfiguration.text` — brand names, not translatable copy. */
const LINK_CONFIGURATION_TEXT: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  whatsapp: "WhatsApp",
  twitter: "Twitter",
  youtube: "Youtube",
  pinterest: "Pinterest",
  twitch: "Twitch",
  vimeo: "Vimeo",
  behance: "Behance",
  wechat: "WeChat",
  phone: "Phone",
  email: "Email",
  link: "Link",
  website: "Website",
  location: "Location",
  custom: "Custom Link",
};

/** Floating-button variants that point back into the profile (`self`). */
const EXCLUDED_VARIANTS = new Set(["form", "buyNow"]);

const VARIANT_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  messenger: "Messenger",
  phone: "Phone",
  email: "Email",
};

/**
 * The launch URL of one floating-button variant (mobile
 * `FloatingButtonVariant.targetUri`). WhatsApp keeps DIGITS ONLY — stripping
 * just "+" would percent-encode a formatted number into a dead link.
 */
function floatingTargetUrl(
  variant: string,
  value: string,
  message: string | null,
  subject: string | null,
): string | null {
  switch (variant) {
    case "email":
      return `mailto:${value}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
    case "phone":
      return `tel:${value}`;
    case "whatsapp": {
      const number = value.replace(/\D/g, "");
      return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
    }
    case "telegram": {
      let base = value;
      if (value.startsWith("@")) base = `https://t.me/${value.slice(1)}`;
      else if (value.startsWith("+")) base = `https://t.me/${value}`;
      if (message) base += `?text=${encodeURIComponent(message)}`;
      return base;
    }
    case "messenger": {
      let pageId = value;
      if (value.includes("m.me/")) pageId = value.split("m.me/").pop()!.split("?")[0];
      else if (value.includes("facebook.com/")) {
        pageId = value.split("facebook.com/").pop()!.split("?")[0];
      }
      return `https://m.me/${pageId}${message ? `?ref=${encodeURIComponent(message)}` : ""}`;
    }
    case "customLink":
    case "form":
    case "buyNow":
      return value;
    default:
      return null;
  }
}

/** `values[type]` — nested `{value, message, subject}`, or a legacy flat string. */
function floatingField(values: Json | null, variant: string, key: string): string | null {
  const entry = values?.[variant];
  if (typeof entry === "string") return key === "value" ? entry : null;
  return asText(asMap(entry)?.[key]);
}

/**
 * Stored WhatsApp values are often not URLs: `wa.me/46700` and a bare
 * `+46 70 000 00 00` are both valid stored data. A value that already names a
 * host is left to the normaliser; a bare number becomes `https://wa.me/<digits>`.
 */
function whatsappUrl(value: string): string | null {
  const lower = value.toLowerCase();
  if (
    lower.includes("wa.me") ||
    lower.includes("whatsapp.com") ||
    lower.startsWith("http://") ||
    lower.startsWith("https://")
  ) {
    return value;
  }
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

/**
 * Every destination this profile carries, ready to send: the live floating
 * button first (the owner's chosen primary), then the home page's social links
 * in authored order, deduplicated by resolved URL.
 *
 * ONLY this profile's — product decision 2026-09-2x: one profile only (mobile
 * 05d3428c). A redirect belongs to one profile, and a list mixing several
 * made it unclear which site a chosen destination came from. The loop guard
 * is pinned to the profile itself.
 */
export function buildTempRedirectTargets(
  profile: TempRedirectProfileSource,
  options: { siteDomain: string },
): TempRedirectTarget[] {
  const profileHost = tempRedirectProfileHost(profile, options.siteDomain);
  const targets: TempRedirectTarget[] = [];
  const seen = new Set<string>();

  const add = (label: string, raw: string | null, source: string) => {
    if (raw == null) return;
    const url = resolveTempRedirectUrl(raw, { profileHost });
    if (url == null || seen.has(url)) return;
    seen.add(url);
    const title = label.trim();
    targets.push({ label: title || tempRedirectUrlHost(url) || url, url, source });
  };

  // ── Floating button ── ONLY the live `type`: `values` keeps every variant
  // the user ever typed, and resurfacing a removed one would be a surprise.
  const settings = asMap(profile.settings);
  const button = asMap(settings?.floating_button);
  const variant = asText(button?.type);
  if (button && button.hide !== true && variant && !EXCLUDED_VARIANTS.has(variant)) {
    const values = asMap(button.values);
    const value = floatingField(values, variant, "value")?.trim();
    if (value) {
      // phone / email become tel: / mailto: and fall out on the scheme check.
      add(
        VARIANT_LABEL[variant] ?? "",
        floatingTargetUrl(
          variant,
          value,
          floatingField(values, variant, "message"),
          floatingField(values, variant, "subject"),
        ),
        TEMP_REDIRECT_SOURCES.floatingButton,
      );
    }
  }

  // ── Social links on the home page (`info.modules`; sub-pages out of scope) ──
  const info = asMap(profile.info);
  const modules = Array.isArray(info?.modules) ? info.modules : [];
  for (const rawBlock of modules) {
    const block = asMap(rawBlock);
    if (!block || block.type !== "social_links" || block.hide === true) continue;
    const links = Array.isArray(block.links) ? block.links : [];
    for (const rawItem of links) {
      const item = asMap(rawItem);
      if (!item || item.hidden === true) continue;
      const type = asText(item.type) ?? "link";
      // Bare numbers and addresses can only become tel: / mailto:.
      if (type === "phone" || type === "email") continue;
      // The value lives under `link` — never `url` / `value`.
      const value = (asText(item.link) ?? "").trim();
      if (!value) continue;
      const name = asText(item.name)?.trim();
      add(
        name || LINK_CONFIGURATION_TEXT[type] || LINK_CONFIGURATION_TEXT.link,
        type === "whatsapp" ? whatsappUrl(value) : value,
        TEMP_REDIRECT_SOURCES.socialLink,
      );
    }
  }

  return targets;
}

/** What the custom field resolved to, or which rule it broke. */
export type CustomTargetResolution =
  | { ok: true; target: TempRedirectTarget }
  | { ok: false; error: "badUrl" | "badDomain" };

/**
 * The custom link, checked in TWO steps so the message is specific: the
 * contract's rules (scheme, absolute, length, first-party, self) → `badUrl`;
 * only then the platform allowlist → `badDomain`.
 */
export function resolveCustomTempRedirectTarget(
  raw: string,
  profileHost: string,
): CustomTargetResolution {
  const url = resolveTempRedirectUrl(raw, { profileHost });
  if (url == null) return { ok: false, error: "badUrl" };
  const host = canonicalTempRedirectHost(tempRedirectUrlHost(url));
  if (!isAllowedTempRedirectDomain(host)) return { ok: false, error: "badDomain" };
  return {
    ok: true,
    target: { label: host || url, url, source: TEMP_REDIRECT_SOURCES.custom },
  };
}

/** Trim to the server's limits so no call site can 422 on length. */
export function clipTempRedirectText(value: string | null | undefined, max: number): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.length <= max ? text : text.slice(0, max);
}
