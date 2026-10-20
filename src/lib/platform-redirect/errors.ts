import { readIntOrNull, readString, readStringOrNull } from "@/lib/temp-redirect/model";

/**
 * Platform-redirect refusal codes (integration guide §6, §7.3, §7.4;
 * api-design §6). CASE-SENSITIVE. Branch on the code only — `message` is
 * English developer text and may change at any time.
 */
export const PLATFORM_REDIRECT_ERROR_CODES = {
  featureDisabled: "FEATURE_DISABLED", // 503 — kill switch
  featureNotInPlan: "FEATURE_NOT_IN_PLAN", // 403 — upgrade sheet
  platformUnknown: "PLATFORM_UNKNOWN", // 422 — reload
  platformNotAvailable: "PLATFORM_NOT_AVAILABLE", // 422 — reload
  platformPaused: "PLATFORM_PAUSED", // 422 — "{label} is temporarily unavailable", reload
  invalidCode: "INVALID_CODE", // 422
  invalidUrl: "INVALID_URL", // 422 — `reason`
  hostNotAllowed: "HOST_NOT_ALLOWED", // 422 — `host`, `allowedHosts`, `examples`
  linkFormatNotAllowed: "LINK_FORMAT_NOT_ALLOWED", // 422 — `examples`
  invalidLabel: "INVALID_LABEL", // 422 — `maxLength`
  codeNotFound: "CODE_NOT_FOUND", // 404
  codeDisabled: "CODE_DISABLED", // 422
  codeAlreadyAssigned: "CODE_ALREADY_ASSIGNED", // 409
  codeNotYours: "CODE_NOT_YOURS", // 403
  quotaExceeded: "QUOTA_EXCEEDED", // 422 — `limit`, `used`
  tooManyAttempts: "TOO_MANY_ATTEMPTS", // 429 — `retryAfterSeconds`
} as const;

export type PlatformRedirectErrorCode =
  (typeof PLATFORM_REDIRECT_ERROR_CODES)[keyof typeof PLATFORM_REDIRECT_ERROR_CODES];

/**
 * Synthetic codes for the framework's own refusals (HTTP 400 with `error.name`
 * instead of `error.code`, §6) and for transport failures. Kept distinct from
 * the contract codes so nothing can mistake them for server decisions.
 */
export const PLATFORM_REDIRECT_SYNTHETIC = {
  /** `ThrottlerException` — "wait a moment and try again". */
  throttled: "THROTTLED",
  /** `UnauthorizedException` — the global sign-out path has already run. */
  unauthorized: "UNAUTHORIZED",
  /** `BadRequestException` — a client bug; logged, shown as generic. */
  badRequest: "BAD_REQUEST",
  /** Fetch failed, timed out, or answered with something unparseable. */
  network: "NETWORK",
} as const;

export interface PlatformRedirectErrorExtra {
  label: string | null;
  examples: string[];
  allowedHosts: string[];
  limit: number | null;
  used: number | null;
  retryAfterSeconds: number | null;
  maxLength: number | null;
  reason: string | null;
  platform: string | null;
  host: string | null;
  featureCode: string | null;
}

export class PlatformRedirectError extends Error {
  /** A contract code, a synthetic code, or `null` when the body carried none. */
  readonly code: string | null;
  readonly status: number | null;
  readonly extra: PlatformRedirectErrorExtra;

  constructor(init: {
    code?: string | null;
    message?: string;
    status?: number | null;
    extra?: Partial<PlatformRedirectErrorExtra>;
  }) {
    super(init.message ?? "");
    this.name = "PlatformRedirectError";
    this.code = init.code ?? null;
    this.status = init.status ?? null;
    this.extra = {
      label: null,
      examples: [],
      allowedHosts: [],
      limit: null,
      used: null,
      retryAfterSeconds: null,
      maxLength: null,
      reason: null,
      platform: null,
      host: null,
      featureCode: null,
      ...init.extra,
    };
  }

  is(code: string): boolean {
    return this.code === code;
  }
  get isFeatureDisabled() {
    return this.code === PLATFORM_REDIRECT_ERROR_CODES.featureDisabled;
  }
  get isPlanError() {
    return this.code === PLATFORM_REDIRECT_ERROR_CODES.featureNotInPlan;
  }
  get isThrottled() {
    return (
      this.code === PLATFORM_REDIRECT_SYNTHETIC.throttled ||
      this.code === PLATFORM_REDIRECT_ERROR_CODES.tooManyAttempts
    );
  }
  get isUnauthorized() {
    return this.code === PLATFORM_REDIRECT_SYNTHETIC.unauthorized;
  }
  /** The platform list on screen is stale: paused, hidden or gone — reload. */
  get needsReload() {
    return (
      this.code === PLATFORM_REDIRECT_ERROR_CODES.platformPaused ||
      this.code === PLATFORM_REDIRECT_ERROR_CODES.platformNotAvailable ||
      this.code === PLATFORM_REDIRECT_ERROR_CODES.platformUnknown ||
      this.code === PLATFORM_REDIRECT_ERROR_CODES.codeNotYours
    );
  }
}

