/**
 * Flutter-exact color math, ported from the Flutter engine (`dart:ui` Color /
 * `painting/colors.dart` HSLColor). Used by the template palette so every
 * derived color the web builder BAKES into the document is bit-identical to
 * what the mobile app would bake.
 *
 * Key semantics reproduced:
 *  - Flutter `Color` stores channels as FLOATS (`a,r,g,b` in 0..1 = byte/255).
 *    All math stays in the float domain; conversion to an ARGB32 int happens
 *    only at the very end via `toARGB32()` = per-channel `(c*255).round()`
 *    (Dart round = half away from zero; channels are positive so JS
 *    `Math.round` is equivalent).
 *  - `computeLuminance()` uses the WCAG linearization with the 0.03928
 *    threshold.
 *  - `HSLColor.fromColor` clamps a NaN saturation to 1.0 (Dart `clampDouble`
 *    returns `max` for NaN) and uses Dart's non-negative `%` for the hue.
 *  - `HSLColor.toColor()` QUANTIZES to 8-bit ints (`Color.fromARGB`), so the
 *    returned float color is `int/255` — this matters inside the palette's
 *    readable-variant loop, which contrast-checks the quantized color.
 *
 * Do NOT reuse the non-linear `isBright()` heuristic from WebsiteStylePanel
 * for anything palette-related — it is not WCAG luminance.
 */

/** A Flutter `Color`: float channels in 0..1 (byte/255 for 8-bit sources). */
export interface FColor {
  a: number;
  r: number;
  g: number;
  b: number;
}

/** A Flutter `HSLColor`: alpha 0..1, hue 0..360, saturation/lightness 0..1. */
export interface Hsl {
  alpha: number;
  hue: number;
  saturation: number;
  lightness: number;
}

/** Dart `_floatToInt8`: `(x * 255.0).round() & 0xff`. */
function floatToInt8(x: number): number {
  return Math.round(x * 255) & 0xff;
}

/** Dart `clampDouble` (engine version): NaN clamps to `max`. */
function clampDouble(x: number, min: number, max: number): number {
  if (x < min) return min;
  if (x > max) return max;
  if (Number.isNaN(x)) return max;
  return x;
}

/**
 * Dart `%` on doubles (VM DoubleMod): C fmod, then `+ |b|` ONLY when the
 * remainder is negative; -0.0 normalizes to +0.0. JS `%` is exactly C fmod,
 * so for a >= 0 the result is bit-identical to Dart with NO extra float ops.
 * (The usual JS idiom `((a % b) + b) % b` is NOT bit-exact for positive `a` —
 * the two extra roundings perturb the hue by ulps, which flips half-integer
 * channels, e.g. brand 0xFFEFE3CB: primary 0xFFC9A14F on mobile.)
 */
function dartMod(a: number, b: number): number {
  const r = a % b;
  if (r === 0) return 0;
  return r < 0 ? r + Math.abs(b) : r;
}

