/**
 * A live temporary profile redirect (contract §4.1, mobile
 * `data/models/temp_redirect.dart`).
 *
 * Never decide "is it still on" from `endsAt`: the server evaluates
 * `isActive AND endsAt > now` on every public request, so the app asks `index`
 * and renders what comes back. Every field is read tolerantly — an unknown or
 * mistyped key must never throw, or a live redirect would vanish off screen.
 */
export interface TempRedirect {
  /** Read from `_id` (or `id`). */
  id: string;
  profileId: string;
  /** Absolute `http`/`https` destination. */
  url: string;
  /** Display only, ≤ 60 chars. Never shown to visitors. */
  label: string | null;
  /** Provenance only, ≤ 40 chars. */
  source: string | null;
  startedAt: Date | null;
  endsAt: Date | null;
  endedAt: Date | null;
  /** Free-form (e.g. `replaced`) — never branch on it. */
  endedReason: string | null;
  isActive: boolean;
  /** Redirects served to HUMAN visitors; not profile views. */
  hits: number;
  lastHitAt: Date | null;
  clientRequestId: string | null;
}

// ── Tolerant readers (Dart `toString` semantics where they matter) ──────────

export function dartToString(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(dartToString).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${k}: ${dartToString(v)}`,
    );
    return `{${entries.join(", ")}}`;
  }
  return String(value);
}

export function readString(value: unknown, fallback = ""): string {
  return value == null ? fallback : dartToString(value);
}

export function readStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = dartToString(value);
  return text === "" ? null : text;
}

/** A non-finite number is not a count; a finite one truncates. */
function readInt(value: unknown, fallback = 0): number {
  return readIntOrNull(value) ?? fallback;
}

export function readIntOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  const text = dartToString(value).trim();
  return /^[+-]?\d+$/.test(text) ? Number.parseInt(text, 10) : null;
}

function readBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/** ISO 8601 strings only; anything else — epoch numbers included — is null. */
export function readDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^[+-]?\d{4,6}-\d{2}-\d{2}/.test(value.trim())) {
    return null;
  }
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTempRedirect(json: Record<string, unknown>): TempRedirect {
  const endedAt = readDate(json.endedAt);
  return {
    id: readString(json._id ?? json.id),
    profileId: readString(json.profileId),
    url: readString(json.url),
    label: readStringOrNull(json.label),
    source: readStringOrNull(json.source),
    startedAt: readDate(json.startedAt ?? json.createdAt),
    endsAt: readDate(json.endsAt),
    endedAt,
    endedReason: readStringOrNull(json.endedReason),
    // Absent `isActive` is derived as "not ended yet" — the server always sends it.
    isActive: json.isActive == null ? endedAt == null : readBool(json.isActive),
    hits: readInt(json.hits),
    lastHitAt: readDate(json.lastHitAt),
    clientRequestId: readStringOrNull(json.clientRequestId),
  };
}

/** Wire shape, UTC ISO 8601 dates — the keys `parseTempRedirect` reads. */
export function tempRedirectToJson(row: TempRedirect): Record<string, unknown> {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    _id: row.id,
    profileId: row.profileId,
    url: row.url,
    label: row.label,
    source: row.source,
    startedAt: iso(row.startedAt),
    endsAt: iso(row.endsAt),
    endedAt: iso(row.endedAt),
    endedReason: row.endedReason,
    isActive: row.isActive,
    hits: row.hits,
    lastHitAt: iso(row.lastHitAt),
    clientRequestId: row.clientRequestId,
  };
}

export function tempRedirectEquals(a: TempRedirect, b: TempRedirect): boolean {
  const left = tempRedirectToJson(a);
  const right = tempRedirectToJson(b);
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strip the `{ success, data: { tempRedirect } }` envelope. `tempRedirect` is
 * always present on success — an object while live, `null` otherwise. A bare
 * row under `data` is tolerated for the day the key moves. `null` also means
 * "the body could not be read"; after a successful `store` that must trigger a
 * re-read, never an error.
 */
export function readTempRedirectEnvelope(body: unknown): TempRedirect | null {
  const data: Record<string, unknown> = isPlainObject(body)
    ? isPlainObject(body.data)
      ? body.data
      : body
    : {};
  const redirect = data.tempRedirect;
  if (isPlainObject(redirect)) return parseTempRedirect(redirect);
  if (!("tempRedirect" in data) && data._id != null) return parseTempRedirect(data);
  return null;
}

/** The stored label, else the destination's host, else the raw URL. */
export function tempRedirectDisplayLabel(row: TempRedirect): string {
  const label = row.label?.trim();
  if (label) return label;
  try {
    const host = new URL(row.url).hostname;
    if (host) return host;
  } catch {
    /* not a URL — fall through to the raw value */
  }
  return row.url;
}
