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

const FONT_GUIDE = `Available "font" choices (pick the ONE whose mood fits the industry):
- inter: neutral, modern, tech/SaaS/startup. Safe default.
- poppins: friendly, rounded, lifestyle/retail/kids.
- manrope: clean, geometric, agencies/portfolios.
- sora: contemporary, techy, fintech/web3/innovation.
- playfair: elegant serif, luxury/beauty/restaurants/editorial.
- montserrat: confident, urban, real estate/fitness/events.
- nunito: soft, warm, healthcare/wellness/cafes.`;

const IMAGE_GUIDE = `IMAGES — how to request them (ImageSpec):
An ImageSpec is { "prompt": string, "alt": string }. You write ONLY these two fields:
- "prompt": a vivid, brand/industry-specific PHOTOGRAPHIC scene the server will generate
  (e.g. "a barista pouring latte art in a sunlit minimalist cafe, warm tones, shallow depth of field").
  Be concrete and on-brand. NEVER put any text, letters, words, numbers, logos, watermarks,
  signage or UI in the image prompt — describe a clean photographic scene only.
- "alt": a short, literal description of the image for accessibility.
You NEVER write image URLs, file paths, base64, or asset ids — the server generates each image
from your prompt, uploads it, and fills the rest in. At most ~4 images total will be used across the
whole site, so spend them where they add the most impact (hero cover, gallery, top service/product cards).`;

const SCHEMA_GUIDE = `Return ONLY a JSON object (no markdown, no commentary) with this shape:
{
  "businessName": string,                       // concise brand name inferred from the description
  "style": "style1".."style7",
  "font": "inter|poppins|manrope|sora|playfair|montserrat|nunito",  // pick one that fits the mood
  "brand": {                                    // colors as #rrggbb hex, inferred from the logo/cover
    "primary": "#rrggbb",                       // main accent (primary button)
    "secondary": "#rrggbb",                     // secondary accent
    "background": "#rrggbb",                    // soft page background
    "text": "#rrggbb"                           // dark, readable body text color (good contrast on background)
  },
  "hero": {
    "title": string,                            // punchy headline (max ~8 words)
    "tagline": string,                          // one supporting sentence
    "name": string,                             // optional display name
    "bio": string,                              // optional short bio
    "primaryButton": { "label": string, "url": string },
    "secondaryButton": { "label": string, "url": string },
    "cover": { "prompt": string, "alt": string } // OPTIONAL ImageSpec — ONLY when no cover is uploaded/implied (see rules)
  },
  "blocks": [                                    // 6-12 ordered, content-rich blocks
    // "accent": true renders the section on a soft brand-tinted card — use it on
    // ~2-3 key sections to create visual rhythm and reinforce the brand identity.
    { "kind": "header", "text": string, "align": "start|center|end", "size": number, "accent": boolean },
    { "kind": "paragraph", "text": string, "accent": boolean },
    { "kind": "buttons", "title": string, "theme": "minimal|solid|soft|outline|pill", "layout": "list|grid",
      "accent": boolean, "items": [ { "label": string, "url": string } ] },
    { "kind": "social", "layout": "grid|list|gridAlignCenter|listAlignCenter",
      "items": [ { "platform": "instagram|facebook|whatsapp|tiktok|youtube|twitter|snapchat|telegram|linkedin|pinterest|website|phone|email|location|custom", "link": string } ] },
    // external_links doubles as IMAGE-BACKED FEATURE / SERVICE CARDS: each item is a card with a
    // title + description, and an OPTIONAL "image" ImageSpec. Use layout "largeGrid" or "promo"
    // (which show images well) when you give the items images; "grid"/"list" for plain text cards.
    { "kind": "external_links", "title": string, "layout": "list|grid|largeGrid|swiper|promo",
      "accent": boolean,
      "items": [ { "title": string, "url": string, "description": string,
                   "image": { "prompt": string, "alt": string } } ] },  // "image" optional
    // gallery: a strip/grid of photos for visually-driven businesses (cafes, salons, studios, hotels...).
    { "kind": "gallery", "title": string, "layout": "grid|carousel",
      "images": [ { "prompt": string, "alt": string } ] },              // 2-6 ImageSpecs
    // reviews / testimonials: social proof. 3-5 short, believable quotes (AT LEAST 3).
    { "kind": "reviews", "title": string,
      "items": [ { "author": string, "role": string, "rating": number, "text": string } ] }, // rating 1-5
    // location: an address + map. The server resolves the map from "address" — you only write the address.
    { "kind": "location", "title": string, "address": string },
    // products: a catalog of items with optional price + per-item image.
    { "kind": "products", "title": string,
      "items": [ { "name": string, "price": string, "description": string,
                   "image": { "prompt": string, "alt": string } } ] },  // "image" optional
    // form: a contact form. OMIT "fields" for a standard Name/Email/Phone/Message form.
    { "kind": "form", "title": string,
      "fields": [ { "label": string, "type": "text|paragraph|choices|rating", "required": boolean } ] }, // "fields" optional
    { "kind": "divider" },
    { "kind": "spacer", "space": number }
  ]
}`;

