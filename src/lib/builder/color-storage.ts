/**
 * Recently-used colors, mirroring the mobile ColorManager (Hive) but backed by
 * localStorage. Stores up to 20 ARGB ints, newest first, and tops up with a
 * default palette when sparse (parallels Colors.primaries fallback).
 *
 * ACCOUNT-scoped via the local-store layer: colors are a user preference, so
 * each logged-in account keeps its own list — the old global `qshot:
 * recent-colors` key was shared by every account on the browser (that legacy
 * value is adopted once by whichever account reads first, then deleted).
 */

import { accountEntry } from "@/lib/local-store";

const MAX = 20;
const MIN = 10;

// A small Material-ish default palette (ARGB, opaque) used as fallback.
const DEFAULT_PALETTE = [
  0xfff44336, 0xffe91e63, 0xff9c27b0, 0xff673ab7, 0xff3f51b5, 0xff2196f3,
  0xff03a9f4, 0xff00bcd4, 0xff009688, 0xff4caf50,
];

const entry = accountEntry<number[]>({
  name: "recent-colors",
  fallback: [],
  validate: (v): v is number[] =>
    Array.isArray(v) && v.every((n) => typeof n === "number" && Number.isFinite(n)),
  legacyKey: "qshot:recent-colors",
});

const read = (): number[] => entry.get();
const write = (colors: number[]): void => entry.set(colors);

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
