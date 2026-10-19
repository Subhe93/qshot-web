/**
 * The closed music-platform registry — docs/api-contract.en.md §5.
 *
 * Display order is fixed by the server; names SHOULD come from the API
 * (`GET music-links/platforms`, or `name_ar` / `name_en` on each resolve row)
 * and this table is only the local fallback for when they are not loaded (the
 * canvas preview, which must never call `music-links/*`, §10.2).
 *
 * The registry is CLOSED: every one of the 16 ids is known here, including the
 * disabled `tiktok`, because a saved block may reference any of them. An id
 * outside this table (a newer server) is preserved in the data but never drawn.
 */

export interface MusicPlatformInfo {
  id: string;
  order: number;
  name_ar: string;
  name_en: string;
}

export const MUSIC_PLATFORMS: readonly MusicPlatformInfo[] = [
  { id: "anghami", order: 1, name_ar: "أنغامي", name_en: "Anghami" },
  { id: "spotify", order: 2, name_ar: "سبوتيفاي", name_en: "Spotify" },
  { id: "youtube", order: 3, name_ar: "يوتيوب", name_en: "YouTube" },
  { id: "appleMusic", order: 4, name_ar: "أبل ميوزك", name_en: "Apple Music" },
  { id: "youtubeMusic", order: 5, name_ar: "يوتيوب ميوزك", name_en: "YouTube Music" },
  { id: "deezer", order: 6, name_ar: "ديزر", name_en: "Deezer" },
  { id: "soundcloud", order: 7, name_ar: "ساوند كلاود", name_en: "SoundCloud" },
  { id: "tidal", order: 8, name_ar: "تايدل", name_en: "TIDAL" },
  { id: "amazonMusic", order: 9, name_ar: "أمازون ميوزك", name_en: "Amazon Music" },
  { id: "boomplay", order: 10, name_ar: "بوم بلاي", name_en: "Boomplay" },
  { id: "audiomack", order: 11, name_ar: "أوديوماك", name_en: "Audiomack" },
  { id: "shazam", order: 12, name_ar: "شازام", name_en: "Shazam" },
  { id: "pandora", order: 13, name_ar: "باندورا", name_en: "Pandora" },
  { id: "qobuz", order: 14, name_ar: "كوبوز", name_en: "Qobuz" },
  { id: "iHeartRadio", order: 15, name_ar: "آي هارت راديو", name_en: "iHeartRadio" },
  { id: "tiktok", order: 16, name_ar: "تيك توك", name_en: "TikTok" },
];

const BY_ID = new Map(MUSIC_PLATFORMS.map((p) => [p.id, p]));

/** True for one of the 16 registry ids (case-sensitive, as on the wire). */
export function isKnownMusicPlatform(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** Default "Show more" split when the server did not say (§6.1). */
export const DEFAULT_VISIBLE_COUNT = 6;

/** Arabic name for an Arabic UI, English for every other locale. */
export function pickPlatformName(
  names: { name_ar?: string | null; name_en?: string | null } | undefined,
  locale: string,
): string | null {
  if (!names) return null;
  const ar = names.name_ar?.trim();
  const en = names.name_en?.trim();
  return (locale === "ar" ? ar || en : en || ar) || null;
}

/**
 * Display name of a platform: the API's names when given, else the local table,
 * else the raw id (never empty).
 */
export function musicPlatformName(
  id: string,
  locale: string,
  fromApi?: { name_ar?: string | null; name_en?: string | null },
): string {
  return pickPlatformName(fromApi, locale) ?? pickPlatformName(BY_ID.get(id), locale) ?? id;
}

/** Full-colour tile (vendored under public/music-platforms/). */
export function musicPlatformTileSrc(id: string): string {
  return `/music-platforms/${id}.svg`;
}

/** One-colour `currentColor` glyph. */
export function musicPlatformMonoSrc(id: string): string {
  return `/music-platforms/${id}-mono.svg`;
}

/**
 * RFC 4122 v4 UUID for tracks and links (contract §10.6). `crypto.randomUUID`
 * needs a secure context; fall back to `getRandomValues` (available everywhere)
 * so a plain-http LAN preview still works.
 */
export function newUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      /* insecure context — fall through */
    }
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
