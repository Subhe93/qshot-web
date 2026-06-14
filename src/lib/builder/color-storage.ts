/**
 * Recently-used colors, mirroring the mobile ColorManager (Hive) but backed by
 * localStorage. Stores up to 20 ARGB ints, newest first, and tops up with a
 * default palette when sparse (parallels Colors.primaries fallback).
 */

const KEY = "qshot:recent-colors";
const MAX = 20;
const MIN = 10;

// A small Material-ish default palette (ARGB, opaque) used as fallback.
const DEFAULT_PALETTE = [
  0xfff44336, 0xffe91e63, 0xff9c27b0, 0xff673ab7, 0xff3f51b5, 0xff2196f3,
  0xff03a9f4, 0xff00bcd4, 0xff009688, 0xff4caf50,
];

function read(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function write(colors: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(colors));
  } catch {
    // ignore quota / privacy-mode failures
  }
}

/** Newest first; topped up with the default palette when fewer than MIN. */
export function getRecentColors(): number[] {
  const colors = read();
  if (colors.length < MIN) {
    for (const c of DEFAULT_PALETTE) {
      if (!colors.includes(c)) colors.push(c);
    }
    write(colors);
  }
  return [...colors].reverse();
}

/** Add (or move-to-front) a color, capped at MAX. Returns the new newest-first list. */
export function addRecentColor(argb: number): number[] {
  const colors = read().filter((c) => c !== argb);
  colors.push(argb);
  while (colors.length > MAX) colors.shift();
  write(colors);
  return [...colors].reverse();
}
