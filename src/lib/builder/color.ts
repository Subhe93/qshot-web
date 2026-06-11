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
