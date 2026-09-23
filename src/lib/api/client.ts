import ky, { HTTPError } from "ky";
import { useAuthStore } from "@/stores/auth-store";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.qshot.com";

/**
 * Shared HTTP client. Attaches the bearer token from the auth store and
 * surfaces 401s by logging the user out.
 */
export const api = ky.create({
  baseUrl: API_BASE,
  timeout: 30_000,
  retry: { limit: 1, methods: ["get"] },
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = useAuthStore.getState().token;
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
        request.headers.set("Accept", "application/json");
      },
    ],
    afterResponse: [
      ({ response }) => {
        if (response.status === 401) {
          useAuthStore.getState().logout();
        }
      },
    ],
  },
});

/**
 * The body of a failed `api` call: an object for JSON, a string for text,
 * `null` when empty or unreadable.
 *
 * ky ≥ 2 pre-reads the error body into `HTTPError.data` and CONSUMES the
 * Response, so `e.response.json()` / `.clone()` throw "Body has already been
 * consumed". Read `data` first; the Response path is kept for older shapes.
 */
export async function httpErrorBody(e: HTTPError): Promise<unknown> {
  const data: unknown = e.data;
  if (data !== undefined) {
    if (typeof data !== "string") return data;
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return data;
    }
  }
  try {
    return (await e.response.clone().json()) as unknown;
  } catch {
    return null;
  }
}

/** The backend hides an invalid session inside a 400 body:
 *  `error.description.statusCode === 401`. */
export function isWrapped401Body(body: unknown): boolean {
  const b = body as { error?: { description?: { statusCode?: number | string } } } | null;
  return Number(b?.error?.description?.statusCode) === 401;
}

/**
 * Human-readable message from a failed `api` call. The qshot backend returns
 * `{ error: { description: { message } } }` (e.g. "User already has an active
 * subscription."); fall back through a few shapes, then to `fallback`.
 */
export async function apiErrorMessage(
  e: unknown,
  fallback: string,
): Promise<string> {
  if (e instanceof HTTPError) {
    try {
      const body = (await httpErrorBody(e)) as {
        error?: { description?: { message?: string }; message?: string };
        message?: string;
      };
      const msg =
        body?.error?.description?.message ??
        body?.error?.message ??
        body?.message;
      if (typeof msg === "string" && msg.trim()) {
        return msg.replace(/^Error:\s*/i, "").trim();
      }
    } catch {
      /* response wasn't JSON — use the fallback */
    }
  }
  return fallback;
}
