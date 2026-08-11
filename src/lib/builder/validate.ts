/**
 * Pre-save guard against payloads the SERVER will reject — plus the URL
 * derivations that keep those payloads valid in the first place.
 *
 * The backend validates every profile save against its own schema (the live one
 * reports `schemaVersion: "2.0.0"` and `additionalProperties: false`; our copy
 * in `docs/for validation/website-json-schema.json` is the mobile team's spec
 * and is a LOWER BOUND on strictness) and refuses the whole document on a
 * violation — which surfaces to the user as an opaque "something went wrong".
 *
 * Two classes of violation can still reach the save path, so we name the
 * offending block instead of firing a doomed request:
 *   1. `findUnknownBlocks` — a block `type` outside the server's `oneOf`.
 *   2. `findIncompleteBlocks` — a required string the user hasn't filled in.
 *      2.0.0 rejects the empty string for `EmbedModule.data.url|html` and
 *      `IntroductionVideoModule.thumbnail_url`, even though our schema copy
 *      only says `"type": "string"`.
 *
 * Wiring (mirrors the existing `findUnknownBlocks` call in `BuilderShell`):
 *
 *     const incomplete = findIncompleteBlocks(blocks);
 *     if (incomplete.length) {
 *       setToast(t(incomplete[0].messageKey, { position: incomplete[0].index + 1 }));
 *       return;
 *     }
 *
 * Everything else (required keys, enums, coordinate types/ranges) is guaranteed
 * upstream: `catalog.ts` seeds schema-valid blocks, `serialization.ts` fills the
 * required defaults, and the editors are typed against the contract's unions.
 *
 * See docs/web-app-study/AUDIT-json-schema-compliance.md.
 */

import type { Block, BlockType, EmbedConfiguration } from "@/lib/types/blocks";

/** The 17 `type` discriminators the server's `oneOf` accepts. */
export const KNOWN_BLOCK_TYPES: readonly BlockType[] = [
  "social_links",
  "ExternalLinksModule",
  "VideoLinksModule",
  "ProductsModule",
  "ImageModule",
  "ReviewsModule",
  "HeaderModule",
  "ParagraphModule",
  "SpacerModule",
  "DividerModule",
  "ButtonModule",
  "SocialFeedModule",
  "FormModule",
  "LocationModule",
  "EmbedModule",
  "IntroductionVideoModule",
  "BookingModule",
];

const KNOWN = new Set<string>(KNOWN_BLOCK_TYPES);

export interface BlockIssue {
  /** 0-based position in `info.modules`. */
  index: number;
  type: string;
}

/**
 * Unknown block types, in document order.
 *
 * We deliberately keep unknown blocks verbatim while editing (mobile's parser
 * replaces them with an empty Spacer, silently destroying the content), so an
 * unsupported block CAN reach the save path — e.g. a block type the mobile app
 * shipped before this builder learned it. The server rejects those, so report
 * them rather than firing a request that is guaranteed to fail.
 */
export function findUnknownBlocks(blocks: Block[]): BlockIssue[] {
  const issues: BlockIssue[] = [];
  blocks.forEach((b, index) => {
    const type = (b as { type?: unknown }).type;
    if (typeof type !== "string" || !KNOWN.has(type)) {
      issues.push({ index, type: typeof type === "string" && type ? type : "—" });
    }
  });
  return issues;
}

// ---------------------------------------------------------------------------
// YouTube — deterministic, network-free derivations
// ---------------------------------------------------------------------------

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
]);

/**
 * The 11-character video id of any YouTube link, or null.
 *
 * Covers every form the address bar produces — `watch?v=`, `youtu.be/`,
 * `shorts/`, `embed/`, `v/`, `live/`, extra query params, scheme-less paste —
 * a superset of the mobile `YoutubeEmbedConfiguration.regex` /
 * `VideoUtils.getYoutubeVideoId`.
 */
