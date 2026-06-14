/**
 * Transform the AI INTERMEDIATE output (src/lib/ai/schema.ts) into the strict
 * wire contract the builder/renderer accepts (blocks + settings).
 *
 * Responsibilities the model does NOT do (we own these):
 *  - generate `id`s (nanoid) for every block & item
 *  - hex → ARGB int color conversion
 *  - Quill Delta encoding for paragraphs
 *  - real CDN image paths for logo/cover (injected from uploads)
 *  - start from the chosen style's full `fillDefaults` so the hero is complete
 */

import { nanoid } from "nanoid";
import { fillDefaults } from "@/lib/builder/hero-defaults";
import { hexToArgb } from "@/lib/builder/color";
import type {
  Block,
  ButtonItem,
  ExternalLinkItem,
  SocialLinkItem,
} from "@/lib/types/blocks";
import type { HeroStyle, WebsiteSettings } from "@/lib/types/profile";
import { aiBlockSchema, type AiWebsite } from "./schema";

export interface AiAssets {
  /** CDN file_name for the uploaded logo (from q-profile/image/create). */
  logoFileName?: string | null;
  /** CDN file_name for the uploaded cover. */
  coverFileName?: string | null;
}

/** Hex (#rrggbb) → opaque ARGB int, or `undefined` if missing/invalid. */
function toArgb(hex?: string): number | undefined {
  if (!hex) return undefined;
  const h = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined;
  return hexToArgb(h);
}

/** Pick a readable foreground (black/white) for a given ARGB background. */
function readableOn(argb: number): number {
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? 0xff000000 : 0xffffffff;
}

function clampSize(size?: number): number {
  if (typeof size !== "number" || Number.isNaN(size)) return 24;
  return Math.min(40, Math.max(14, Math.round(size)));
}

/** A very light, opaque tint of `argb` over white — for branded section cards. */
function softTint(argb: number, ratio = 0.1): number {
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  const mix = (c: number) => Math.round(c * ratio + 255 * (1 - ratio));
  return ((0xff << 24) | (mix(r) << 16) | (mix(g) << 8) | mix(b)) >>> 0;
}

/** Encode plain text as a JSON-stringified Quill Delta (matches the contract). */
function toDelta(text: string): string {
  const body = text.endsWith("\n") ? text : `${text}\n`;
  return JSON.stringify([{ insert: body }]);
}

/** Build full settings from the chosen style's defaults + AI hero/brand + assets. */
export function buildSettings(ai: AiWebsite, assets: AiAssets): WebsiteSettings {
  const style = (
    ai.style && ai.style in HERO_STYLE_SET ? ai.style : "style2"
  ) as HeroStyle;

  const s = fillDefaults(style, {
    websiteName: ai.businessName,
    websiteLogo: assets.logoFileName ?? null,
  });

  // Real uploaded images (model never sets asset URLs).
  if (assets.coverFileName) {
    s.cover_photo = { ...(s.cover_photo ?? {}), image_url: assets.coverFileName, hide: false };
  }
  if (assets.logoFileName) {
    s.logo = { ...(s.logo ?? {}), image_url: assets.logoFileName, hide: false };
  }

  // Brand palette.
  const primary = toArgb(ai.brand?.primary);
  const secondary = toArgb(ai.brand?.secondary);
  const background = toArgb(ai.brand?.background);
  if (background) s.background = { color_value: { type: "solid", color: background } };
  if (primary && s.button1) {
    s.button1 = { ...s.button1, background_color: primary, foreground_color: readableOn(primary) };
  }
  if (secondary && s.button2) {
    s.button2 = { ...s.button2, background_color: secondary, foreground_color: readableOn(secondary) };
  }

  // Hero copy.
  const hero = ai.hero;
  if (hero?.title && s.title) s.title = { ...s.title, text: hero.title };
  if (hero?.tagline && s.text) s.text = { ...s.text, text: hero.tagline };
  if (hero?.name) s.name = { ...(s.name ?? {}), text: hero.name };
  if (hero?.bio) s.bio = { ...(s.bio ?? {}), text: hero.bio };
  if (hero?.primaryButton && s.button1) {
    s.button1 = { ...s.button1, text: hero.primaryButton.label, url: hero.primaryButton.url };
  }
  if (hero?.secondaryButton && s.button2) {
    s.button2 = { ...s.button2, text: hero.secondaryButton.label, url: hero.secondaryButton.url };
  }

  // Header bar: title = business name, and brand it when it's a real top bar
  // (aboveCover). Skip onCover headers (transparent over the image) to avoid clashing.
  if (s.header) {
    const branded =
      primary && s.header.position === "aboveCover"
        ? { background_color: primary, foreground_color: readableOn(primary) }
        : {};
    s.header = {
      ...s.header,
      ...branded,
      title: { ...(s.header.title ?? {}), text: ai.businessName },
    };
  }

  return s;
}

