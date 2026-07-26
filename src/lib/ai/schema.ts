/**
 * AI-facing INTERMEDIATE schema for the "Try with AI" website generator.
 *
 * This is deliberately friendlier than the strict wire contract: hex colors
 * (LLMs handle hex far better than ARGB ints), plain text (no Quill deltas), no
 * ids. `src/lib/ai/transform.ts` maps it to the real block/settings contract.
 *
 * v1 block kinds (basic): header, paragraph, buttons, social, external_links,
 * divider, spacer.
 *
 * v2 additions (richer/modern output):
 *  - ImageSpec: the model writes only `prompt` (+ optional `alt`); the SERVER
 *    (route.ts) generates the image, uploads it to the CDN, and fills
 *    `fileName` AFTER generation. transform.ts reads ONLY `fileName`.
 *  - top-level `font` (modern Google-font allowlist) → settings.font_family.
 *  - `hero.cover` (ImageSpec) — generated ONLY when the user uploaded no cover.
 *  - new block kinds: gallery, reviews, location, products.
 *  - external_links items gain an optional `image` (image-backed cards).
 * Image generation is capped at 4 per site and orchestrated by route.ts;
 * transform stays pure/sync and consumes `fileName`/`place`.
 */

import { z } from "zod";
import type { LinkConfigurationName } from "@/lib/types/blocks";

export const HERO_STYLES = [
  "style1",
  "style2",
  "style3",
  "style4",
  "style5",
  "style6",
  "style7",
] as const;

// Social platforms the model may map to (subset of LinkConfigurationName that
// makes sense from a contact/description; `custom`/`website` cover the rest).
// `satisfies` pins this to the 19 values the server's website-json-schema.json
// accepts for `social_links[].type` — anything else makes the whole profile
// save fail, so drift here must be a compile error.
export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "whatsapp",
  "tiktok",
  "youtube",
  "twitter",
  "snapchat",
  "linkedin",
  "pinterest",
  "twitch",
  "vimeo",
  "behance",
  "phone",
  "email",
  "website",
  "location",
  "custom",
] as const satisfies readonly LinkConfigurationName[];

// Modern Google-font allowlist; transform maps it to settings.font_family.
export const FONTS = [
  "inter",
  "poppins",
  "manrope",
  "sora",
  "playfair",
  "montserrat",
  "nunito",
] as const;

const hex = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "expected #rrggbb hex");
const align = z.enum(["start", "center", "end"]);

/**
 * An image the model WANTS generated. The model fills `prompt` (a vivid,
 * brand/industry-specific scene with NO text/letters/logos) and optional `alt`.
 * The SERVER generates it, uploads to the CDN, and fills `fileName` (the CDN
 * key). transform.ts reads ONLY `fileName` (skip the image if it's absent).
 */
const imageSpec = z.object({
  prompt: z.string().min(1),
  alt: z.string().optional(),
  /** Filled by the server after generation/upload — never by the model. */
  fileName: z.string().optional(),
});

export type AiImageSpec = z.infer<typeof imageSpec>;

const headerBlock = z.object({
  kind: z.literal("header"),
  text: z.string().min(1),
  align: align.optional(),
  size: z.number().optional(),
  /** Render this section on a soft brand-tinted background. */
  accent: z.boolean().optional(),
});

const paragraphBlock = z.object({
  kind: z.literal("paragraph"),
  text: z.string().min(1),
  accent: z.boolean().optional(),
});

const buttonsBlock = z.object({
  kind: z.literal("buttons"),
  title: z.string().optional(),
  theme: z.enum(["minimal", "solid", "soft", "outline", "pill"]).optional(),
  layout: z.enum(["list", "grid"]).optional(),
  accent: z.boolean().optional(),
  items: z
    .array(z.object({ label: z.string().min(1), url: z.string().min(1) }))
    .min(1),
});

const socialBlock = z.object({
  kind: z.literal("social"),
  layout: z
    .enum(["grid", "list", "gridAlignCenter", "listAlignCenter"])
    .optional(),
  items: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORMS),
        link: z.string().min(1),
        name: z.string().optional(),
      }),
    )
    .min(1),
});

