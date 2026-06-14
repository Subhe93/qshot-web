/**
 * ARGB integer (0xAARRGGBB) helpers, mirroring the Nuxt renderer's
 * numberToHexText so the builder, preview, and renderer agree on colors.
 */

export function argbToCss(n?: number | null): string | undefined {
  if (n == null) return undefined;
  const a = (n >>> 24) & 0xff;
  const r = (n >>> 16) & 0xff;
  const g = (n >>> 8) & 0xff;
  const b = n & 0xff;
  const alpha = a / 255;
  if (alpha > 0 && alpha < 1) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  return `rgb(${r}, ${g}, ${b})`;
}

export function argbToHex(n?: number | null): string {
  if (n == null) return "#000000";
  const r = ((n >>> 16) & 0xff).toString(16).padStart(2, "0");
  const g = ((n >>> 8) & 0xff).toString(16).padStart(2, "0");
  const b = (n & 0xff).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export function hexToArgb(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

// ---- HSV/alpha helpers (color picker) ----
// h: 0..360, s/v: 0..100, a: 0..1 — mirrors the mobile DefaultColorPicker.

export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): Omit<Hsva, "a"> {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s: s * 100, v: max * 100 };
}

export function argbToHsva(n?: number | null): Hsva {
  if (n == null) return { h: 0, s: 0, v: 0, a: 1 };
  const a = ((n >>> 24) & 0xff) / 255;
  const r = (n >>> 16) & 0xff;
  const g = (n >>> 8) & 0xff;
  const b = n & 0xff;
  return { ...rgbToHsv(r, g, b), a };
}

export function hsvaToArgb({ h, s, v, a }: Hsva): number {
  const { r, g, b } = hsvToRgb(h, s, v);
  const alpha = Math.round(a * 255);
  return ((alpha << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

/** rgb()/rgba() css string for an Hsva value. */
export function hsvaToCss({ h, s, v, a }: Hsva): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
}

/** #rrggbb, or #rrggbbaa when alpha < 1. Accepts ARGB int. */
export function argbToHexA(n?: number | null): string {
  if (n == null) return "#000000";
  const a = (n >>> 24) & 0xff;
  const r = ((n >>> 16) & 0xff).toString(16).padStart(2, "0");
  const g = ((n >>> 8) & 0xff).toString(16).padStart(2, "0");
  const b = (n & 0xff).toString(16).padStart(2, "0");
  const base = `#${r}${g}${b}`;
  return a === 0xff ? base : `${base}${a.toString(16).padStart(2, "0")}`;
}

/** Parse #rgb / #rrggbb / #rrggbbaa into an ARGB int, or null if invalid. */
export function hexToArgbA(hex: string): number | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 0xff;
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}
