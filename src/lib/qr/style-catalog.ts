/**
 * QR style option catalogs, mirroring the mobile enums (QRShape, QRDots,
 * QRCornerBorder, QRCornerCenter, QRShapeAdvanced, QRLogo). Asset thumbnails
 * are copied from the app into /public/qr/*.
 */

import { cdnUrl } from "@/lib/api/qrcodes";

// Body patterns (module) — assets/svg/qr/dots
export const DOT_PATTERNS = [
  "square",
  "dots",
  "diamond",
  "fish",
  "fourTriangles",
  "horizontal-lines",
  "rhombus",
  "roundness",
  "star-5",
  "star-7",
  "tree",
  "triangle",
  "triangle-end",
  "vertical-lines",
] as const;

// Corner border (finder) — assets/svg/qr/corner_border
export const CORNER_BORDERS = [
  "default",
  "circle",
  "circle-dots",
  "eye-shaped",
  "octagon",
  "rounded-corners",
  "water-drop",
  "whirlpool",
  "zigzag",
] as const;

// Corner center (finderDot) — assets/svg/qr/corner_center
export const CORNER_CENTERS = [
  "default",
  "circle",
  "eye-shaped",
  "octagon",
  "rounded-corners",
  "water-drop",
  "whirlpool",
  "zigzag",
] as const;

// Decorative shapes (shape) — assets/image/qr/shape/shape-*.png
export const SHAPES = [
  "none",
  "apple",
  "bag",
  "bakery",
  "barn",
  "book",
  "boot",
  "builder",
  "bulb",
  "burger",
  "car",
  "circle",
  "cloud",
  "cooking",
  "cup",
  "dentist",
  "electrician",
  "food",
  "furniture",
  "gardening",
  "gift",
  "golf",
  "gym",
  "home",
  "home-mover",
  "ice-cream",
  "juice",
  "legal",
  "locksmith",
  "message",
  "mobile",
  "painter",
  "pest",
  "pet",
  "pizza",
  "plumber",
  "realtor",
  "restaurant",
  "salon",
  "search",
  "shawarma",
  "shield",
  "shopping-cart",
  "star",
  "sun",
  "sun-rise",
  "t-shirt",
  "teddy",
  "travel",
  "tree-cutting",
  "trophy",
  "truck",
  "umbrella",
  "van",
  "vet",
  "watch",
  "water",
  "water-glass",
] as const;

// Frames (advancedShape) — assets/image/qr/shape_advanced
export const FRAMES = [
  "none",
  "coupon",
  "four-corners-text-bottom",
  "four-corners-text-top",
  "healthcare",
  "pincode-protected",
  "rect-frame-text-bottom",
  "rect-frame-text-top",
  "review-collector",
  "simple-text-bottom",
  "simple-text-top",
] as const;

/**
 * Per-frame customization, derived from the actual preview templates: each
 * frame exposes a different number of editable text lines (the empty
 * `<image ..._text_placeholder>` slots). Frame color is intentionally omitted —
 * the server bakes frame colors into the templates and ignores `frameColor`.
 *   - none / pincode-protected / review-collector → no editable text
 *   - coupon → 3 text lines
 *   - the rest → 1 text line
 */
const FRAME_TEXT_LINES: Record<string, number> = {
  none: 0,
  "pincode-protected": 0,
  "review-collector": 0,
  coupon: 3,
  "four-corners-text-bottom": 1,
  "four-corners-text-top": 1,
  healthcare: 1,
  "rect-frame-text-bottom": 1,
  "rect-frame-text-top": 1,
  "simple-text-bottom": 1,
  "simple-text-top": 1,
};

export const frameTextLines = (name: string) => FRAME_TEXT_LINES[name] ?? 0;

// Built-in logos (logoUrl) — thumbnails in /qr/logo, value points to the CDN.
export const LOGOS = [
  "address-book",
  "badoo",
  "dribbble",
  "dropbox",
  "facebook",
  "google-calendar",
  "google-forms",
  "google-maps",
  "google-meet",
  "google-sheets",
  "google-slides",
  "instagram",
  "linkedin",
  "paypal",
  "pinterest",
  "skype",
  "snapchat",
  "soundcloud",
  "spotify",
  "swarm",
  "telegram",
  "twitter",
  "viber",
  "vimeo",
  "vine",
  "whatsapp",
  "youtube",
  "zoom-meeting",
] as const;

export const dotSrc = (n: string) => `/qr/dots/${n}.svg`;
export const borderSrc = (n: string) => `/qr/corner_border/${n}.svg`;
export const centerSrc = (n: string) => `/qr/corner_center/${n}.svg`;
export const shapeSrc = (n: string) => `/qr/shape/shape-${n}.png`;
export const frameSrc = (n: string) => `/qr/frame/${n}.png`;
export const logoThumbSrc = (n: string) => `/qr/logo/${n}.png`;
/** The value stored in customizes.logoUrl for a built-in logo (the CDN copy). */
export const logoValue = (n: string) => cdnUrl(`png-logos/${n}.png`);
