import { HTTPError } from "ky";
import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";
import type { Profile, ProfileSummary, WebsiteSettings, HeroStyle } from "@/lib/types/profile";
import type { Block } from "@/lib/types/blocks";
import {
  parseBlocks,
  parseSettings,
  serializeBlocks,
  serializeSettings,
} from "@/lib/builder/serialization";
import { fillDefaults } from "@/lib/builder/hero-defaults";

// The list endpoint returns the user's + employee profiles, each a FULL model
// carrying `settings` and `info: { modules }` (the blocks).
interface UserWebsiteData {
  user_template_profiles?: Profile[];
  employee_template_profiles?: Profile[];
}

export async function listProfiles(): Promise<Profile[]> {
  const res = await api
    .get("q-profile/user/index")
    .json<ApiResponse<UserWebsiteData>>();
  const data = res.data ?? {};
  return [
    ...(data.user_template_profiles ?? []),
    ...(data.employee_template_profiles ?? []),
  ];
}

export async function checkUserName(name: string) {
  return api
    .post("q-profile/user/check-user-name", {
      body: new URLSearchParams({ name }),
    })
    .json<ApiResponse<unknown>>();
}

// The list response already carries each profile's full settings + info(blocks),
// so we resolve a single profile from there (mirrors the mobile app, which passes
// the already-loaded model straight into the editor — no separate fetch). Blocks
// and settings are parsed here (mobile fromJson defaults) so the editor always
// works with normalized data regardless of which keys the backend omitted.
export async function getProfile(id: string): Promise<Profile | null> {
  const all = await listProfiles();
  const profile = all.find((p) => p._id === id || p.id === id) ?? null;
  if (!profile) return null;
  const rawBlocks =
    profile.info?.modules ??
    (profile.settings?.modules as unknown[] | undefined) ??
    [];
  return {
    ...profile,
    settings: parseSettings(profile.settings),
    info: { ...profile.info, modules: parseBlocks(rawBlocks) },
  };
}

// Persist the edited profile — JSON body matching the mobile StoreWebsiteRequest:
// blocks live under `info.modules`, hero/style/logo under `settings`.
export async function saveProfile(
  id: string,
  name: string,
  blocks: Block[],
  settings: WebsiteSettings,
) {
  return api
    .post("q-profile/user/edit", {
      json: {
        id,
        name,
        info: { modules: serializeBlocks(blocks) },
        settings: serializeSettings(settings),
      },
    })
    .json<ApiResponse<unknown>>();
}

/* ────────────────────────────────────────────────────────────────────────────
 * Save rejections (HTTP 422 — schema validation)
 *
 * `q-profile/user/edit` (and the page / admin save endpoints) validate the whole
 * document server-side and reject it wholesale. The body is precise and
 * actionable, and used to be thrown away behind "something went wrong":
 *
 *   { "message": "Profile info failed schema validation",
 *     "schemaVersion": "2.0.0",
 *     "target": "info",
 *     "errors": [ { "path": "/modules/3/links/0",
 *                   "message": "unknown field \"icon\" is not allowed",
 *                   "keyword": "additionalProperties",
 *                   "field": "icon" } ] }
 *
 * NOTE the `schemaVersion`: the deployed validator is **not** our copy of
 * `docs/for validation/website-json-schema.json` (see the DELTA doc next to it).
 * These bodies are currently our only hard evidence of what it enforces — which
 * is why the raw payload is also logged verbatim, not just summarised.
 * ──────────────────────────────────────────────────────────────────────────── */

/** One entry of the server's schema-validation report. */
export interface SchemaValidationIssue {
  /** JSON pointer, relative to `target` — e.g. `/modules/3/links/0`. */
  path?: string;
  /** Human-readable complaint, e.g. `unknown field "icon" is not allowed`. */
  message?: string;
  /** Validator keyword, e.g. `additionalProperties`, `minLength`, `format`. */
  keyword?: string;
  /** The offending property name, when the keyword names one. */
  field?: string;
}

export interface SchemaValidationFailure {
  status: number;
  /** Server summary, e.g. "Profile info failed schema validation". */
  message: string;
  /** Which validator ran (e.g. "2.0.0") — record it, our docs copy is older. */
  schemaVersion?: string;
  /** Which half of the document failed: `info` (the blocks) or `settings`. */
  target?: string;
  errors: SchemaValidationIssue[];
  /** The untouched response body, for `console.error`. */
  raw: unknown;
}

function asIssue(v: unknown): SchemaValidationIssue | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : undefined);
  const issue: SchemaValidationIssue = {
    path: str("path") ?? str("instancePath") ?? str("dataPath"),
    message: str("message"),
    keyword: str("keyword"),
    field: str("field") ?? str("property"),
  };
  return issue.path || issue.message || issue.field ? issue : null;
}

/**
 * Read a 422 schema-validation body off a failed save.
 *
 * Returns `null` for anything else (network error, 401, 4xx without a JSON
 * body, …) so callers keep their existing fallback behaviour untouched.
 */
