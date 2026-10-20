import {
  readDate,
  readIntOrNull,
  readString,
  readStringOrNull,
} from "@/lib/temp-redirect/model";

/**
 * Platform redirect cards (contract `docs/new section/integration-guide.md`
 * §3, §7.2). An ACCOUNT feature: nothing here knows a profile.
 *
 * Every field is read tolerantly — an unknown or mistyped key must never throw,
 * or a whole platform section would vanish off screen.
 */

export type PlatformStatus = "active" | "paused";
export type CodeStatus = "assigned" | "disabled";

export interface PlatformLink {
  platform: string;
  url: string;
  host: string;
  updatedAt: Date | null;
}

export interface PlatformCode {
  platform: string;
  /** Five digits, `10000`–`99999`. */
  code: string;
  /** The printed URL — `https://qshot.com/{path}/{code}`. Copy/share this. */
  url: string;
  /** Private name, ≤ 60. Never shown to visitors. */
  label: string | null;
  status: CodeStatus;
  assignedAt: Date | null;
  /** Human scans only. Shown as "scans". */
  hits: number;
  lastHitAt: Date | null;
}

export interface PlatformEntry {
  /** API identifier — `google_reviews`. Pick the icon from this. */
  platform: string;
  /** Printed URL segment — `google-reviews`. */
  path: string;
  /** Section title. Admin-editable: never hard-code. */
  label: string;
  purpose: string;
  status: PlatformStatus;
  order: number;
  urlHint: string;
  examples: string[];
  allowedHosts: string[];
  link: PlatformLink | null;
  codes: PlatformCode[];
}

export interface PlatformQuota {
  /** `null` = no limit: hide the counter. */
  limit: number | null;
  used: number;
}

export interface PlatformRedirectOverview {
  /** Already sorted by `order`; hidden platforms are never sent. */
  platforms: PlatformEntry[];
  quota: PlatformQuota;
}

/** One row of the public registry (`GET /platform-redirect/platforms`). */
export interface PlatformRegistryEntry {
  platform: string;
  path: string;
  label: string;
  status: PlatformStatus | null;
  enabled: boolean;
  urlHint: string;
  examples: string[];
  allowedHosts: string[];
}

export interface ClaimResult {
  code: PlatformCode;
  /** `false` → "Card linked. Add your {label} link so the card starts working." */
  linkConfigured: boolean;
}

type Json = Record<string, unknown>;

function isMap(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => readStringOrNull(v)).filter((v): v is string => v != null);
}

function readInt(value: unknown, fallback = 0): number {
  return readIntOrNull(value) ?? fallback;
}

function readBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/** `paused` is the one read-only status; anything unknown is treated as it —
 *  the conservative reading never offers a write the server would refuse. */
function readPlatformStatus(value: unknown): PlatformStatus {
  return value === "active" ? "active" : "paused";
}

function readCodeStatus(value: unknown): CodeStatus {
  return value === "disabled" ? "disabled" : "assigned";
}

export function parsePlatformLink(json: unknown): PlatformLink | null {
  if (!isMap(json)) return null;
  const url = readStringOrNull(json.url);
  if (url == null) return null;
  let host = readStringOrNull(json.host);
  if (host == null) {
    try {
      host = new URL(url).hostname;
    } catch {
      host = "";
    }
  }
  return {
    platform: readString(json.platform),
    url,
    host,
    updatedAt: readDate(json.updatedAt),
  };
}

export function parsePlatformCode(json: Json): PlatformCode {
  return {
    platform: readString(json.platform),
    code: readString(json.code),
    url: readString(json.url),
    label: readStringOrNull(json.label),
    status: readCodeStatus(json.status),
    assignedAt: readDate(json.assignedAt),
    hits: readInt(json.hits),
    lastHitAt: readDate(json.lastHitAt),
  };
}

export function parsePlatformEntry(json: Json): PlatformEntry {
  const codes = Array.isArray(json.codes)
    ? json.codes.filter(isMap).map(parsePlatformCode).filter((c) => c.code !== "")
    : [];
  const platform = readString(json.platform);
  return {
    platform,
    path: readString(json.path, platform.replace(/_/g, "-")),
    label: readString(json.label, platform),
    purpose: readString(json.purpose),
    status: readPlatformStatus(json.status),
    order: readInt(json.order),
    urlHint: readString(json.urlHint),
    examples: readStringList(json.examples),
    allowedHosts: readStringList(json.allowedHosts),
    link: parsePlatformLink(json.link),
    codes,
  };
}

