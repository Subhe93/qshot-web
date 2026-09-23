import { dartToString, readIntOrNull, readString, readStringOrNull } from "./model";

/**
 * Temporary-redirect refusal codes (contract §7). CASE-SENSITIVE — match
 * exactly, never normalise. Branch on the code; `message` is English and may
 * change.
 */
export const TEMP_REDIRECT_ERROR_CODES = {
  /** 403 store — plan lacks `temporary_redirect`. Upgrade dialog. */
  featureNotInPlan: "FEATURE_NOT_IN_PLAN",
  /** 503 store — operator kill switch. "Try later", never an upgrade prompt. */
  featureDisabled: "FEATURE_DISABLED",
  /** 422 store — destination rejected; carries `reason`. */
  invalidUrl: "INVALID_URL",
  /** 422 store — end time missing/past/< 60 s/over ceiling; carries `limitDays`. */
  invalidEndTime: "INVALID_END_TIME",
  /** 422 store — label > 60; carries `maxLength`. */
  invalidLabel: "INVALID_LABEL",
  /** 404 any — not the caller's profile, or gone. */
  profileNotFound: "PROFILE_NOT_FOUND",
  /** 409 store — retry ONCE with the SAME clientRequestId. */
  conflict: "CONFLICT",
} as const;

/** Synthetic: the 429 rate limiter answers outside the envelope. */
export const TEMP_REDIRECT_THROTTLED = "THROTTLED";

/** `INVALID_URL.reason` values. */
export const TEMP_REDIRECT_URL_REASONS = [
  "unparseable",
  "too_long",
  "scheme",
  "relative",
  "first_party",
  "self",
  "denied",
] as const;

export class TempRedirectError extends Error {
  /** A contract code, the synthetic THROTTLED, or `null` for shapes that carry
   *  none (the NestJS 400, a proxy page, a transport failure). */
  readonly code: string | null;
  readonly statusCode: number | null;
  readonly featureCode: string | null;
  /** `null` for admins (uncapped) and when absent — never 0. */
  readonly limitDays: number | null;
  readonly maxLength: number | null;
  readonly reason: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    code?: string | null;
    message?: string;
    statusCode?: number | null;
    featureCode?: string | null;
    limitDays?: number | null;
    maxLength?: number | null;
    reason?: string | null;
    retryAfterSeconds?: number | null;
  }) {
    super(init.message ?? "");
    this.name = "TempRedirectError";
    this.code = init.code ?? null;
    this.statusCode = init.statusCode ?? null;
    this.featureCode = init.featureCode ?? null;
    this.limitDays = init.limitDays ?? null;
    this.maxLength = init.maxLength ?? null;
    this.reason = init.reason ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  get isPlanError() {
    return this.code === TEMP_REDIRECT_ERROR_CODES.featureNotInPlan;
  }
  get isDisabled() {
    return this.code === TEMP_REDIRECT_ERROR_CODES.featureDisabled;
  }
  get isInvalidUrl() {
    return this.code === TEMP_REDIRECT_ERROR_CODES.invalidUrl;
  }
  get isInvalidEndTime() {
    return this.code === TEMP_REDIRECT_ERROR_CODES.invalidEndTime;
  }
  get isInvalidLabel() {
    return this.code === TEMP_REDIRECT_ERROR_CODES.invalidLabel;
  }
  get isProfileNotFound() {
    return this.code === TEMP_REDIRECT_ERROR_CODES.profileNotFound;
  }
  get isConflict() {
    return this.code === TEMP_REDIRECT_ERROR_CODES.conflict;
  }
  get isThrottled() {
    return this.code === TEMP_REDIRECT_THROTTLED;
  }
}

type Json = Record<string, unknown>;

function isMap(value: unknown): value is Json {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array) &&
    !(value instanceof ArrayBuffer)
  );
}

/**
 * Bytes or raw text (a non-JSON response, a proxy's HTML) back into the map the
 * parser expects; anything undecodable is returned untouched.
 */
function decodeBody(body: unknown): unknown {
  if (isMap(body)) return body;
  let text: string | null = null;
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
    try {
      text = new TextDecoder("utf-8", { fatal: false }).decode(body);
    } catch {
      return body;
    }
  } else if (typeof body === "string") {
    text = body;
  }
  if (text == null || !text.trim()) return body;
  try {
    const decoded: unknown = JSON.parse(text);
    return isMap(decoded) ? decoded : body;
  } catch {
    return body;
  }
}

/** The most useful sentence available, without ever claiming a code. NestJS
 *  400s carry `message` as a LIST of field complaints. */
function messageOf(body: unknown, transportMessage: string | null | undefined): string {
  if (isMap(body)) {
    const message = body.message;
    if (Array.isArray(message) && message.length > 0) {
      return message.map((e) => dartToString(e)).join(", ");
    }
    const text = readStringOrNull(message);
    if (text != null) return text;
    const error = body.error;
    if (isMap(error)) {
      const nested = readStringOrNull(error.message);
      if (nested != null) return nested;
    }
    const bare = readStringOrNull(error);
    if (bare != null) return bare;
  } else if (typeof body === "string" && body.trim()) {
    return body;
  }
  return readString(transportMessage, "Request failed");
}

/**
 * The object carrying `code`. The contract puts it at `error`; this backend's
 * global filter nests other failures under `error.description`, so that shape
 * is tolerated too — it only ever adds a code, never invents one.
 */
function envelopeError(error: Json): Json {
  if (error.code != null) return error;
  const description = error.description;
  if (isMap(description)) {
    if (description.code != null) return description;
    if (isMap(description.error) && description.error.code != null) return description.error;
  }
  return error;
}

/**
 * Typed view of any failure (mobile `TempRedirectError.fromDio`). Three shapes
 * reach here and none may crash: the §7 envelope (object `error` with `code`),
 * a NestJS 400 whose `error` is a bare string (left untyped — a programming
 * error, never a user message), and a 429 from the rate limiter (synthetic
 * THROTTLED, whatever its body).
 */
export function parseTempRedirectError(input: {
  status?: number | null;
  body?: unknown;
  /** The `Retry-After` header, if any. */
  retryAfter?: string | null;
  /** The transport's own message (fetch/ky), used when the body says nothing. */
  transportMessage?: string | null;
}): TempRedirectError {
  const status = input.status ?? null;
  const body = decodeBody(input.body);

  if (status === 429) {
    return new TempRedirectError({
      code: TEMP_REDIRECT_THROTTLED,
      message: messageOf(body, input.transportMessage),
      statusCode: status,
      retryAfterSeconds: readIntOrNull(input.retryAfter ?? null),
    });
  }

  if (isMap(body) && isMap(body.error)) {
    const error = envelopeError(body.error);
    return new TempRedirectError({
      code: readStringOrNull(error.code),
      message: readString(error.message),
      statusCode: status,
      featureCode: readStringOrNull(error.featureCode),
      limitDays: readIntOrNull(error.limitDays),
      maxLength: readIntOrNull(error.maxLength),
      reason: readStringOrNull(error.reason),
    });
  }

  return new TempRedirectError({
    message: messageOf(body, input.transportMessage),
    statusCode: status,
  });
}
