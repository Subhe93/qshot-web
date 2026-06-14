/**
 * Parse/serialize layer between the backend JSON and the editor model.
 *
 * MIRRORS the mobile fromJson/toJson (block_entity.dart, settings_entity.dart):
 *  - `parseBlocks`/`parseSettings` fill the SAME defaults the mobile `fromJson`
 *    applies and generate ids when missing, so an edit→save reproduces the
 *    JSON the mobile app would have produced.
 *  - `serializeBlocks`/`serializeSettings` are effectively identity because the
 *    types already mirror the JSON shape; unknown keys ride along untouched
 *    (passthrough), so we never drop data the mobile app stored.
 *
 * Source contract: docs/web-app-study/CONTRACT-json.md
 */

import { nanoid } from "nanoid";
import type {
  Block,
  ButtonItem,
  ImageItem,
  SocialLinkItem,
  ExternalLinkItem,
  VideoLinkItem,
  ProductItem,
  ReviewItem,
} from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";
import { hexToArgb } from "./color";

type Raw = Record<string, unknown>;

export function genId(): string {
  return nanoid();
}

const asBool = (v: unknown, d = false): boolean =>
  typeof v === "boolean" ? v : d;
const asNum = (v: unknown, d: number): number =>
  typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : d;
const asStr = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

/** Accept an ARGB int or a hex string and return an ARGB int (or null). */
function toArgb(v: unknown, fallback: number | null = null): number | null {
  if (typeof v === "number") return v >>> 0;
  if (typeof v === "string") {
    const h = v.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(h)) return hexToArgb(h);
    if (/^[0-9a-fA-F]{8}$/.test(h)) return parseInt(h, 16) >>> 0;
  }
  return fallback;
}

/** Common base fields every block shares, matching mobile BlockEntity.fromJson. */
function base(raw: Raw) {
  return {
    id: asStr(raw.id) || genId(),
    hide: asBool(raw.hide, false),
    use_background_color: asBool(raw.use_background_color, false),
    background_color: toArgb(raw.background_color, null),
  };
}

function parseSocialItem(raw: Raw): SocialLinkItem {
  return {
    ...raw,
    id: asStr(raw.id) || genId(),
    type: asStr(raw.type) || "link",
    icon: (raw.icon as string | null) ?? null,
    // Canonical key is `link`; tolerate a legacy `url`.
    link: asStr(raw.link) || asStr(raw.url) || "",
    name: (raw.name as string | null) ?? null,
    hidden: asBool(raw.hidden, false),
  };
}

function parseButtonItem(raw: Raw): ButtonItem {
  return {
    ...raw,
    id: asStr(raw.id) || genId(),
    title: asStr(raw.title),
    url: (raw.url as string | null) ?? null,
    icon: (raw.icon as string | null) ?? null,
    hidden: asBool(raw.hidden, false),
    background_color: toArgb(raw.background_color, null),
    use_background_color: (raw.use_background_color as boolean | null) ?? null,
    border_color: toArgb(raw.border_color, null),
    use_border: (raw.use_border as boolean | null) ?? null,
    text_color: toArgb(raw.text_color, null),
    use_text_color: (raw.use_text_color as boolean | null) ?? null,
    corner_radius:
      typeof raw.corner_radius === "number" ? raw.corner_radius : null,
  };
}

function parseImageItem(raw: Raw): ImageItem {
  return {
    ...raw,
    id: asStr(raw.id) || genId(),
    url: asStr(raw.url),
    rect: Array.isArray(raw.rect)
      ? (raw.rect as [number, number, number, number])
      : null,
    hidden: asBool(raw.hidden, false),
  };
}

const asStrOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

function parseExternalLinkItem(raw: Raw): ExternalLinkItem {
  return {
    ...raw,
    id: asStr(raw.id) || genId(),
    title: asStr(raw.title),
    url: asStr(raw.url),
    icon: asStrOrNull(raw.icon),
    thumbnail_url: asStrOrNull(raw.thumbnail_url),
    description: asStrOrNull(raw.description),
    hidden: asBool(raw.hidden, false),
  };
}

