import { HTTPError } from "ky";
import { useAuthStore } from "@/stores/auth-store";
import { api, httpErrorBody, isWrapped401Body } from "./client";
import {
  readClaimEnvelope,
  readCodeEnvelope,
  readLinkEnvelope,
  readOverviewEnvelope,
  readRegistryEnvelope,
  readRemovedEnvelope,
  type ClaimResult,
  type PlatformCode,
  type PlatformLink,
  type PlatformRedirectOverview,
  type PlatformRegistryEntry,
} from "@/lib/platform-redirect/model";
import {
  parsePlatformRedirectError,
  PlatformRedirectError,
} from "@/lib/platform-redirect/errors";

/**
 * `/platform-redirect/*` — the owner routes of the platform redirect cards
 * (integration guide §6–§7, api-design §4). Every call acts on the signed-in
 * ACCOUNT: no profile id, no user id, ever. Failures throw
 * `PlatformRedirectError` — branch on its `code`, never on `message`.
 */

const BASE = "platform-redirect";

/** Any thrown value → `PlatformRedirectError`. A framework 400 wrapping a 401
 *  (and the `UnauthorizedException` name) runs the same sign-out path as the
 *  rest of the app. */
export async function toPlatformRedirectError(e: unknown): Promise<PlatformRedirectError> {
  if (e instanceof PlatformRedirectError) return e;
  if (e instanceof HTTPError) {
    const body = await httpErrorBody(e);
    const parsed = parsePlatformRedirectError({
      status: e.response.status,
      body,
      retryAfter: e.response.headers.get("retry-after"),
      transportMessage: e.message,
    });
    if ((e.response.status === 400 && isWrapped401Body(body)) || parsed.isUnauthorized) {
      useAuthStore.getState().logout();
    }
    if (parsed.code === "BAD_REQUEST" && process.env.NODE_ENV !== "production") {
      // A body/query that failed validation is a client bug — surface it.
      console.error("[platform-redirect] BadRequestException:", parsed.message);
    }
    return parsed;
  }
  return parsePlatformRedirectError({
    transportMessage: e instanceof Error ? e.message : String(e),
  });
}

async function readJson(request: Promise<Response>): Promise<unknown> {
  try {
    const text = await (await request).text();
    try {
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return null;
    }
  } catch (e) {
    throw await toPlatformRedirectError(e);
  }
}

const seg = (value: string) => encodeURIComponent(value);

/** The whole screen in one request (§7.2). */
export async function getPlatformRedirect(): Promise<PlatformRedirectOverview> {
  return readOverviewEnvelope(await readJson(api.get(BASE)));
}

/** Public registry, cacheable for a minute (api-design §3.1). No token needed;
 *  the shared client still attaches one when present, which is harmless. */
export async function getPlatformRegistry(): Promise<PlatformRegistryEntry[]> {
  return readRegistryEnvelope(await readJson(api.get(`${BASE}/platforms`)));
}

/** `PUT /platform-redirect/links/:platform` → the saved link, `null` when the
 *  200 body could not be read (the link IS saved — re-read). */
export async function setPlatformLink(platform: string, url: string): Promise<PlatformLink | null> {
  return readLinkEnvelope(await readJson(api.put(`${BASE}/links/${seg(platform)}`, { json: { url } })));
}

/** `DELETE /platform-redirect/links/:platform` → whether a link was removed. */
export async function deletePlatformLink(platform: string): Promise<boolean> {
  return readRemovedEnvelope(await readJson(api.delete(`${BASE}/links/${seg(platform)}`)));
}

export interface ClaimCodeRequest {
  platform: string;
  code: string;
  /** Omitted when null/empty. Up to 60 characters. */
  label?: string | null;
}

/** `POST /platform-redirect/codes/claim` → the new row + `linkConfigured`. */
export async function claimCode(req: ClaimCodeRequest): Promise<ClaimResult | null> {
  const body: Record<string, unknown> = { platform: req.platform, code: req.code };
  const label = req.label?.trim();
  if (label) body.label = label;
  return readClaimEnvelope(await readJson(api.post(`${BASE}/codes/claim`, { json: body })));
}

/** `PATCH /platform-redirect/codes/:platform/:code` — `null` clears the name. */
export async function relabelCode(
  platform: string,
  code: string,
  label: string | null,
): Promise<PlatformCode | null> {
  return readCodeEnvelope(
    await readJson(
      api.patch(`${BASE}/codes/${seg(platform)}/${seg(code)}`, { json: { label } }),
    ),
  );
}

/** `DELETE /platform-redirect/codes/:platform/:code` — releases the card. */
export async function unlinkCode(platform: string, code: string): Promise<PlatformCode | null> {
  return readCodeEnvelope(await readJson(api.delete(`${BASE}/codes/${seg(platform)}/${seg(code)}`)));
}