type Json = Record<string, unknown>;

function isMap(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => readStringOrNull(v)).filter((v): v is string => v != null);
}

/** The object carrying `code`: `error`, or the global filter's
 *  `error.description` nesting. It only ever finds a code, never invents one. */
function envelopeError(error: Json): Json {
  if (error.code != null) return error;
  const description = error.description;
  if (isMap(description)) {
    if (description.code != null) return description;
    if (isMap(description.error) && description.error.code != null) return description.error;
  }
  return error;
}

/** Framework 400s name their exception in `error.name` (or
 *  `error.description.error`/`name` behind the global filter). */
function frameworkName(error: Json): string | null {
  const direct = readStringOrNull(error.name);
  if (direct) return direct;
  const description = error.description;
  if (isMap(description)) {
    return readStringOrNull(description.name) ?? readStringOrNull(description.error);
  }
  return null;
}

function messageOf(body: unknown, fallback: string | null | undefined): string {
  if (isMap(body)) {
    const error = body.error;
    if (isMap(error)) {
      const nested = readStringOrNull(error.message);
      if (nested != null) return nested;
      if (isMap(error.description)) {
        const deep = readStringOrNull(error.description.message);
        if (deep != null) return deep;
      }
    }
    const message = body.message;
    if (Array.isArray(message) && message.length > 0) return message.map(String).join(", ");
    const text = readStringOrNull(message);
    if (text != null) return text;
  } else if (typeof body === "string" && body.trim()) {
    return body;
  }
  return readString(fallback, "Request failed");
}

/**
 * Typed view of any failure. Three shapes reach here and none may crash: the
 * contract envelope (`error.code` + extra fields), the framework 400
 * (`error.name`), and a transport failure or proxy page (no code at all).
 */
export function parsePlatformRedirectError(input: {
  status?: number | null;
  body?: unknown;
  retryAfter?: string | null;
  transportMessage?: string | null;
}): PlatformRedirectError {
  const status = input.status ?? null;
  const body = decodeBody(input.body);
  const message = messageOf(body, input.transportMessage);

  if (isMap(body) && isMap(body.error)) {
    const error = envelopeError(body.error);
    const code = readStringOrNull(error.code);
    if (code != null) {
      return new PlatformRedirectError({
        code,
        message,
        status,
        extra: {
          label: readStringOrNull(error.label),
          examples: readStringList(error.examples),
          allowedHosts: readStringList(error.allowedHosts),
          limit: readIntOrNull(error.limit),
          used: readIntOrNull(error.used),
          retryAfterSeconds:
            readIntOrNull(error.retryAfterSeconds) ?? readIntOrNull(input.retryAfter ?? null),
          maxLength: readIntOrNull(error.maxLength),
          reason: readStringOrNull(error.reason),
          platform: readStringOrNull(error.platform),
          host: readStringOrNull(error.host),
          featureCode: readStringOrNull(error.featureCode),
        },
      });
    }
    const name = frameworkName(body.error);
    if (name === "ThrottlerException") {
      return new PlatformRedirectError({
        code: PLATFORM_REDIRECT_SYNTHETIC.throttled,
        message,
        status,
        extra: { retryAfterSeconds: readIntOrNull(input.retryAfter ?? null) },
      });
    }
    if (name === "UnauthorizedException") {
      return new PlatformRedirectError({ code: PLATFORM_REDIRECT_SYNTHETIC.unauthorized, message, status });
    }
    if (name === "BadRequestException") {
      return new PlatformRedirectError({ code: PLATFORM_REDIRECT_SYNTHETIC.badRequest, message, status });
    }
  }

  if (status === 429) {
    return new PlatformRedirectError({
      code: PLATFORM_REDIRECT_SYNTHETIC.throttled,
      message,
      status,
      extra: { retryAfterSeconds: readIntOrNull(input.retryAfter ?? null) },
    });
  }
  if (status === 401) {
    return new PlatformRedirectError({ code: PLATFORM_REDIRECT_SYNTHETIC.unauthorized, message, status });
  }

  return new PlatformRedirectError({
    code: status == null ? PLATFORM_REDIRECT_SYNTHETIC.network : null,
    message,
    status,
  });
}