export function youtubeVideoId(input?: string | null): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  // A scheme-less paste ("youtu.be/…") is what a browser address bar accepts.
  const href = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const seg = u.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") {
    id = seg[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (seg[0] === "watch") id = u.searchParams.get("v");
    else if (seg[0] && ["embed", "v", "shorts", "live"].includes(seg[0]))
      id = seg[1] ?? null;
    else id = u.searchParams.get("v");
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Marker for a poster WE derived (so a later url edit may replace it). */
export const YOUTUBE_THUMBNAIL_PREFIX = "https://img.youtube.com/vi/";

/**
 * The deterministic YouTube poster for a video link, or null when the link is
 * not YouTube. `hqdefault.jpg` exists for every public video (unlike
 * `maxresdefault.jpg`), so this never 404s on a valid id.
 */
export function youtubeThumbnailUrl(url?: string | null): string | null {
  const id = youtubeVideoId(url);
  return id ? `${YOUTUBE_THUMBNAIL_PREFIX}${id}/hqdefault.jpg` : null;
}

/** True for a poster this module produced (vs. a user upload / mobile CDN key). */
export function isDerivedThumbnail(value?: string | null): boolean {
  return !!value && value.startsWith(YOUTUBE_THUMBNAIL_PREFIX);
}

// ---------------------------------------------------------------------------
// Embed — html the mobile app produces without an oembed round-trip
// ---------------------------------------------------------------------------

/**
 * The embed html for a provider + url, when it can be built offline.
 *
 * The web port has no oembed backend, so we reproduce exactly the mobile
 * `EmbedConfiguration.fetchEmbed` results that need no network:
 *   - `custom`   → `EmbedData(url: url, html: url)` — the raw markup goes in
 *                  BOTH fields (lib/.../embed_entity.dart CustomEmbedConfiguration).
 *   - `telegram` → the widget `<script>` built from the post path, byte-for-byte
 *                  the mobile TelegramEmbedConfiguration string.
 *   - `youtube`  → the oembed iframe wrapped in the mobile `_solve()` style
 *                  block; `https://www.youtube.com/embed/<id>?feature=oembed` is
 *                  exactly what the oembed endpoint returns for that video.
 * Everything else genuinely requires the provider's oembed API — the user pastes
 * the site's own "copy embed code" markup into the html field instead.
 */
export function deriveEmbedHtml(
  configuration: EmbedConfiguration,
  url?: string | null,
): string | null {
  const value = (url ?? "").trim();
  if (!value) return null;

  if (configuration === "custom") return value;

  if (configuration === "youtube") {
    const id = youtubeVideoId(value);
    if (!id) return null;
    return (
      "<style>iframe { width:100%; height:100% !important; position: fixed; bottom: 0px;}</style> " +
      `<iframe width="200" height="113" src="https://www.youtube.com/embed/${id}?feature=oembed" ` +
      'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; ' +
      'gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
      "allowfullscreen></iframe>"
    );
  }

  if (configuration === "telegram") {
    if (!/^https?:\/\/t\.me\/[^/]+\/\d+/.test(value)) return null;
    const id = value.replace(/^https?:\/\/t\.me\//, "");
    return `\n<script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-post="${id}" data-width="100%"></script>\n`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Required-but-empty strings
// ---------------------------------------------------------------------------

/** Message keys under the `builder` namespace; each takes `{position}`. */
export type IncompleteMessageKey =
  | "incomplete.videoUrl"
  | "incomplete.videoThumbnail"
  | "incomplete.embedEmpty"
  | "incomplete.embedUrl"
  | "incomplete.embedHtml";

export interface IncompleteIssue extends BlockIssue {
  messageKey: IncompleteMessageKey;
}

const blank = (v?: unknown) => typeof v !== "string" || !v.trim();

/**
 * Blocks whose required strings are still empty, in document order.
 *
 * The builder lets you ADD an Embed / Introduction video block and fill it in
 * later (the mobile app instead collects the data in a wizard BEFORE the block
 * exists, so it never holds an empty one). That convenience means an empty —
 * and therefore unsavable — block can reach the save path; say which block and
 * which field rather than letting the server answer with a bare 422.
 */
export function findIncompleteBlocks(blocks: Block[]): IncompleteIssue[] {
  const issues: IncompleteIssue[] = [];
  blocks.forEach((b, index) => {
    if (b.type === "IntroductionVideoModule") {
      if (blank(b.url)) issues.push({ index, type: b.type, messageKey: "incomplete.videoUrl" });
      else if (blank(b.thumbnail_url))
        issues.push({ index, type: b.type, messageKey: "incomplete.videoThumbnail" });
    } else if (b.type === "EmbedModule") {
      const data = b.data ?? {};
      const noUrl = blank(data.url);
      const noHtml = blank(data.html);
      if (noUrl && noHtml)
        issues.push({ index, type: b.type, messageKey: "incomplete.embedEmpty" });
      else if (noUrl) issues.push({ index, type: b.type, messageKey: "incomplete.embedUrl" });
      else if (noHtml) issues.push({ index, type: b.type, messageKey: "incomplete.embedHtml" });
    }
  });
  return issues;
}
