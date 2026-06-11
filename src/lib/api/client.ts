import ky from "ky";
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
