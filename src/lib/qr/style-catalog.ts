import { cdnUrl } from "@/lib/api/qrcodes";

/**
 * The built-in QR logo library — the ONE survivor of the legacy style
 * catalog. Everything else (dot patterns, corner borders/centers, silhouette
 * shapes, frame templates, frame-text line counts) belonged to the retired
 * pre-v1 platform and was deleted with it; the artisan editor draws its
 * vocabulary from `src/lib/qr/artisan-style.ts` and the platform-rendered
 * thumbnails under `public/qr-v1/`.
 *
 * `logoValue()` is the CDN URL written into `overlay.imageUrl` — the platform
 * fetches it server-side while rendering.
 */
export const LOGOS = [
  "address-book",
  "behance",
  "dribbble",
  "dropbox",
  "facebook",
  "google-calendar",
  "google-docs",
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
  "zoom",
] as const;

export type QrLogoName = (typeof LOGOS)[number];

/** Local thumbnail for the picker grid. */
export function logoThumbSrc(name: string): string {
  return `/qr/logo/${name}.png`;
}

/** The CDN URL stored in `overlay.imageUrl`. */
export function logoValue(name: string): string {
  return cdnUrl(`png-logos/${name}.png`);
}
