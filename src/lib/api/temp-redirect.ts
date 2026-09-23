import { HTTPError } from "ky";
import { useAuthStore } from "@/stores/auth-store";
import { api, httpErrorBody, isWrapped401Body } from "./client";
import { readTempRedirectEnvelope, type TempRedirect } from "@/lib/temp-redirect/model";
import { parseTempRedirectError, TempRedirectError } from "@/lib/temp-redirect/errors";

/**
 * `q-profile/temp-redirect/*` — the temporary profile redirect (mobile
 * `TempRedirectDataSource`, contract `docs/api/website/temporary-redirect.md`
 * §4). All three are POST with `profileId`; reading and stopping never
 * require a plan. Failures throw `TempRedirectError` — branch on its `code`.
 */

const PATHS = {
  index: "q-profile/temp-redirect/index",
  store: "q-profile/temp-redirect/store",
  delete: "q-profile/temp-redirect/delete",
} as const;

/** Any thrown value → `TempRedirectError`. The body comes from ky's
 *  pre-read `HTTPError.data` (object or text), so the 400, the 429 and a
 *  proxy's HTML page all reach the parser without crashing it. */
export async function toTempRedirectError(e: unknown): Promise<TempRedirectError> {
  if (e instanceof TempRedirectError) return e;
  if (e instanceof HTTPError) {
    const body = await httpErrorBody(e);
    // An invalid session arrives as a 400 wrapping a 401 — the client hook
    // only sees real 401s, so sign out here like the SSE channel does.
    if (e.response.status === 400 && isWrapped401Body(body)) {
      useAuthStore.getState().logout();
    }
    return parseTempRedirectError({
      status: e.response.status,
      body,
      retryAfter: e.response.headers.get("retry-after"),
      transportMessage: e.message,
    });
  }
  return parseTempRedirectError({
    transportMessage: e instanceof Error ? e.message : String(e),
  });
}

async function post(path: string, json: Record<string, unknown>): Promise<unknown> {
  try {
    const text = await api.post(path, { json }).text();
    try {
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      // A success whose body cannot be read — callers treat it as "re-read".
      return null;
    }
  } catch (e) {
    throw await toTempRedirectError(e);
  }
}

/** The redirect serving now, or `null` (including expired-but-not-tidied). */
export async function fetchTempRedirect(profileId: string): Promise<TempRedirect | null> {
  return readTempRedirectEnvelope(await post(PATHS.index, { profileId }));
}

export interface StartTempRedirectRequest {
  profileId: string;
  url: string;
  /** Already clipped to 60; omitted when null. */
  label: string | null;
  /** Already clipped to 40; omitted when null. */
  source: string | null;
  endsAt: Date;
  /** Fresh per user tap; reused only by the CONFLICT retry of that tap. */
  clientRequestId: string;
}

/**
 * Starts or replaces the redirect; returns the NEW row (`hits: 0`). `null`
 * means the call succeeded but the body could not be read — the redirect IS
 * running, so the caller must re-read, never report a failure.
 */
export async function startTempRedirect(req: StartTempRedirectRequest): Promise<TempRedirect | null> {
  const body: Record<string, unknown> = {
    profileId: req.profileId,
    url: req.url,
    endsAt: req.endsAt.toISOString(),
    clientRequestId: req.clientRequestId,
  };
  if (req.label != null) body.label = req.label;
  if (req.source != null) body.source = req.source;
  return readTempRedirectEnvelope(await post(PATHS.store, body));
}

/** Stops the redirect. Idempotent, never gated, effective on the next visit. */
export async function stopTempRedirect(profileId: string): Promise<void> {
  await post(PATHS.delete, { profileId });
}
