/**
 * AI-facing INTERMEDIATE schema for the "Try with AI" website generator.
 *
 * This is deliberately friendlier than the strict wire contract: hex colors
 * (LLMs handle hex far better than ARGB ints), plain text (no Quill deltas), no
 * ids. `src/lib/ai/transform.ts` maps it to the real block/settings contract.
 *
 * v1 block kinds (basic): header, paragraph, buttons, social, external_links,
 * divider, spacer. (Location/products/reviews/etc. are deferred — see
 * docs/web-app-study/PLAN-ai-website-generator.md.)
 */

import { z } from "zod";

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
export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "whatsapp",
  "tiktok",
  "youtube",
  "twitter",
  "snapchat",
  "telegram",
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
] as const;

const hex = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "expected #rrggbb hex");
const align = z.enum(["start", "center", "end"]);

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
      }),
    )
    .min(1),
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
  dividerBlock,
  spacerBlock,
]);

export type AiBlock = z.infer<typeof aiBlockSchema>;

/**
 * Top-level generated website. `blocks` is intentionally `unknown[]` so a single
 * malformed block doesn't fail the whole response — the transformer validates
 * and keeps blocks individually.
 */
export const aiWebsiteSchema = z.object({
  businessName: z.string().min(1),
  style: z.enum(HERO_STYLES),
  brand: z
    .object({
      primary: hex.optional(),
      secondary: hex.optional(),
      background: hex.optional(),
      text: hex.optional(),
    })
    .optional(),
  hero: z
    .object({
      title: z.string().optional(),
      tagline: z.string().optional(),
      name: z.string().optional(),
      bio: z.string().optional(),
      primaryButton: z
        .object({ label: z.string(), url: z.string() })
        .optional(),
      secondaryButton: z
        .object({ label: z.string(), url: z.string() })
        .optional(),
    })
    .optional(),
  blocks: z.array(z.unknown()).min(1),
});

export type AiWebsite = z.infer<typeof aiWebsiteSchema>;
