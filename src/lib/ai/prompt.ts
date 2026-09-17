/**
 * Prompt builder for the AI website generator. Produces a single instruction
 * string describing the task + the exact intermediate JSON schema the model must
 * emit (see src/lib/ai/schema.ts). The logo + cover images are attached as
 * separate parts by the route, so the model can infer brand colors/mood.
 *
 * 2026-09-17: adds the SIGNATURE SECTIONS guide ("embed" blocks — animated
 * HTML+CSS sections the model writes itself, sanitised by embed-html.ts) and
 * exposes gallery / reviews / products layout choices.
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

const EMBED_GUIDE = `SIGNATURE SECTIONS ("embed" blocks) — hand-written animated HTML + CSS:
An "embed" block is a small, self-contained, ANIMATED micro-section you write yourself in raw HTML + CSS.
The site renders it inline between the standard blocks. Its job is to give the page a designed, memorable
"wow" moment that no stock block can — it must feel made for THIS brand (its colors, mood, industry), never
like a generic widget. Include 2-3 embed blocks per site, each with a DIFFERENT purpose. Patterns:
- "banner"  (place it as the FIRST block, right under the hero): a slow-moving gradient / mesh background in
  the brand colors with 2-3 floating soft orbs or shapes, one bold on-brand promise line, and a small
  animated pill/badge (e.g. "Since 2012", "Open today", "Certified"). Subtle, premium, not loud.
- "stats"   : 3-4 key numbers (years, happy clients, rating, projects, dishes...) in a row; each number
  rises and fades in with a stagger and gets a thin animated underline or ring. Numbers may be plausible
  estimates ("10+", "2k+", "4.9★").
- "ticker"  : an infinite horizontal marquee of services / values / menu items / keywords separated by a
  dot or a tiny inline SVG, in brand colors (great for cafes, salons, agencies, shops).
- "steps"   : 3-4 "how it works" steps with a progress line that draws itself and staggered rising cards.
- "cards"   : 2-3 highlight cards with a shimmering light sweep across the border and a gentle hover lift.
- "ribbon"  : a pulsing glow around a strong call-to-action phrase or offer (text only, no real link needed).
Pick what fits: a ticker for a cafe menu, steps for an agency/clinic, stats for a contractor, a ribbon for a
seasonal offer... Tune the MOTION to the mood: calm and slow (6-12s loops, 600-900ms reveals) for luxury /
wellness / editorial; quicker and bolder for fitness / tech / events. Everything must still look great at rest.
Technical rules (mandatory — the server DROPS any embed that breaks them):
- "html" is ONE self-contained snippet: exactly one <style>...</style> followed by the markup. No <html>,
  <head> or <body>, no <script>, no <link>, no <iframe>, no <img> with external URLs, no external fonts,
  no @import. Icons only as small inline <svg> or unicode symbols. Everything is CSS-only.
- Animation with @keyframes + animation/transition only. The first frame must not be empty — use
  "animation-fill-mode: both" and start from opacity 0.001 or a visible state, never leave content invisible.
- Prefix EVERY class name and EVERY @keyframes name with the block's own prefix "qsN-" where N is the
  embed's number on this page (first embed: qs1-, second: qs2-, third: qs3-). Never style bare tags or
  globals (no "div{}", "h2{}", "*{}", "body{}", ":root{}"); put CSS variables on the root element's class.
- Fluid, mobile-first layout: the root element is "width:100%"; use max-width:100%, rem/em/%/clamp(),
  flex/grid with wrap; no fixed pixel widths above 320px; no horizontal overflow; no position:fixed.
  The section renders in a column of roughly 320-900px; height is whatever the content needs
  (typically 120-360px). Use border-radius (1-1.5rem) so it sits well with the rounded cards around it.
- Typography: on the root element set
  font-family: '<the same font you chose in "font", written as its family name, e.g. Poppins>', system-ui,
  -apple-system, 'Segoe UI', sans-serif.
- Colors: use the brand hex colors (brand.primary / secondary / background / text) so the section reads as
  part of the same site. Dark, gradient or light surfaces are all fine as long as text contrast stays high.
- Motion accessibility: include "@media (prefers-reduced-motion: reduce) { ... }" that swaps movement for
  a gentle opacity fade-in (do NOT simply remove all animation — the section must still feel alive).
- RTL: when the target language is right-to-left (Arabic, Kurdish, Persian, Urdu, Hebrew) the server sets
  dir="rtl" on the wrapper — keep layouts symmetric and use logical properties (margin-inline, text-align:
  start) so they mirror correctly.
- Keep each embed under ~5000 characters. Inside the HTML use SINGLE quotes for attributes so the JSON
  string stays valid; escape nothing else.
- All visible text is real, specific, on-brand copy in the target language.`;

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
      "items": [ { "platform": "instagram|facebook|whatsapp|tiktok|youtube|twitter|snapchat|linkedin|pinterest|website|phone|email|location|custom", "link": string } ] },
    // external_links doubles as IMAGE-BACKED FEATURE / SERVICE CARDS: each item is a card with a
    // title + description, and an OPTIONAL "image" ImageSpec. Use layout "largeGrid" or "promo"
    // (which show images well) when you give the items images; "grid"/"list" for plain text cards.
    { "kind": "external_links", "title": string, "layout": "list|grid|largeGrid|swiper|promo",
      "accent": boolean,
      "items": [ { "title": string, "url": string, "description": string,
                   "image": { "prompt": string, "alt": string } } ] },  // "image" optional
    // gallery: a strip/grid of photos for visually-driven businesses (cafes, salons, studios, hotels...).
    // layout: "grid" (tiles) | "carousel" (one wide photo at a time) | "cards" (tall cards) | "swiper" (horizontal strip).
    { "kind": "gallery", "title": string, "layout": "grid|carousel|cards|swiper",
      "images": [ { "prompt": string, "alt": string } ] },              // 2-6 ImageSpecs
    // reviews / testimonials: social proof. 3-5 short, believable quotes (AT LEAST 3).
    // layout: "cards" (grid of quote cards, default) | "testimonial" (one big spotlight quote at a time) | "list".
    { "kind": "reviews", "title": string, "layout": "cards|testimonial|list",
      "items": [ { "author": string, "role": string, "rating": number, "text": string } ] }, // rating 1-5
    // location: an address + map. The server resolves the map from "address" — you only write the address.
    { "kind": "location", "title": string, "address": string },
    // products: a catalog of items with optional price + per-item image.
    // layout: "grid" (default image cards) | "grid2" (compact two-column) | "shop" (storefront cards with prominent
    // price — menus, e-commerce) | "promo" (large promo tiles) | "banner" (wide rows) | "swiper" (horizontal slider).
    { "kind": "products", "title": string, "layout": "grid|grid2|shop|promo|banner|swiper",
      "items": [ { "name": string, "price": string, "description": string,
                   "image": { "prompt": string, "alt": string } } ] },  // "image" optional
    // form: a contact form. OMIT "fields" for a standard Name/Email/Phone/Message form.
    { "kind": "form", "title": string,
      "fields": [ { "label": string, "type": "text|paragraph|choices|rating", "required": boolean } ] }, // "fields" optional
    // embed: a SIGNATURE SECTION — hand-written animated HTML+CSS (see the SIGNATURE SECTIONS guide).
    { "kind": "embed", "purpose": "banner|stats|ticker|steps|cards|ribbon|other", "html": string },
    { "kind": "divider" },
    { "kind": "spacer", "space": number }
  ]
}`;

const RULES = `Rules:
- Write like a senior brand copywriter: confident, specific, benefit-driven. NO placeholder/lorem text, no generic "Welcome to our website". Every line should sell the business.
- COPY DEPTH — write SUBSTANTIAL text, not one-liners. Every "paragraph" block is 2-4 full sentences (~45-85 words) of concrete, specific content. About / Mission / Vision / Why-choose-us each get their own rich paragraph. Feature-card and product "description" fields are a complete sentence (not 3-4 words). Fill the page like a real, content-rich professional landing page — several paragraphs of real substance across the site.
- Headline (hero.title): short and punchy (max ~8 words). Tagline: one concrete value proposition. Avoid clichés.
- Pick the "style" that best fits the industry and mood of the images/description, and a "font" from the allowlist whose personality matches that industry/mood.
- Build a PROFESSIONAL, MODERN landing page — aim for 10-16 blocks in a strong, intentional order:
  0) SIGNATURE BANNER: an "embed" block with purpose "banner" as the VERY FIRST block (right under the
     hero) — the animated brand moment (see SIGNATURE SECTIONS).
  1) ABOUT: header (e.g. "About") + paragraph — who they are / their value prop.
  2) SERVICES as IMAGE-BACKED FEATURE CARDS: header "Services"/"What we offer" + an external_links block
     with layout "largeGrid" or "promo", 3-6 cards, each with a title + 1-line description AND an "image"
     ImageSpec. This is the visual centerpiece — always include it for businesses with services/products.
  3) SECOND SIGNATURE SECTION: an "embed" block with purpose "stats", "ticker" or "steps" (whichever fits
     the business best) between the services and the social proof.
  4) GALLERY (for visual businesses — food, beauty, interiors, travel, fashion, fitness): a "gallery" block
     of 2-6 photos that showcase the work/space/products.
  5) TESTIMONIALS: a "reviews" block with AT LEAST 3 (3-5) short, believable quotes (author, optional role, rating).
  6) WHY CHOOSE US: a header + a rich paragraph (or a benefits feature-card grid) on what sets them apart.
  7) CTA: an optional third "embed" (purpose "ribbon" or "cards") right before a strong call-to-action
     "buttons" block (Book/Order/Contact/Get a quote).
  8) CONTACT: ALWAYS include a "form" block (a contact form — omit "fields" for the standard
     Name/Email/Phone/Message) + a "buttons" block (call/email) + a "location" block (ONLY when an address is
     given, renders a map) + a "social" block.
  Separate major sections with a divider or spacer for rhythm. Use "products" instead of (or alongside)
  feature cards for shops/menus with priced items, and pick the layout that fits ("shop" for priced menus /
  catalogs, "promo" or "banner" for a few hero offers).
- SIGNATURE SECTIONS: 2-3 "embed" blocks per site, each a different purpose, following EVERY technical
  rule in the SIGNATURE SECTIONS guide (self-contained <style> + markup, "qsN-" prefixes, CSS-only
  animation, fluid width, brand colors + chosen font, reduced-motion fade). They are part of the design —
  write them with the same care as the copy.
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
    EMBED_GUIDE,
    "",
    SCHEMA_GUIDE,
    "",
    RULES,
  ].join("\n");
}