function dataOf(body: unknown): Json {
  if (!isMap(body)) return {};
  return isMap(body.data) ? body.data : body;
}

/** `{ success, data: { platforms, quota } }` → overview. Platforms with no
 *  identifier are dropped; the sort honours `order` even if the server's
 *  ordering ever slips. */
export function readOverviewEnvelope(body: unknown): PlatformRedirectOverview {
  const data = dataOf(body);
  const platforms = Array.isArray(data.platforms)
    ? data.platforms
        .filter(isMap)
        .map(parsePlatformEntry)
        .filter((p) => p.platform !== "")
        .sort((a, b) => a.order - b.order)
    : [];
  const quota = isMap(data.quota) ? data.quota : {};
  return {
    platforms,
    quota: {
      limit: readIntOrNull(quota.limit),
      used: readInt(quota.used),
    },
  };
}

export function readRegistryEnvelope(body: unknown): PlatformRegistryEntry[] {
  const data = dataOf(body);
  if (!Array.isArray(data.platforms)) return [];
  return data.platforms.filter(isMap).map((json): PlatformRegistryEntry => {
    const platform = readString(json.platform);
    const status = readStringOrNull(json.status);
    return {
      platform,
      path: readString(json.path, platform.replace(/_/g, "-")),
      label: readString(json.label, platform),
      status: status === "active" || status === "paused" ? status : null,
      enabled: readBool(json.enabled, status === "active"),
      urlHint: readString(json.urlHint),
      examples: readStringList(json.examples),
      allowedHosts: readStringList(json.allowedHosts),
    };
  }).filter((p) => p.platform !== "");
}

/** `{ data: { link } }` → link, `null` when the body says nothing usable. */
export function readLinkEnvelope(body: unknown): PlatformLink | null {
  const data = dataOf(body);
  return parsePlatformLink("link" in data ? data.link : data);
}

/** `{ data: { code } }` → code, `null` when unreadable. */
export function readCodeEnvelope(body: unknown): PlatformCode | null {
  const data = dataOf(body);
  const raw = isMap(data.code) ? data.code : data.code === undefined && data.platform != null ? data : null;
  if (!raw) return null;
  const code = parsePlatformCode(raw);
  return code.code === "" ? null : code;
}

/** `{ data: { code, linkConfigured } }` → claim result, `null` when unreadable. */
export function readClaimEnvelope(body: unknown): ClaimResult | null {
  const code = readCodeEnvelope(body);
  if (!code) return null;
  const data = dataOf(body);
  return { code, linkConfigured: readBool(data.linkConfigured, true) };
}

/** `{ data: { removed } }` → removed flag (absent = assume removed). */
export function readRemovedEnvelope(body: unknown): boolean {
  return readBool(dataOf(body).removed, true);
}

// ── Code helpers ─────────────────────────────────────────────────────────────

/** Contract: `^[1-9]\d{4}$` — five digits, never a leading zero. */
export const PLATFORM_CODE_REGEX = /^[1-9]\d{4}$/;
export const PLATFORM_CODE_LENGTH = 5;
export const PLATFORM_LABEL_MAX_LENGTH = 60;
export const PLATFORM_URL_MAX_LENGTH = 2048;

/** Arabic-Indic and Persian digits map to ASCII; everything else is dropped. */
export function normalizeDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x30 && cp <= 0x39) out += ch;
    else if (cp >= 0x0660 && cp <= 0x0669) out += String.fromCharCode(0x30 + cp - 0x0660);
    else if (cp >= 0x06f0 && cp <= 0x06f9) out += String.fromCharCode(0x30 + cp - 0x06f0);
  }
  return out;
}

export function isValidPlatformCode(code: string): boolean {
  return PLATFORM_CODE_REGEX.test(code);
}

/** Lower-cased, trailing DNS dot dropped, `www.` kept (the server lists it). */
export function canonicalHost(host: string): string {
  let value = host.trim().toLowerCase();
  while (value.endsWith(".")) value = value.slice(0, -1);
  return value;
}

