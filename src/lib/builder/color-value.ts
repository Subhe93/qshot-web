/**
 * Discriminated color value (solid | gradient), mirroring the mobile ColorEntity
 * and the JSON the public Nuxt renderer consumes for the page background
 * (`settings.background.color_value`):
 *   solid:    { type: "solid", color: <ARGB int> }
 *   gradient: { type: "gradient", gradient: "LinearGradient",
 *               colors: [<ARGB int>...], stops: [0..1...] }
 *
 * Block backgrounds remain plain ARGB ints (they do not support gradients);
 * gradients are only valid for the page background.
 */

import { argbToCss, hexToArgb } from "./color";

export interface SolidColorValue {
  type: "solid";
  /**
   * ARGB int (mobile write path) OR a hex string like "000000" (legacy backend
   * data — correction ❶). Always normalize via `solidArgb()` before using.
   */
  color: number | string;
}

export interface GradientColorValue {
  type: "gradient";
  gradient: "LinearGradient" | "RadialGradient" | "SweepGradient";
  colors: number[];
  stops?: number[] | null;
}

export type ColorValue = SolidColorValue | GradientColorValue;

export function solid(color: number): SolidColorValue {
  return { type: "solid", color };
}

/** Normalize a solid color (ARGB int or "rrggbb"/"#rrggbb" hex string) to ARGB int. */
export function solidArgb(color: number | string): number {
  if (typeof color === "number") return color >>> 0;
  const h = color.trim().replace(/^#/, "");
  // Bare 6-digit hex has no alpha → treat as fully opaque.
  if (/^[0-9a-fA-F]{6}$/.test(h)) return hexToArgb(h);
  if (/^[0-9a-fA-F]{8}$/.test(h)) return parseInt(h, 16) >>> 0;
  return 0xff000000;
}

/** A representative single color for a value (the solid color, or the first stop). */
export function primaryArgb(v: ColorValue): number {
  return v.type === "solid" ? solidArgb(v.color) : (v.colors[0] ?? 0xff000000);
}

/**
 * CSS background string, mirroring the Nuxt renderer's generateBackgroundColor
 * (linear-gradient(90deg, …) with stop positions as percentages).
 */
export function colorValueToCss(v?: ColorValue | null): string | undefined {
  if (!v) return undefined;
  if (v.type === "solid") return argbToCss(solidArgb(v.color));
  if (!v.colors.length) return undefined;
  const n = v.colors.length;
  const stops = v.stops ?? [];
  const parts = v.colors.map((c, i) => {
    const stop = stops[i] != null ? stops[i] * 100 : (i * 100) / Math.max(1, n - 1);
    return `${argbToCss(c)} ${stop}%`;
  });
  const joined = parts.join(", ");
  // Honor the gradient type (mobile LinearGradient default ≈ left→right = 90deg).
  switch (v.gradient) {
    case "RadialGradient":
      return `radial-gradient(circle, ${joined})`;
    case "SweepGradient":
      return `conic-gradient(${joined})`;
    default:
      return `linear-gradient(90deg, ${joined})`;
  }
}

const channel = (n: number, shift: number) => (n >>> shift) & 0xff;

/** Linear interpolation between two ARGB colors at t in [0,1]. */
export function lerpArgb(a: number, b: number, t: number): number {
  const mix = (shift: number) =>
    Math.round(channel(a, shift) + (channel(b, shift) - channel(a, shift)) * t);
  return ((mix(24) << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0)) >>> 0;
}

/** The interpolated color along a list of stops at `target` (0..1). */
export function colorAtStop(
  colors: number[],
  stops: number[],
  target: number,
): number {
  const pairs = colors
    .map((c, i) => ({ c, s: stops[i] ?? i / Math.max(1, colors.length - 1) }))
    .sort((x, y) => x.s - y.s);
  if (!pairs.length) return 0xff000000;
  if (target <= pairs[0].s) return pairs[0].c;
  const last = pairs[pairs.length - 1];
  if (target >= last.s) return last.c;
  for (let i = 0; i < pairs.length - 1; i++) {
    if (target >= pairs[i].s && target <= pairs[i + 1].s) {
      const span = pairs[i + 1].s - pairs[i].s || 1;
      return lerpArgb(pairs[i].c, pairs[i + 1].c, (target - pairs[i].s) / span);
    }
  }
  return pairs[0].c;
}
