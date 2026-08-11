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
  ExternalLinksBlock,
  VideoLinkItem,
  VideoLinksBlock,
  ProductItem,
  ReviewItem,
} from "@/lib/types/blocks";
import type { TemplateRef, WebsiteSettings } from "@/lib/types/profile";
import { hexToArgb } from "./color";
import { solidArgb } from "./color-value";

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
  // `icon` is NOT in the contract. Mobile `ExternalLinkItem.toJson()` writes
  // exactly {id, thumbnail_url, title, description, url, hidden} and the schema
  // lists the same six; the key was a web-only invention. The deployed
  // validator enforces `additionalProperties: false`, so emitting it made the
  // server reject the WHOLE profile with
  //   422 unknown field "icon" is not allowed  (/modules/N/links/M).
  //
  // Dropping it at PARSE time (not at serialize time, the way VideoLinkItem's
  // web-only title/thumbnail_url are handled) because:
  //   1. nothing in the web app reads `item.icon` for external links — no
  //      editor sets it, no preview renders it — so it has no reason to exist
  //      in the in-memory model at all;
  //   2. it must also be scrubbed from data ALREADY poisoned by the previous
  //      build, and only a parse-time strip cleans what the server sends back;
  //   3. the model then can't leak the key through any other path that builds a
  //      payload from blocks (page duplication, template apply, AI transform).
  // VideoLinkItem is the opposite case: its `title` IS read by the preview
  // (VideoLinksBlockView), so it has to stay in the model and can only be
  // removed on the way out — see serializeBlock.
  const rest = { ...raw };
  delete rest.icon;
  return {
    ...rest,
    id: asStr(raw.id) || genId(),
    title: asStr(raw.title),
    url: asStr(raw.url),
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
      // A blank/missing type degrades to a Spacer (as mobile's fromJson does).
      // It MUST carry `space` — the server schema requires it, and the previous
      // fallback emitted a Spacer without one, which blocked every later save.
      if (!type) {
        return {
          ...raw,
          ...b,
          type: "SpacerModule",
          space: asNum(raw.space, 50),
        } as Block;
      }
      return { ...raw, ...b, type } as Block;
  }
}

export function parseBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  return input.map(parseBlock);
}

/**
 * Near-identity — the editor model already matches the JSON shape. Exceptions,
 * both of them keys the WEB invented that the contract has no room for:
 *
 *  - VideoLinkItem carries web-only `title`/`thumbnail_url`. The mobile
 *    contract is strictly `{id, url, hidden}`, but the preview genuinely reads
 *    `item.title` (lazy YouTube oEmbed label), so the key has to live in the
 *    model and can only be dropped on the way out.
 *  - ExternalLinkItem must never carry `icon`. parseExternalLinkItem already
 *    strips it, so this is a second line of defence for items that reach the
 *    store without going through the parser (fixtures, templates, AI import).
 *
 * ── Residual risk (deliberately NOT addressed here) ────────────────────────
 * The server validator (schemaVersion 2.0.0) enforces
 * `additionalProperties: false`, so ANY key it does not know fails the entire
 * save with 422. parseBlock spreads `...raw` and the item parsers spread the
 * raw item, on purpose: it preserves fields the web app does not model yet so
 * mobile-authored data survives a web edit. That passthrough can, in theory,
 * carry an unknown key back to a validator that rejects it.
 *
 * We do NOT defend against that with a whitelist built from
 * `docs/for validation/website-json-schema.json`. That file is the mobile
 * team's hand-written documentation, NOT the deployed artifact ("2.0.0"), and
 * it is known to lag. Filtering by a stale whitelist would silently DELETE
 * fields the real schema accepts — turning a loud, recoverable 422 into quiet
 * data loss. Only keys we can prove we invented are removed, one by one.
 * If a future 422 names another field, verify it against the mobile
 * `toJson()` first, then add it here (or stop emitting it at parse time).
 */