const externalLinksBlock = z.object({
  kind: z.literal("external_links"),
  title: z.string().optional(),
  layout: z.enum(["list", "grid", "largeGrid", "swiper", "promo"]).optional(),
  accent: z.boolean().optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().min(1),
        description: z.string().optional(),
        /** Image-backed feature/service card (use with "largeGrid"/"promo"). */
        image: imageSpec.optional(),
      }),
    )
    .min(1),
});

/** Image gallery — 2–6 images, grid or carousel. */
const galleryBlock = z.object({
  kind: z.literal("gallery"),
  title: z.string().optional(),
  layout: z.enum(["grid", "carousel"]).optional(),
  images: z.array(imageSpec).min(2).max(6),
});

/** Customer reviews / testimonials — 2–5 items. */
const reviewsBlock = z.object({
  kind: z.literal("reviews"),
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        author: z.string().min(1),
        role: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        text: z.string().min(1),
      }),
    )
    .min(1)
    .max(6),
});

/** Location/map — the server resolves `place` from `address` via Google Places. */
const locationBlock = z.object({
  kind: z.literal("location"),
  title: z.string().optional(),
  address: z.string().min(1),
  /** Filled by the server (Google Places) — never by the model. */
  place: z.object({}).passthrough().optional(),
});

/** Products / services with optional per-item image. */
const productsBlock = z.object({
  kind: z.literal("products"),
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.string().optional(),
        description: z.string().optional(),
        image: imageSpec.optional(),
      }),
    )
    .min(1),
});

/** Contact form. `fields` is optional — omit for a standard Name/Email/Phone/Message form. */
const formBlock = z.object({
  kind: z.literal("form"),
  title: z.string().optional(),
  fields: z
    .array(
      z.object({
        label: z.string().min(1),
        type: z.enum(["text", "paragraph", "choices", "rating"]).optional(),
        required: z.boolean().optional(),
      }),
    )
    .optional(),
});

const dividerBlock = z.object({ kind: z.literal("divider") });

const spacerBlock = z.object({
  kind: z.literal("spacer"),
  space: z.number().optional(),
});

/** One generated block — discriminated by `kind`. Parsed per-item (lenient). */
export const aiBlockSchema = z.discriminatedUnion("kind", [
  headerBlock,
  paragraphBlock,
  buttonsBlock,
  socialBlock,
  externalLinksBlock,
  galleryBlock,
  reviewsBlock,
  locationBlock,
  productsBlock,
  formBlock,
  dividerBlock,
  spacerBlock,
]);

export type AiBlock = z.infer<typeof aiBlockSchema>;

/**
 * Top-level generated website. Resilience is intentional: `blocks` is
 * `unknown[]` (transform validates each block individually) AND every top-level
 * scalar/enum/color field uses `.catch()` so a single minor model deviation (a
 * 3-digit hex, a font/style outside the allowlist, a missing button url) DEGRADES
 * GRACEFULLY instead of failing the whole generation. The route overrides
 * businessName/brand with the user's authoritative values anyway.
 */
const lenientButton = z
  .object({ label: z.string().optional(), url: z.string().optional() })
  .catch(() => ({}))
  .optional();

export const aiWebsiteSchema = z.object({
  businessName: z.string().min(1).catch(() => "My Website"),
  style: z.enum(HERO_STYLES).catch("style2"),
  /** Modern Google font; transform maps it to settings.font_family. */
  font: z
    .enum(FONTS)
    .optional()
    .catch(() => undefined),
  brand: z
    .object({
      primary: hex.optional().catch(() => undefined),
      secondary: hex.optional().catch(() => undefined),
      background: hex.optional().catch(() => undefined),
      text: hex.optional().catch(() => undefined),
    })
    .optional()
    .catch(() => undefined),
  hero: z
    .object({
      title: z.string().optional(),
      tagline: z.string().optional(),
      name: z.string().optional(),
      bio: z.string().optional(),
      primaryButton: lenientButton,
      secondaryButton: lenientButton,
      /** Generated hero cover — ONLY when the user uploaded no cover. */
      cover: imageSpec.optional().catch(() => undefined),
    })
    .optional()
    .catch(() => undefined),
  blocks: z.array(z.unknown()).catch(() => []),
});

export type AiWebsite = z.infer<typeof aiWebsiteSchema>;
