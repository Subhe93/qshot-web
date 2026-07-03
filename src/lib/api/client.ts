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
      const body = (await e.response.clone().json()) as {
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
