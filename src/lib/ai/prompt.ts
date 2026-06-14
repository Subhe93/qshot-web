/**
 * Prompt builder for the AI website generator. Produces a single instruction
 * string describing the task + the exact intermediate JSON schema the model must
 * emit (see src/lib/ai/schema.ts). The logo + cover images are attached as
 * separate parts by the route, so the model can infer brand colors/mood.
 */

export interface PromptInput {
  description: string;
  language?: string;
  /** Authoritative business name supplied by the user. */
  businessName?: string;
  /** User-chosen brand colors (#rrggbb) — the model MUST use these. */
  brandPrimary?: string;
  brandSecondary?: string;
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
    whatsapp?: string;
    instagram?: string;
    website?: string;
    [key: string]: string | undefined;
  };
}

const STYLE_GUIDE = `Available "style" templates (pick the ONE that best fits the business):
- style1: minimal, dark background, profile-photo centric (personal brands).
- style2: clean light, big cover + title + two buttons (general business). Safe default.
- style3: tall vertical cover, elegant editorial feel.
- style4: light blue, friendly/tech, two buttons.
- style5: purple-accented, bold/creative.
- style6: airy white, modern startup.
- style7: warm tones, card-based, services/boutique.`;

const SCHEMA_GUIDE = `Return ONLY a JSON object (no markdown, no commentary) with this shape:
{
  "businessName": string,                       // concise brand name inferred from the description
  "style": "style1".."style7",
  "brand": {                                    // colors as #rrggbb hex, inferred from the logo/cover
    "primary": "#rrggbb",                       // main accent (primary button)
    "secondary": "#rrggbb",                     // secondary accent
    "background": "#rrggbb",                    // soft page background
    "text": "#rrggbb"
  },
  "hero": {
    "title": string,                            // punchy headline (max ~8 words)
    "tagline": string,                          // one supporting sentence
    "name": string,                             // optional display name
    "bio": string,                              // optional short bio
    "primaryButton": { "label": string, "url": string },
    "secondaryButton": { "label": string, "url": string }
  },
  "blocks": [                                    // 6-10 ordered, content-rich blocks
    // "accent": true renders the section on a soft brand-tinted card — use it on
    // ~2-3 key sections to create visual rhythm and reinforce the brand identity.
    { "kind": "header", "text": string, "align": "start|center|end", "size": number, "accent": boolean },
    { "kind": "paragraph", "text": string, "accent": boolean },
    { "kind": "buttons", "title": string, "theme": "minimal|solid|soft|outline|pill", "layout": "list|grid",
      "accent": boolean, "items": [ { "label": string, "url": string } ] },
    { "kind": "social", "layout": "grid|list|gridAlignCenter|listAlignCenter",
      "items": [ { "platform": "instagram|facebook|whatsapp|tiktok|youtube|twitter|snapchat|telegram|linkedin|pinterest|website|phone|email|location|custom", "link": string } ] },
    // external_links doubles as FEATURE / SERVICE CARDS: each item is a card with a
    // title + description. Use layout "largeGrid" or "grid" or "promo" for a rich look.
    { "kind": "external_links", "title": string, "layout": "list|grid|largeGrid|swiper|promo",
      "accent": boolean, "items": [ { "title": string, "url": string, "description": string } ] },
    { "kind": "divider" },
    { "kind": "spacer", "space": number }
  ]
}`;

const RULES = `Rules:
- Write like a senior brand copywriter: confident, specific, benefit-driven. NO placeholder/lorem text, no generic "Welcome to our website". Every line should sell the business.
- Headline (hero.title): short and punchy (max ~8 words). Tagline: one concrete value proposition. Avoid clichés.
- Pick the "style" that best fits the industry and mood of the images/description.
- Make it RICH and complete — aim for 6-10 blocks, like a real landing page. A typical strong structure:
  1) header (section label, e.g. "About") + paragraph — who they are / value prop.
  2) header "Services"/"What we offer" + an external_links FEATURE-CARD grid (3-6 cards, each title + 1-line description). This is the visual centerpiece — always include it for businesses with services/products.
  3) header "Why choose us" + paragraph OR a second feature-card grid of benefits.
  4) a testimonial-style paragraph (a short quote) if it fits.
  5) a strong call-to-action buttons block (Book/Order/Contact).
  6) contact: buttons (call/email/maps) + a social block.
  Separate major sections with a divider or spacer for rhythm.
- VISUAL IDENTITY: weave the brand colors throughout. Set "accent": true on ~2-3 important sections (e.g. Services and the CTA) so they get a branded tinted card. Choose brand.background as a soft near-white tint of the brand, and brand.text as a dark readable color.
- Write ALL human-readable copy in the requested language, fluently and natively (not translated-sounding). Be specific to THIS business — invent plausible, concrete services/benefits from the description rather than generic filler.
- Map contact details into blocks:
  * phone  -> a "buttons" item with url "tel:<number>" OR a "social" item platform "phone".
  * email  -> url "mailto:<email>" OR a "social" item platform "email".
  * address -> a "buttons" item labeled with the place, url "https://www.google.com/maps/search/?api=1&query=<url-encoded address>".
  * instagram/whatsapp/website/etc. -> a "social" block with the right platform + full URL.
- whatsapp links: "https://wa.me/<digits>". website: full "https://" URL.
- Do NOT invent image URLs or logos. You MAY invent realistic service/feature CARDS (title + description) and benefit copy derived from the business description — these carry no images so they are safe. For feature-card links with no real URL, use "#".
- Only use real links derivable from the provided contact info; otherwise "#".
- Aim for 6-10 blocks. Always include: an about/intro paragraph, at least one feature-card grid (when applicable), a clear CTA, and a contact + social section.
- Output strictly valid JSON. No trailing commas. No markdown fences.`;

export function buildPrompt(input: PromptInput): string {
  const lang = input.language || "en";
  const contactLines = input.contact
    ? Object.entries(input.contact)
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "";

  const fixedName = input.businessName?.trim();
  const brandLine =
    input.brandPrimary || input.brandSecondary
      ? `BRAND COLORS (use EXACTLY these — do not invent others): primary=${input.brandPrimary ?? "(none)"}, secondary=${input.brandSecondary ?? "(none)"}. Set brand.primary/brand.secondary to these, and choose a soft, readable brand.background + brand.text that complement them.`
      : "BRAND COLORS: infer a tasteful palette from the logo/cover images.";

  return [
    "You are a senior web designer and brand copywriter. Design a complete, polished one-page website for the business below: pick a layout style, apply the brand colors, write professional copy, and order the content blocks well.",
    "",
    `Target language for all copy: ${lang}`,
    "",
    fixedName
      ? `BUSINESS NAME (use this exactly as businessName): ${fixedName}`
      : "BUSINESS NAME: infer a concise name from the description.",
    "",
    "BUSINESS DESCRIPTION:",
    input.description.trim(),
    "",
    brandLine,
    "",
    contactLines ? `CONTACT INFO:\n${contactLines}` : "CONTACT INFO: (none provided)",
    "",
    STYLE_GUIDE,
    "",
    SCHEMA_GUIDE,
    "",
    RULES,
  ].join("\n");
}