/** Flutter `Color(argb)` — float channels = byte/255. */
export function fcolorFromArgb(argb: number): FColor {
  const n = argb >>> 0;
  return {
    a: ((n >>> 24) & 0xff) / 255,
    r: ((n >>> 16) & 0xff) / 255,
    g: ((n >>> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

/** Flutter `Color.toARGB32()` — round each float channel to 8 bits and pack. */
export function toARGB32(c: FColor): number {
  return (
    ((floatToInt8(c.a) << 24) |
      (floatToInt8(c.r) << 16) |
      (floatToInt8(c.g) << 8) |
      floatToInt8(c.b)) >>>
    0
  );
}

/** Flutter `color.withValues(alpha: x)` — replaces only the alpha float. */
export function withValuesAlpha(c: FColor, alpha: number): FColor {
  return { ...c, a: alpha };
}

/**
 * ARGB-int convenience for `withValues(alpha: x).toARGB32()`: keeps the RGB
 * bytes and stamps `round(alpha*255)` as the alpha byte (e.g. 0.14 → 0x24,
 * 0.3 → 0x4D) — used by the soft/minimal button themes.
 */
export function withAlphaFloat(argb: number, alpha: number): number {
  return (((floatToInt8(alpha) << 24) | (argb & 0x00ffffff)) >>> 0);
}

/**
 * Flutter `Color.alphaBlend(fg, bg)` for an OPAQUE background:
 * per channel `out = fg.a*fg.c + (1-fg.a)*bg.c`, result opaque, floats kept.
 */
export function alphaBlendOverOpaque(fg: FColor, bg: FColor): FColor {
  const alpha = fg.a;
  if (alpha === 0) return bg;
  const inv = 1 - alpha;
  return {
    a: 1,
    r: alpha * fg.r + inv * bg.r,
    g: alpha * fg.g + inv * bg.g,
    b: alpha * fg.b + inv * bg.b,
  };
}

/** Dart `Color._linearizeColorComponent` (WCAG). */
function linearize(component: number): number {
  if (component <= 0.03928) return component / 12.92;
  return Math.pow((component + 0.055) / 1.055, 2.4);
}

/** Flutter `Color.computeLuminance()` — WCAG relative luminance (0..1). */
export function computeLuminance(c: FColor): number {
  return 0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b);
}

/** Flutter `HSLColor._getHue`. */
function getHue(
  red: number,
  green: number,
  blue: number,
  max: number,
  delta: number,
): number {
  let hue: number;
  if (max === 0 || delta === 0) {
    hue = 0;
  } else if (max === red) {
    hue = 60 * dartMod((green - blue) / delta, 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    // max === blue
    hue = 60 * ((red - green) / delta + 4);
  }
  return Number.isNaN(hue) ? 0 : hue;
}

/** Flutter `HSLColor.fromColor`. */
export function hslFromColor(c: FColor): Hsl {
  const max = Math.max(c.r, Math.max(c.g, c.b));
  const min = Math.min(c.r, Math.min(c.g, c.b));
  const delta = max - min;
  const hue = getHue(c.r, c.g, c.b, max, delta);
  const lightness = (max + min) / 2;
  // Saturation can exceed 1.0 with rounding errors, so clamp it (NaN → 1.0,
  // matching Dart clampDouble).
  const saturation =
    lightness === 1 ? 0 : clampDouble(delta / (1 - Math.abs(2 * lightness - 1)), 0, 1);
  return { alpha: c.a, hue, saturation, lightness };
}

/**
 * Flutter `HSLColor.toColor()` — note the engine QUANTIZES each channel to an
 * 8-bit int here (`Color.fromARGB`), so the returned float color is `int/255`.
 */
export function hslToColor(hsl: Hsl): FColor {
  const chroma = (1 - Math.abs(2 * hsl.lightness - 1)) * hsl.saturation;
  const secondary = chroma * (1 - Math.abs(dartMod(hsl.hue / 60, 2) - 1));
  const match = hsl.lightness - chroma / 2;

  let red: number;
  let green: number;
  let blue: number;
  const hue = hsl.hue;
  if (hue < 60) {
    red = chroma; green = secondary; blue = 0;
  } else if (hue < 120) {
    red = secondary; green = chroma; blue = 0;
  } else if (hue < 180) {
    red = 0; green = chroma; blue = secondary;
  } else if (hue < 240) {
    red = 0; green = secondary; blue = chroma;
  } else if (hue < 300) {
    red = secondary; green = 0; blue = chroma;
  } else {
    red = chroma; green = 0; blue = secondary;
  }
  // Color.fromARGB(int, int, int, int) → floats are int/255.
  return {
    a: Math.round(hsl.alpha * 0xff) / 255,
    r: floatToInt8(red + match) / 255,
    g: floatToInt8(green + match) / 255,
    b: floatToInt8(blue + match) / 255,
  };
}

/** Flutter `HSLColor.withLightness`. */
export function withLightness(hsl: Hsl, lightness: number): Hsl {
  return { ...hsl, lightness };
}