const RULES = `Rules:
- Write like a senior brand copywriter: confident, specific, benefit-driven. NO placeholder/lorem text, no generic "Welcome to our website". Every line should sell the business.
- COPY DEPTH — write SUBSTANTIAL text, not one-liners. Every "paragraph" block is 2-4 full sentences (~45-85 words) of concrete, specific content. About / Mission / Vision / Why-choose-us each get their own rich paragraph. Feature-card and product "description" fields are a complete sentence (not 3-4 words). Fill the page like a real, content-rich professional landing page — several paragraphs of real substance across the site.
- Headline (hero.title): short and punchy (max ~8 words). Tagline: one concrete value proposition. Avoid clichés.
- Pick the "style" that best fits the industry and mood of the images/description, and a "font" from the allowlist whose personality matches that industry/mood.
- Build a PROFESSIONAL, MODERN landing page — aim for 8-12 blocks in a strong, intentional order:
  1) ABOUT: header (e.g. "About") + paragraph — who they are / their value prop.
  2) SERVICES as IMAGE-BACKED FEATURE CARDS: header "Services"/"What we offer" + an external_links block
     with layout "largeGrid" or "promo", 3-6 cards, each with a title + 1-line description AND an "image"
     ImageSpec. This is the visual centerpiece — always include it for businesses with services/products.
  3) GALLERY (for visual businesses — food, beauty, interiors, travel, fashion, fitness): a "gallery" block
     of 2-6 photos that showcase the work/space/products.
  4) TESTIMONIALS: a "reviews" block with AT LEAST 3 (3-5) short, believable quotes (author, optional role, rating).
  5) WHY CHOOSE US: a header + a rich paragraph (or a benefits feature-card grid) on what sets them apart.
  6) CTA: a strong call-to-action "buttons" block (Book/Order/Contact/Get a quote).
  7) CONTACT: ALWAYS include a "form" block (a contact form — omit "fields" for the standard
     Name/Email/Phone/Message) + a "buttons" block (call/email) + a "location" block (ONLY when an address is
     given, renders a map) + a "social" block.
  Separate major sections with a divider or spacer for rhythm. Use "products" instead of (or alongside)
  feature cards for shops/menus with priced items.
- COMPLETENESS — represent EVERYTHING concrete the description states; do NOT summarize a long list down to a
  few. If it names multiple offerings (e.g. several degree programs, a full menu, a service catalog),
  include them ALL, grouped into logical sections (e.g. a separate "Bachelor's Programs" block AND a
  "Master's Programs" block) — never drop items the user explicitly mentioned. Images are capped (~4-6), so
  put an "image" on only the few most important cards and list the rest as PLAIN TEXT cards (no "image").
- MISSION / VISION — if the description states a mission and/or a vision, give EACH its own section (a header
  like "Our Mission" / "Our Vision" + a paragraph) using the user's own wording, instead of a single generic
  "About" paragraph.
- IMAGES: see the IMAGE GUIDE above. You request images only as ImageSpec { prompt, alt }; the server
  generates and hosts them. NEVER output image URLs, file paths, or asset ids anywhere. Keep every image
  "prompt" photographic and brand/industry specific, with NO text, letters, logos, or signage in the scene.
  Because at most ~4 images are used site-wide, prioritize: hero.cover, the gallery, and the most important
  service/product cards. Plain text cards (no "image") are fine for the rest.
- hero.cover: set this ImageSpec ONLY when NO cover image was uploaded and the description does not already
  imply a hero visual. If a cover/hero image is present or implied, OMIT hero.cover entirely (the server
  uses the uploaded one). Never set hero.cover just to fill space.
- VISUAL IDENTITY: choose a tasteful brand palette with good contrast — brand.primary as the main accent,
  brand.secondary as a complementary accent, brand.background as a soft near-white tint of the brand, and
  brand.text as a dark, highly readable color. Weave the colors throughout and set "accent": true on ~2-3
  important sections (e.g. Services and the CTA) so they get a branded tinted card.
- Write ALL human-readable copy in the requested language, fluently and natively (not translated-sounding).
  This includes review text and image alt text. Be specific to THIS business — invent plausible, concrete
  services/products/benefits/testimonials from the description rather than generic filler.
- Map contact details into blocks:
  * phone  -> a "buttons" item with url "tel:<number>" OR a "social" item platform "phone".
  * email  -> url "mailto:<email>" OR a "social" item platform "email".
  * address -> a "location" block with the address (preferred), and/or a "buttons" item labeled with the
    place, url "https://www.google.com/maps/search/?api=1&query=<url-encoded address>".
  * instagram/whatsapp/website/etc. -> a "social" block with the right platform + full URL.
- whatsapp links: "https://wa.me/<digits>". website: full "https://" URL.
- Do NOT invent logos. You MAY invent realistic service/product cards, reviews, and benefit copy derived
  from the business description. For feature-card / product links with no real URL, use "#".
- Only use real links derivable from the provided contact info; otherwise "#".
- Always include: an about/intro paragraph, at least one image-backed feature-card or products block (when
  applicable), a clear CTA, and a contact + social section.
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
    FONT_GUIDE,
    "",
    IMAGE_GUIDE,
    "",
    SCHEMA_GUIDE,
    "",
    RULES,
  ].join("\n");
}