const HERO_STYLE_SET: Record<HeroStyle, true> = {
  style1: true, style2: true, style3: true, style4: true,
  style5: true, style6: true, style7: true,
};

/**
 * Map the AI blocks (lenient, per-item) to strict wire blocks with ids.
 * `brandPrimary` (ARGB) is used to brand accent sections + the divider.
 */
export function transformBlocks(
  rawBlocks: unknown[],
  brandPrimary?: number,
): Block[] {
  const accentBg = brandPrimary ? softTint(brandPrimary, 0.1) : undefined;
  const dividerColor = brandPrimary ? softTint(brandPrimary, 0.35) : 0xffe4e7ed;

  // Apply a soft brand-tinted background to a section when the model flags it.
  const tint = (accent?: boolean) =>
    accent && accentBg
      ? { use_background_color: true, background_color: accentBg }
      : {};

  const out: Block[] = [];
  for (const raw of rawBlocks) {
    const parsed = aiBlockSchema.safeParse(raw);
    if (!parsed.success) continue;
    const b = parsed.data;

    switch (b.kind) {
      case "header":
        out.push({
          id: nanoid(),
          type: "HeaderModule",
          value: b.text,
          align: b.align ?? "center",
          size: clampSize(b.size),
          ...tint(b.accent),
        });
        break;

      case "paragraph":
        out.push({
          id: nanoid(),
          type: "ParagraphModule",
          content: toDelta(b.text),
          ...tint(b.accent),
        });
        break;

      case "buttons": {
        const buttons: ButtonItem[] = b.items.map((it) => ({
          id: nanoid(),
          title: it.label,
          url: it.url,
        }));
        out.push({
          id: nanoid(),
          type: "ButtonModule",
          title: b.title ?? "",
          theme: b.theme ?? "solid",
          layout_type: b.layout ?? "list",
          buttons,
          ...tint(b.accent),
        });
        break;
      }

      case "social": {
        const links: SocialLinkItem[] = b.items.map((it) => ({
          id: nanoid(),
          type: it.platform,
          link: it.link,
          name: it.name ?? null,
        }));
        out.push({
          id: nanoid(),
          type: "social_links",
          layout_type: b.layout ?? "gridAlignCenter",
          icon_type: "darkFilled",
          links,
        });
        break;
      }

      case "external_links": {
        const links: ExternalLinkItem[] = b.items.map((it) => ({
          id: nanoid(),
          title: it.title,
          url: it.url,
          description: it.description ?? null,
        }));
        out.push({
          id: nanoid(),
          type: "ExternalLinksModule",
          title: b.title ?? "",
          layout_type: b.layout ?? "list",
          links,
          ...tint(b.accent),
        });
        break;
      }

      case "divider":
        out.push({
          id: nanoid(),
          type: "DividerModule",
          space: 2,
          color: dividerColor,
        });
        break;

      case "spacer":
        out.push({
          id: nanoid(),
          type: "SpacerModule",
          space: typeof b.space === "number" ? b.space : 24,
        });
        break;
    }
  }
  return out;
}

/** Full transform: AI website → { settings, blocks } ready for save/draft. */
export function transformWebsite(
  ai: AiWebsite,
  assets: AiAssets,
): { settings: WebsiteSettings; blocks: Block[] } {
  const brandPrimary = toArgb(ai.brand?.primary);
  return {
    settings: buildSettings(ai, assets),
    blocks: transformBlocks(ai.blocks, brandPrimary),
  };
}
