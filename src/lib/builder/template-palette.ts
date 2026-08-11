/**
 * TemplatePalette — 9 color roles derived from a single user-picked brand
 * color. Exact port of mobile `template_palette.dart` (origin/dev).
 *
 * Templates never receive the raw brand color directly — they receive a
 * palette whose text roles are guaranteed readable (WCAG contrast >= 4.5)
 * against their paired fills. All roles are BAKED into the website document
 * as literal ARGB32 ints at apply time.
 *
 * The derivation runs in Flutter's float color domain (see flutter-color.ts)
 * and converts to ARGB32 ints only at the end, so every int matches what the
 * mobile app would serialize bit-for-bit.
 *
 * ⚠ DORMANT MODULE — no app code imports it (only the parity script does).
 * Templates v2 stopped deriving colors from a brand pick, and the contract
 * change that removed `settings.template.brand_color` removed the last place a
 * user pick was persisted. It is KEPT, not deleted, because mobile
 * deliberately keeps `template_palette.dart` for the phase-2 brand-color
 * selector: this is a hand-verified bit-exact port whose golden vectors the
 * parity script still enforces, so keeping it costs one dead module and
 * deleting it would cost that verification when phase 2 lands. Nothing here
 * may drift from the Dart in the meantime.
 */

import {
  type FColor,
  alphaBlendOverOpaque,
  computeLuminance,
  fcolorFromArgb,
  hslFromColor,
  hslToColor,
  toARGB32,
  withLightness,
  withValuesAlpha,
} from "./flutter-color";

/** Mobile `TemplatePalette._darkText` = `Color(0xFF1A1A1A)`. */
export const DARK_TEXT = 0xff1a1a1a;

const WHITE_F: FColor = { a: 1, r: 1, g: 1, b: 1 };
const DARK_TEXT_F = fcolorFromArgb(DARK_TEXT);

/** All values are ARGB32 ints (unsigned, 0..2^32-1). */
export interface TemplatePalette {
  /** The color exactly as the user picked it (stored in TemplateRef). */
  brand: number;
  /** Main fill for primary buttons and strong accents. */
  primary: number;
  /** Text/icon color on top of `primary`. */
  onPrimary: number;
  /** Tinted fill for secondary buttons and soft highlights. */
  primarySoft: number;
  /** Text color on `primarySoft`; also used for outline-button text. */
  onPrimarySoft: number;
  /** Page background — a faint tint of the brand over white. */
  surface: number;
  /** Body text on `surface`. */
  onSurface: number;
  /** Card / sheet background sitting on `surface`. */
  card: number;
  /** Hairlines and borders. */
  outline: number;
}

function contrastRatioF(a: FColor, b: FColor): number {
  const la = computeLuminance(a);
  const lb = computeLuminance(b);
  const hi = la > lb ? la : lb;
  const lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG contrast ratio between two ARGB32 colors (1..21). */
export function contrastRatio(a: number, b: number): number {
  return contrastRatioF(fcolorFromArgb(a), fcolorFromArgb(b));
}

function onColorForF(background: FColor): FColor {
  return contrastRatioF(background, WHITE_F) >= contrastRatioF(background, DARK_TEXT_F)
    ? WHITE_F
    : DARK_TEXT_F;
}

/**
 * White or near-black (0xFF1A1A1A), whichever reads better on `background`.
 * Picking the higher of the two always yields a ratio >= 4.5.
 */
export function onColorFor(background: number): number {
  return toARGB32(onColorForF(fcolorFromArgb(background)));
}

/**
 * Darkens `color` until it reads on `over` (brand-colored text on soft/tinted
 * fills); falls back to near-black for extreme brands. Mirrors mobile
 * `_readableVariant`: each candidate is the QUANTIZED `hsl.toColor()`, while
 * the darkening continues from the float lightness; step 0.06, 12 iterations,
 * threshold >= 4.5.
 */
function readableVariant(color: FColor, over: FColor): FColor {
  let hsl = hslFromColor(color);
  for (let i = 0; i < 12; i++) {
    const candidate = hslToColor(hsl);
    if (contrastRatioF(candidate, over) >= 4.5) return candidate;
    hsl = withLightness(hsl, Math.min(Math.max(hsl.lightness - 0.06, 0), 1));
  }
  return DARK_TEXT_F;
}

/** Exact port of `TemplatePalette.fromBrand(Color brand)`. */
export function paletteFromBrand(brandArgb: number): TemplatePalette {
  const brand = brandArgb >>> 0;

  // A brand too pale to work as a button fill gets darkened; the raw pick is
  // kept in `brand` so re-stamping starts from what the user chose.
  let primary = fcolorFromArgb(brand);
  const hsl = hslFromColor(primary);
  if (hsl.lightness > 0.85) {
    primary = hslToColor(withLightness(hsl, 0.55));
  }

  const surface = alphaBlendOverOpaque(withValuesAlpha(primary, 0.06), WHITE_F);
  const primarySoft = alphaBlendOverOpaque(withValuesAlpha(primary, 0.14), WHITE_F);
  const outline = alphaBlendOverOpaque(withValuesAlpha(primary, 0.25), WHITE_F);

  return {
    brand,
    primary: toARGB32(primary),
    onPrimary: toARGB32(onColorForF(primary)),
    primarySoft: toARGB32(primarySoft),
    onPrimarySoft: toARGB32(readableVariant(primary, primarySoft)),
    surface: toARGB32(surface),
    onSurface: DARK_TEXT,
    card: 0xffffffff,
    outline: toARGB32(outline),
  };
}