export function serializeBlock(block: Block): Record<string, unknown> {
  if (block.type === "VideoLinksModule") {
    const b = block as VideoLinksBlock;
    return {
      ...b,
      items: (b.items ?? []).map((it) => {
        const clean = { ...it };
        delete clean.title;
        delete clean.thumbnail_url;
        return clean;
      }),
    };
  }
  if (block.type === "ExternalLinksModule") {
    const b = block as ExternalLinksBlock;
    return {
      ...b,
      links: (b.links ?? []).map((it) => {
        const clean = { ...it };
        delete clean.icon;
        return clean;
      }),
    };
  }
  return block as unknown as Record<string, unknown>;
}

export function serializeBlocks(blocks: Block[]): Record<string, unknown>[] {
  return blocks.map(serializeBlock);
}

/**
 * `settings.template` (mobile TemplateRef) is now `{id: string | null}` — the
 * contract change that REMOVED `brand_color`. It otherwise rides the settings
 * passthrough like `card_style`: web never invents a `"template": null` on
 * sites that never had the key (mobile fromJson treats missing and null
 * identically), and any other key inside the object is preserved.
 *
 * ── Why `brand_color` is STRIPPED here, on the way IN ──────────────────────
 * Documents saved before this change still carry it, and the settings parser
 * is a passthrough, so it would ride back out on the next save. The deployed
 * validator enforces `additionalProperties: false`: the moment the backend
 * drops `brand_color` from the schema, echoing it back fails the WHOLE save
 * with 422 — precisely the `icon` failure on ExternalLinkItem (see
 * parseExternalLinkItem), and the same three reasons make PARSE-time the right
 * place there and here:
 *   1. nothing in the app reads `template.brand_color` any more — the Theme
 *      sheet's accent dot derives the color from the template itself
 *      (`templateAccentColor`), so the key has no reason to exist in memory;
 *   2. the data ALREADY carrying it must be cleaned, and only a parse-time
 *      strip cleans what the server sends back;
 *   3. the model then cannot leak the key through any other payload path
 *      (page duplication, template apply, AI import).
 * This is not the "stale whitelist" filtering the block passthrough refuses:
 * it is one key, named by the contract owners as removed, exactly like `icon`.
 *
 * `id` is normalized to `string | null` so a legacy object that somehow lacks
 * one still satisfies the schema's `required: ["id"]` on the way back out.
 */
function parseTemplateRef(raw: unknown): TemplateRef | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || typeof raw !== "object") return null;
  const rest = { ...(raw as Raw) };
  delete rest.brand_color;
  return { ...rest, id: asStrOrNull((raw as Raw).id) } as TemplateRef;
}

/**
 * Settings are largely passthrough (the type mirrors the JSON). We only ensure
 * a default style and keep every other key — including the legacy `header_text`
 * and any unknown keys — verbatim. The one exception is `settings.template`,
 * normalized by `parseTemplateRef` above.
 */
export function parseSettings(input: unknown): WebsiteSettings {
  const raw = (input ?? {}) as Raw;
  const out = { ...(raw as WebsiteSettings) };
  if ("template" in raw) out.template = parseTemplateRef(raw.template);
  return out;
}

export function serializeSettings(
  settings: WebsiteSettings,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(settings as Record<string, unknown>) };
  // `modules` (legacy block location) must never be sent under settings.
  // `verified` is a profile-level, admin-managed flag — not part of the mobile
  // settings contract — so don't echo it back inside `settings`.
  delete out.modules;
  delete out.verified;

  // Second line of defence for the removed `template.brand_color` — the same
  // belt-and-braces as ExternalLinkItem.icon (parse-time strip + serialize-time
  // strip), for settings that reach the store without passing parseSettings
  // (fixtures, AI import, a store hydrated from a raw payload).
  if (settings.template != null && "brand_color" in settings.template) {
    const template = { ...(settings.template as unknown as Raw) };
    delete template.brand_color;
    out.template = template;
  }

  // Colour contract: the solid `color_value.color` MUST be an ARGB int. The
  // mobile app does `Color(json['color'])`, which throws on a legacy hex string,
  // so normalize any hex/legacy value to an ARGB int on save.
  const cv = settings.background?.color_value;
  if (cv && cv.type === "solid") {
    out.background = {
      ...(settings.background as object),
      color_value: { type: "solid", color: solidArgb(cv.color) },
    };
  }
  return out;
}