export async function readSchemaValidationFailure(
  e: unknown,
): Promise<SchemaValidationFailure | null> {
  if (!(e instanceof HTTPError)) return null;
  const status = e.response.status;
  if (status !== 422) return null;

  let body: unknown;
  try {
    // clone(): the body may still be wanted elsewhere (apiErrorMessage does the same).
    body = await e.response.clone().json();
  } catch {
    return null; // not JSON — nothing better to say than the generic message
  }
  if (!body || typeof body !== "object") return null;

  // Tolerate the two envelopes this backend uses: flat, or nested under
  // `error` / `error.description` (see apiErrorMessage in client.ts).
  const top = body as Record<string, unknown>;
  const err = (top.error ?? {}) as Record<string, unknown>;
  const desc = (err.description ?? {}) as Record<string, unknown>;
  const pick = (k: string): unknown => top[k] ?? err[k] ?? desc[k];

  const rawErrors = pick("errors");
  const errors = Array.isArray(rawErrors)
    ? rawErrors.map(asIssue).filter((i): i is SchemaValidationIssue => i != null)
    : [];
  const message = typeof pick("message") === "string" ? (pick("message") as string) : "";
  if (!message && errors.length === 0) return null;

  const schemaVersion = pick("schemaVersion");
  const target = pick("target");
  return {
    status,
    message,
    schemaVersion: typeof schemaVersion === "string" ? schemaVersion : undefined,
    target: typeof target === "string" ? target : undefined,
    errors,
    raw: body,
  };
}

export interface DecodedSchemaIssue {
  /** 1-based position in `info.modules`, or `null` when not inside a block. */
  blockPosition: number | null;
  /** Pointer remainder inside the block/target, e.g. `links/0/icon`. */
  where: string;
  /** The server's complaint, verbatim (it is the only precise thing we have). */
  message: string;
}

/**
 * Turn `{ path: "/modules/3/links/0", field: "icon" }` into
 * `{ blockPosition: 4, where: "links/0/icon" }` — a position a user can count
 * to in the canvas instead of a JSON pointer.
 */
export function decodeSchemaIssue(issue: SchemaValidationIssue): DecodedSchemaIssue {
  const segs = (issue.path ?? "").split("/").filter(Boolean);
  // Tolerate both `/modules/3/...` (relative to target `info`) and the
  // absolute `/info/modules/3/...` form.
  const at = segs.indexOf("modules");
  let blockPosition: number | null = null;
  let rest = segs;
  if (at >= 0 && /^\d+$/.test(segs[at + 1] ?? "")) {
    blockPosition = Number(segs[at + 1]) + 1;
    rest = segs.slice(at + 2);
  }
  // `field` names the offending key, which the path usually does NOT include
  // (additionalProperties points at the container).
  if (issue.field && rest[rest.length - 1] !== issue.field) rest = [...rest, issue.field];
  return {
    blockPosition,
    where: rest.join("/"),
    message: (issue.message ?? issue.keyword ?? "").trim(),
  };
}

// The default backend template id used on create (mobile: kMainTemplate).
export const MAIN_TEMPLATE = "6627d338fbcf288835ef634b";

// Upload a logo/image — mirrors mobile websiteImageUpload (q-profile/image/create);
// returns the stored file name (CDN path). Throws on HTTP error so callers can
// surface failures (e.g. 401) instead of silently getting null.
export async function uploadProfileImage(file: File): Promise<string | null> {
  // Field name is `images` (Postman collection "upload new profile image" +
  // mobile UploadImageRequest). Response: { data: [ { file_name } ] }.
  const body = new FormData();
  body.append("images", file);
  const res = await api
    .post("q-profile/image/create", { body })
    .json<unknown>();
  return extractFileName(res);
}

/** Tolerate the few shapes the upload endpoint may return for a stored file. */
function extractFileName(res: unknown): string | null {
  const pick = (o: unknown): string | null => {
    const r = o as { file_name?: string; fileName?: string } | null;
    return r?.file_name ?? r?.fileName ?? null;
  };
  const data = (res as { data?: unknown })?.data ?? res;
  if (Array.isArray(data)) return pick(data[0]);
  const imgs = (data as { images?: unknown })?.images;
  if (Array.isArray(imgs)) return pick(imgs[0]);
  return pick(data);
}

export interface CreateProfileInput {
  domain: string;
  websiteName: string;
  websiteLogo?: string | null;
  style: string; // HeroStyle, e.g. "style2"
}

// Create a new website — mirrors mobile StoreWebsiteRequest. `name` carries the
// domain/slug; settings is the chosen style's FULL template defaults merged with
// the user's name/logo (mobile SettingsEntity.fillDefaults), so the new site
// arrives pre-populated with the template's hero (cover/title/text/buttons).
export async function createProfile(
  input: CreateProfileInput,
): Promise<ProfileSummary | null> {
  const settings = serializeSettings(
    fillDefaults(input.style as HeroStyle, {
      websiteName: input.websiteName,
      websiteLogo: input.websiteLogo ?? null,
    }),
  );
  const res = await api
    .post("q-profile/user/create", {
      json: {
        name: input.domain,
        profileTamplate: MAIN_TEMPLATE,
        info: { modules: [] },
        settings,
      },
    })
    // The backend nests the created profile under `data.user_profile` (mobile
    // UserWebsiteDataSource.create: response.data["data"]["user_profile"]). Read
    // it from there; tolerate a flat response too.
    .json<ApiResponse<{ user_profile?: ProfileSummary } & ProfileSummary>>();
  const data = res.data;
  return data?.user_profile ?? data ?? null;
}

// Delete a website — mirrors mobile DeleteWebsiteRequest (POST q-profile/user/delete, body { id }).
export async function deleteProfile(id: string) {
  return api
    .post("q-profile/user/delete", { json: { id } })
    .json<ApiResponse<unknown>>();
}
