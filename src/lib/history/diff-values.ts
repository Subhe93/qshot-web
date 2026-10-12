/**
 * Pure helpers for the Compare screen's values (contract §5.3).
 *
 * Two problems they solve:
 *  - The web serializer (mirroring mobile `toJson`) always writes default
 *    keys (`hide: false`, `background_color: null`, `[]`, `""`) that older
 *    stored JSON lacks, so the server lists untouched blocks as "edited" and
 *    a settings key as changed when only the format grew. `sameIgnoringDefaults`
 *    tells a real change from a format-only one.
 *  - A settings key whose value is an object (`text: {hide, text, size}`)
 *    must show the changed LEAVES (`text.text: "A" → "B"`), not truncated
 *    JSON, and a long string must still show the part that differs.
 *
 * No React, no i18n — testable from `scripts/check-history.ts`.
 */

type Json = Record<string, unknown>;

function isPlainObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A value the serializer writes by default where older JSON has no key. */
export function isDefaultValue(value: unknown): boolean {
  return (
    value === false ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Deep equality where a key missing on one side and holding a default value
 * on the other counts as equal. Arrays compare element-wise.
 */
export function sameIgnoringDefaults(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const inA = key in a;
      const inB = key in b;
      if (inA && !inB) {
        if (!isDefaultValue(a[key])) return false;
        continue;
      }
      if (inB && !inA) {
        if (!isDefaultValue(b[key])) return false;
        continue;
      }
      if (!sameIgnoringDefaults(a[key], b[key])) return false;
    }
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((value, i) => sameIgnoringDefaults(value, b[i]));
  }
  if (a === undefined) return isDefaultValue(b);
  if (b === undefined) return isDefaultValue(a);
  return false;
}

export interface LeafChange {
  /** Dotted path from the top-level key: `text.text`. */
  path: string;
  before: unknown;
  after: unknown;
}

/**
 * The leaves that really changed under `key`: objects recurse, arrays and
 * scalars are leaves, equal leaves (ignoring defaults) are dropped. An empty
 * result means the key changed in format only.
 */
export function flattenChanges(key: string, before: unknown, after: unknown): LeafChange[] {
  if (isPlainObject(before) && isPlainObject(after)) {
    const out: LeafChange[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const child of keys) {
      out.push(...flattenChanges(`${key}.${child}`, before[child], after[child]));
    }
    return out;
  }
  if (sameIgnoringDefaults(before, after)) return [];
  return [{ path: key, before, after }];
}

/** A leaf value as text: strings as-is, nothing as an em dash, else compact JSON. */
export function valueText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value === "" ? "—" : value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface ClippedPair {
  before: string;
  after: string;
}

/**
 * Display strings for a leaf. Short values pass through; long ones are
 * clipped to a window of `max` characters that starts a little before the
 * FIRST difference, so what changed is always on screen, with an ellipsis on
 * each cut side. Both sides share the window so they line up.
 */
export function clipPair(before: unknown, after: unknown, max = 60): ClippedPair {
  const a = valueText(before);
  const b = valueText(after);
  if (a.length <= max && b.length <= max) return { before: a, after: b };
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  const start = Math.max(0, i - Math.floor(max / 3));
  const clip = (s: string): string => {
    if (s.length <= max) return s;
    const end = Math.min(s.length, start + max);
    return `${start > 0 ? "…" : ""}${s.slice(start, end)}${end < s.length ? "…" : ""}`;
  };
  return { before: clip(a), after: clip(b) };
}
