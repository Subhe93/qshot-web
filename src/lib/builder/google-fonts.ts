/**
 * Web font support for the Style page. The mobile app exposes every Google Font
 * (GoogleFonts.asMap()); on the web we offer a curated, popular subset (incl.
 * Arabic faces) and load the chosen face on demand from Google Fonts. The chosen
 * name is stored in `settings.font_family` exactly like the mobile.
 */

export const DEFAULT_FONT = "Roboto";

export const GOOGLE_FONTS: string[] = [
  "Roboto",
  "Inter",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Work Sans",
  "Rubik",
  "Mulish",
  "DM Sans",
  "Manrope",
  "Karla",
  "Heebo",
  "Barlow",
  "Archivo",
  "Space Grotesk",
  "Figtree",
  "Sora",
  "Outfit",
  "Quicksand",
  "Josefin Sans",
  "Comfortaa",
  "Oswald",
  "Bebas Neue",
  "Source Sans 3",
  "Playfair Display",
  "Merriweather",
  "Libre Baskerville",
  "Lora",
  "PT Serif",
  "Pacifico",
  "Lobster",
  "Dancing Script",
  "Caveat",
  // Arabic-capable
  "Cairo",
  "Tajawal",
  "Almarai",
  "Amiri",
  "IBM Plex Sans Arabic",
];

/** A CSS font-family stack for a chosen Google font name. */
export function fontStack(name?: string | null): string | undefined {
  if (!name) return undefined;
  return `"${name}", system-ui, sans-serif`;
}

function familyParam(name: string): string {
  return name.trim().replace(/\s+/g, "+");
}

const loaded = new Set<string>();

/** Inject a Google Fonts stylesheet for the given families (once each). No-op on server. */
export function ensureGoogleFonts(names: string[]): void {
  if (typeof document === "undefined") return;
  const fresh = names.filter((n) => n && !loaded.has(n));
  if (!fresh.length) return;
  fresh.forEach((n) => loaded.add(n));
  // Match the Nuxt public site EXACTLY (pages/[slug].vue loads only :wght@100;200;
  // 300;400). Loading the same weights makes the builder preview render headings/
  // bold text the same way the live site does (faux-bold over 400) instead of with
  // true heavy faces, and makes thin weights (e.g. style3's 100) available.
  const families = fresh
    .map((n) => `family=${familyParam(n)}:wght@100;200;300;400`)
    .join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}