function parseVideoLinkItem(raw: Raw): VideoLinkItem {
  return {
    ...raw,
    id: asStr(raw.id) || genId(),
    title: asStr(raw.title),
    url: asStr(raw.url),
    thumbnail_url: asStrOrNull(raw.thumbnail_url),
    hidden: asBool(raw.hidden, false),
  };
}

function parseProductItem(raw: Raw): ProductItem {
  return {
    ...raw,
    id: asStr(raw.id) || genId(),
    thumbnail_url: asStrOrNull(raw.thumbnail_url),
    url: asStr(raw.url),
    title: asStr(raw.title),
    description: asStr(raw.description),
    currency: asStrOrNull(raw.currency),
    // Prices are STRINGS in the mobile contract — keep as-is.
    price: asStrOrNull(raw.price),
    price_after_discount: asStrOrNull(raw.price_after_discount),
    hidden: asBool(raw.hidden, false),
  };
}

function parseReviewItem(raw: Raw): ReviewItem {
  return {
    ...raw,
    id: asStr(raw.id) || genId(),
    reviewer_name: asStr(raw.reviewer_name),
    reviewer_photo_url: asStrOrNull(raw.reviewer_photo_url),
    // Mobile defaults a missing rating to 5.0.
    rating: typeof raw.rating === "number" ? raw.rating : 5,
    text: asStr(raw.text),
    relative_time_description: asStr(raw.relative_time_description),
    hidden: asBool(raw.hidden, false),
    locked: asBool(raw.locked, false),
    google_review_key: asStrOrNull(raw.google_review_key),
  };
}

/**
 * Normalize one raw block to the editor model, applying the mobile defaults.
 * Unknown keys are preserved via the leading spread; unknown block types pass
 * through untouched (rather than mobile's destructive Spacer fallback) so we
 * never corrupt data we don't yet model.
 */