/**
 * The OPTIONAL early warning of §7.3: true when the typed URL's host is one of
 * `allowedHosts` or a subdomain of one. Never used to block — the server is the
 * only judge, and it accepts shapes this list cannot describe.
 */
export function hostLooksAllowed(url: string, allowedHosts: string[]): boolean | null {
  let host: string;
  try {
    host = canonicalHost(new URL(url.trim()).hostname);
  } catch {
    return null; // not parseable yet — say nothing
  }
  if (!host) return null;
  if (allowedHosts.length === 0) return true;
  return allowedHosts.some((allowed) => {
    const a = canonicalHost(allowed);
    return host === a || host.endsWith(`.${a}`);
  });
}

export interface CardUrlPlatform {
  platform: string;
  path: string;
  label: string;
}

export type ParsedCardInput =
  | { kind: "digits"; code: string }
  | { kind: "card"; code: string; platform: CardUrlPlatform }
  | { kind: "other-platform"; code: string; platform: CardUrlPlatform }
  | { kind: "unknown-path"; path: string }
  | { kind: "foreign-host"; host: string }
  | { kind: "invalid" };

/**
 * What the user pasted into the code boxes (§7.4 steps 1–4): bare digits, or a
 * full card URL `https://{siteDomain}/{path}/{code}` whose `{path}` must match
 * a platform the caller already loaded. `expected` is the platform whose
 * sheet is open; a card of another platform is reported, never silently
 * re-targeted.
 */
export function parseCardInput(
  raw: string,
  options: {
    /** The QShot main domain(s) a card URL may live on: the configured site
     *  domain plus the hosts of card URLs the server itself returned. */
    siteDomains: string[];
    platforms: CardUrlPlatform[];
    expected: CardUrlPlatform;
  },
): ParsedCardInput {
  const text = raw.trim();
  if (!text) return { kind: "invalid" };

  const digitsOnly = normalizeDigits(text);
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^[\w.-]+\.[a-z]{2,}\//i.test(text);
  if (!looksLikeUrl && digitsOnly.length === PLATFORM_CODE_LENGTH && digitsOnly.length === text.replace(/[\s-]/g, "").length) {
    return { kind: "digits", code: digitsOnly };
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { kind: "invalid" };
  }
  const host = canonicalHost(url.hostname);
  // Step 1: the QShot main domain (or `www.`), never a profile subdomain.
  const isMain = options.siteDomains.some((d) => {
    const domain = canonicalHost(d);
    return domain !== "" && (host === domain || host === `www.${domain}`);
  });
  if (!isMain) return { kind: "foreign-host", host };

  // Step 2: `{path}/{code}` with an optional trailing slash.
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return { kind: "invalid" };
  const [path, rawCode] = segments;
  let decodedCode = rawCode;
  try {
    decodedCode = decodeURIComponent(rawCode);
  } catch {
    return { kind: "invalid" }; // malformed %-escape — never throw out of a paste handler
  }
  const code = normalizeDigits(decodedCode);
  if (!isValidPlatformCode(code)) return { kind: "invalid" };

  // Step 3: the platform whose `path` equals `{path}`.
  const platform = options.platforms.find((p) => p.path === path.toLowerCase());
  if (!platform) return { kind: "unknown-path", path };
  if (platform.platform !== options.expected.platform) return { kind: "other-platform", code, platform };
  return { kind: "card", code, platform };
}

/** The main domains card URLs live on: the configured site domain plus every
 *  host the server used in the loaded cards' `url` (the API builds those on
 *  the real main domain, whatever this deployment's display domain is). */
export function cardDomainsOf(platforms: PlatformEntry[], siteDomain: string): string[] {
  const set = new Set<string>([canonicalHost(siteDomain)]);
  for (const p of platforms) {
    for (const c of p.codes) {
      try {
        const h = canonicalHost(new URL(c.url).hostname).replace(/^www\./, "");
        if (h) set.add(h);
      } catch {
        /* a malformed url is not a domain */
      }
    }
  }
  return [...set].filter(Boolean);
}

/** Which brand mark to draw for a platform code (`google_reviews` → google). */
export function platformIconFile(platform: string): string {
  switch (platform) {
    case "google_reviews":
      return "google.svg";
    case "instagram":
    case "tiktok":
    case "whatsapp":
    case "facebook":
    case "snapchat":
      return `${platform}.svg`;
    default:
      return "link.svg";
  }
}