export function parseBlock(input: unknown): Block {
  const raw = (input ?? {}) as Raw;
  const b = base(raw);
  const type = asStr(raw.type);

  switch (type) {
    case "social_links":
      return {
        ...raw,
        ...b,
        type: "social_links",
        layout_type: (asStr(raw.layout_type) || "gridAlignCenter") as never,
        icon_type: (asStr(raw.icon_type) || "darkFilled") as never,
        adaptive_icon_color: asBool(raw.adaptive_icon_color, false),
        custom_icon_color: toArgb(raw.custom_icon_color, null),
        links: Array.isArray(raw.links)
          ? (raw.links as Raw[]).map(parseSocialItem)
          : [],
      };

    case "HeaderModule":
      return {
        ...raw,
        ...b,
        type: "HeaderModule",
        value: asStr(raw.value),
        align: (asStr(raw.align) || "start") as never,
        size: asNum(raw.size, 22),
      };

    case "ParagraphModule":
      return {
        ...raw,
        ...b,
        type: "ParagraphModule",
        content: asStr(raw.content),
      };

    case "SpacerModule":
      return {
        ...raw,
        ...b,
        type: "SpacerModule",
        space: asNum(raw.space, 50),
      };

    case "DividerModule":
      return {
        ...raw,
        ...b,
        type: "DividerModule",
        space: asNum(raw.space, 2),
        // Mobile kDefaultColor = Colors.white (utils.dart:59).
        color: toArgb(raw.color, 0xffffffff) as number,
      };

    case "ButtonModule": {
      // Legacy single-button migration: `buttons` absent / not a list.
      const legacy = !Array.isArray(raw.buttons);
      const buttons: ButtonItem[] = legacy
        ? [
            parseButtonItem({
              title: raw.title,
              url: raw.url,
              icon: raw.icon,
              background_color: raw.background_color,
              use_background_color: raw.use_background_color,
              border_color: raw.border_color,
              use_border: raw.use_border,
            }),
          ]
        : (raw.buttons as Raw[]).map(parseButtonItem);
      return {
        ...raw,
        ...b,
        type: "ButtonModule",
        title: legacy ? "" : asStr(raw.title),
        background_color: legacy ? null : b.background_color,
        foldable: asBool(raw.foldable, false),
        layout_type: (asStr(raw.layout_type) || "list") as never,
        theme: (asStr(raw.theme) || "solid") as never,
        show_arrow: (raw.show_arrow as boolean | null) ?? null,
        buttons,
      };
    }

    case "ImageModule":
      return {
        ...raw,
        ...b,
        type: "ImageModule",
        layout_type: (asStr(raw.layout_type) || "swiper") as never,
        items: Array.isArray(raw.items)
          ? (raw.items as Raw[]).map(parseImageItem)
          : [],
      };

    case "ExternalLinksModule":
      return {
        ...raw,
        ...b,
        type: "ExternalLinksModule",
        title: asStr(raw.title),
        foldable: asBool(raw.foldable, false),
        show_arrow: (raw.show_arrow as boolean | null) ?? null,
        circle_image: (raw.circle_image as boolean | null) ?? null,
        layout_type: (asStr(raw.layout_type) || "list") as never,
        links: Array.isArray(raw.links)
          ? (raw.links as Raw[]).map(parseExternalLinkItem)
          : [],
      };

    case "VideoLinksModule":
      return {
        ...raw,
        ...b,
        type: "VideoLinksModule",
        title: asStr(raw.title),
        foldable: asBool(raw.foldable, false),
        layout_type: (asStr(raw.layout_type) || "list") as never,
        items: Array.isArray(raw.items)
          ? (raw.items as Raw[]).map(parseVideoLinkItem)
          : [],
      };

    case "ProductsModule":
      return {
        ...raw,
        ...b,
        type: "ProductsModule",
        title: asStr(raw.title),
        foldable: asBool(raw.foldable, false),
        show_arrow: (raw.show_arrow as boolean | null) ?? null,
        circle_image: (raw.circle_image as boolean | null) ?? null,
        layout_type: (asStr(raw.layout_type) || "grid") as never,
        items: Array.isArray(raw.items)
          ? (raw.items as Raw[]).map(parseProductItem)
          : [],
      };

    case "ReviewsModule":
      return {
        ...raw,
        ...b,
        type: "ReviewsModule",
        title: asStr(raw.title),
        foldable: asBool(raw.foldable, false),
        layout_type: (asStr(raw.layout_type) || "cards") as never,
        reviews: Array.isArray(raw.reviews)
          ? (raw.reviews as Raw[]).map(parseReviewItem)
          : [],
        google_place_id: asStrOrNull(raw.google_place_id),
        google_place_url: asStrOrNull(raw.google_place_url),
        google_last_fetched_at:
          typeof raw.google_last_fetched_at === "number"
            ? raw.google_last_fetched_at
            : null,
        click_url: asStrOrNull(raw.click_url),
        show_add_review_button: asBool(raw.show_add_review_button, false),
        add_review_url: asStrOrNull(raw.add_review_url),
      };

    // Blocks not yet edited in the web builder: keep their raw shape, only
    // ensure id + common defaults so they round-trip and render (Phase 3).
    default:
      return { ...raw, ...b, type: (type || "SpacerModule") } as Block;
  }
}

export function parseBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  return input.map(parseBlock);
}

/** Identity — the editor model already matches the JSON shape. */
export function serializeBlock(block: Block): Record<string, unknown> {
  return block as unknown as Record<string, unknown>;
}

export function serializeBlocks(blocks: Block[]): Record<string, unknown>[] {
  return blocks.map(serializeBlock);
}

/**
 * Settings are largely passthrough (the type mirrors the JSON). We only ensure
 * a default style and keep every other key — including the legacy `header_text`
 * and any unknown keys — verbatim.
 */
export function parseSettings(input: unknown): WebsiteSettings {
  const raw = (input ?? {}) as Raw;
  return { ...(raw as WebsiteSettings) };
}

export function serializeSettings(
  settings: WebsiteSettings,
): Record<string, unknown> {
  // `modules` (legacy block location) must never be sent under settings.
  const { modules: _modules, ...rest } = settings;
  return rest as Record<string, unknown>;
}
