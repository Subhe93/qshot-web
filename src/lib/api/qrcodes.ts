import { HTTPError } from "ky";
import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";
import {
  parseQrPreview,
  type QrPreviewResult,
  type QrWarning,
} from "@/lib/qr/artisan-style";

/** CDN base for stored assets (icons, generated png/svg). Mirrors mobile `Links.storage`. */
const CDN_BASE = "https://cdn.qshot.com/";

export function cdnUrl(path?: string) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return CDN_BASE + path.replace(/^\/+/, "");
}

// ---------------------------------------------------------------------------
// Dynamic QR — PDF upload (the `file` attribute)
// ---------------------------------------------------------------------------

/**
 * Upload a PDF for a dynamic QR `file` attribute → returns the stored fileName
 * (CDN key) to put in `data[tag]`. Mirrors mobile qr-code-dynamic/user/upload-pdf
 * (multipart field `pdf`).
 */
export async function uploadQrPdf(file: File): Promise<string | null> {
  const body = new FormData();
  body.append("pdf", file);
  const res = await api
    .post("qr-code-dynamic/user/upload-pdf", { body })
    .json<ApiResponse<{ fileName?: string }>>();
  return res.data?.fileName ?? null;
}

// ---------------------------------------------------------------------------
// QR custom logos (qr-code/user/logo/*)
// ---------------------------------------------------------------------------

export interface QrLogo {
  _id: string;
  id?: string;
  image: string; // CDN path
  [key: string]: unknown;
}

export async function listQrLogos(): Promise<QrLogo[]> {
  const res = await api
    .get("qr-code/user/logo/index")
    .json<ApiResponse<{ logos?: QrLogo[] } | QrLogo[]>>()
    .catch(() => null);
  const data = res?.data as { logos?: QrLogo[] } | QrLogo[] | undefined;
  if (Array.isArray(data)) return data;
  return data?.logos ?? [];
}

export async function createQrLogo(file: File): Promise<QrLogo | null> {
  const body = new FormData();
  body.append("image", file);
  const res = await api
    .post("qr-code/user/logo/create", { body })
    .json<ApiResponse<unknown>>();
  const data = res.data as { logo?: QrLogo } | null;
  const logo = (data && "logo" in data ? data.logo : data) as QrLogo | undefined;
  return logo ?? null;
}

export async function deleteQrLogo(id: string) {
  return api
    .post("qr-code/user/logo/delete", { json: { id } })
    .json<ApiResponse<unknown>>();
}

// ---------------------------------------------------------------------------
// Saved user QR codes (listing)
// ---------------------------------------------------------------------------

/**
 * GET qr-code/user/index → the user's saved QR codes. The backend wraps them as
 * `{ data: { user_qrcodes: [...] } }`, each item being a full userQr with a
 * `pngImage`/`svgImage` path on the CDN (mirrors mobile GeneratedQrcodeModel).
 */
export async function listQrCodes(): Promise<UserQr[]> {
  const res = await api
    .get("qr-code/user/index")
    .json<ApiResponse<{ user_qrcodes: UserQr[] }>>();
  return res.data?.user_qrcodes ?? [];
}

// ---------------------------------------------------------------------------
// QR configurations (the available QR types + their data attributes)
// Mirrors mobile QrConfigurationsModel / fetchQrConfigurations.
// ---------------------------------------------------------------------------

export interface QrAttributeCustomization {
  min_line?: number | null;
  max_line?: number | null;
  required?: boolean | null;
  hint?: string | null;
  validator?: string | null;
  accepted_file_types?: string[] | null;
  values?: string[] | null;
  default?: unknown;
}

/** Help content shown behind the `?` icon next to a field. Mirrors mobile InstructionsModel. */
export interface QrInstructions {
  title?: string | null;
  video_url?: string | null;
  explanation?: string[] | null;
  images?: string[] | null;
}

export interface QrAttribute {
  type: string; // string | phone | selection | bool | form | file
  tag: string;
  label: string;
  instructions?: QrInstructions | null;
  customization: QrAttributeCustomization;
}

export interface QrConfig {
  _id: string;
  tag: string;
  name: string;
  description: string;
  explanation: string;
  icon: string;
  attributes: QrAttribute[];
  qr_type: string; // static | dynamic
  permissionCode: string;
}

export type QrType = "static" | "dynamic";

/**
 * Fetch the available QR configurations. The mobile app sends `{type}` as a
 * GET body via Dio; fetch can't attach a GET body, so we pass it as a query
 * param and also filter client-side by `qr_type` as a safety net.
 */
export async function listQrConfigurations(type: QrType = "static") {
  const res = await api
    .get("qr-code/all", { searchParams: { type } })
    .json<ApiResponse<{ qr_codes: QrConfig[] }>>();
  const all = res.data?.qr_codes ?? [];
  return all.filter((c) => !c.qr_type || c.qr_type === type);
}

// ---------------------------------------------------------------------------
// Preview + create — mirrors mobile QrDataSource.generate / create.
// ---------------------------------------------------------------------------

export interface QrDataPayload {
  type: string; // the config `tag`
  data: Record<string, unknown>;
  /** The v1 platform payload — build it with `styleToWire`, never by hand. */
  customizes: Record<string, unknown>;
}

/**
 * QR Artisan v1 endpoints (mobile Links.*V1; CONTRACT-qr-artisan.md §1).
 * The LEGACY table is kept for exactly one caller: renaming a record whose
 * `engine` is "legacy" — a v1 edit MIGRATES and re-renders such a record,
 * which a rename must never do (mobile RenameQrcodeUseCase, a504fa72).
 */
const ENDPOINTS = {
  static: {
    preview: "v1/qr-code/user/preview",
    create: "v1/qr-code/user/create",
    edit: "v1/qr-code/user/edit",
  },
  dynamic: {
    preview: "v1/qr-code-dynamic/user/preview",
    create: "v1/qr-code-dynamic/user/create",
    edit: "v1/qr-code-dynamic/user/update",
  },
} as const;

const LEGACY_ENDPOINTS = {
  static: { edit: "qr-code/user/edit" },
  dynamic: { edit: "qr-code-dynamic/user/update" },
} as const;

/**
 * POST v1 .../preview → JSON with the image AND a scannability verdict
 * (was: raw SVG text on the legacy route). The preview REPORTS, it never
 * blocks — an error-severity design still carries its svg. Unauthenticated.
 * Always include `qrcode` when known: several catalog entries share
 * `type:"text"` and the server disambiguates on it alone.
 */
export async function previewQrCode(
  payload: QrDataPayload & { qrcode?: string },
  qrType: QrType = "static",
): Promise<QrPreviewResult> {
  const res = await api
    .post(ENDPOINTS[qrType].preview, { json: payload })
    .json<ApiResponse<unknown>>();
  return parseQrPreview(res.data);
}

/** Dynamic preview body is ONLY `{id, customizes}` — the server always
 *  replaces the content with the short link (CONTRACT §2.2). */
export async function previewDynamicQr(
  id: string,
  customizes: Record<string, unknown>,
): Promise<QrPreviewResult> {
  const res = await api
    .post(ENDPOINTS.dynamic.preview, { json: { id, customizes } })
    .json<ApiResponse<unknown>>();
  return parseQrPreview(res.data);
}

/**
 * The v1 save gate: create/edit reject unscannable designs with
 * `400 { error: { code: "qr_unreadable", warnings } }`. Other 400s carry an
 * error OBJECT or a plain STRING — read all shapes tolerantly. Null when the
 * error is not a QR-unreadable rejection.
 */
export interface QrUnreadableError {
  message: string;
  warnings: QrWarning[];
}

export async function readQrUnreadable(e: unknown): Promise<QrUnreadableError | null> {
  if (!(e instanceof HTTPError)) return null;
  try {
    const body = (await e.response.clone().json()) as {
      error?:
        | string
        | {
            code?: string;
            message?: string;
            warnings?: { severity?: string; code?: string; message?: string }[];
          };
    };
    const err = body?.error;
    if (err == null || typeof err === "string") return null;
    if (err.code !== "qr_unreadable") return null;
    return {
      message: err.message ?? "",
      warnings: (err.warnings ?? []).map((w) => ({
        severity: w.severity === "error" ? "error" : "warning",
        code: w.code ?? "",
        message: w.message ?? "",
      })),
    };
  } catch {
    return null;
  }
}

export interface UserQr {
  _id: string;
  name: string;
  status: boolean;
  // create returns the config id (string); the listing returns the full config object.
  qrCode: string | QrConfig;
  user: string;
  type: string;
  data: Record<string, unknown>;
  /**
   * Stored VERBATIM — v1 platform payloads and legacy flat blobs both live
   * here. Parse with `styleFromWire` (tolerant, maps legacy); when an
   * operation must NOT restyle (rename of a legacy record) this raw object is
   * posted back untouched through the legacy route.
   */
  customizes: Record<string, unknown>;
  pngImage: string;
  svgImage: string;
  /** "radiolingo-v1" | "legacy" — absent on old responses. */
  engine?: string;
  /** "static" | "dynamic" — absent on old responses. */
  qrType?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * v1 edits keep the S3 keys STABLE, so every cache keyed on the bare URL
 * (browser, CDN edge) keeps serving the OLD design after a restyle. Version
 * the URL by updatedAt (mobile a504fa72) — and derive download filenames from
 * the pathname, never the full URL, so `?v=` can't leak into them.
 */
function versionedUrl(path: string, qr: UserQr): string {
  if (!path) return "";
  const stamp = Date.parse(qr.updatedAt || qr.createdAt || "") || 0;
  return `${cdnUrl(path)}?v=${stamp}`;
}

export function qrPngUrl(qr: UserQr): string {
  return versionedUrl(qr.pngImage, qr);
}

export function qrSvgUrl(qr: UserQr): string {
  return versionedUrl(qr.svgImage, qr);
}

/** Is this record still on the legacy engine? (absent engine = legacy-era) */
export function isLegacyQr(qr: UserQr): boolean {
  return qr.engine !== "radiolingo-v1";
}

/**
 * Rename WITHOUT restyling. A legacy record must go through the LEGACY route
 * with its stored `customizes` verbatim — the v1 route would migrate and
 * re-render it, visibly changing a design the user may already have in print.
 * A v1 record renames through v1 with its stored payload as-is.
 */
export async function renameQrCode(qr: UserQr, name: string): Promise<UserQr> {
  const qrType: QrType = qr.qrType === "dynamic" ? "dynamic" : "static";
  const qrcode = typeof qr.qrCode === "object" ? qr.qrCode._id : qr.qrCode;
  const payload = {
    id: qr._id,
    name,
    qrcode,
    type: qr.type,
    data: qr.data ?? {},
    customizes: qr.customizes ?? {},
  };
  const path = isLegacyQr(qr)
    ? LEGACY_ENDPOINTS[qrType].edit
    : ENDPOINTS[qrType].edit;
  const res = await api.post(path, { json: payload }).json<ApiResponse<{ userQr: UserQr }>>();
  return res.data?.userQr ?? { ...qr, name };
}

export interface CreateQrPayload extends QrDataPayload {
  name: string;
  qrcode: string; // the config `_id`
}

/** POST .../create → saves and returns the created userQr. */
export async function createQrCode(
  payload: CreateQrPayload,
  qrType: QrType = "static",
): Promise<UserQr> {
  const res = await api
    .post(ENDPOINTS[qrType].create, { json: payload })
    .json<ApiResponse<{ userQr: UserQr }>>();
  return res.data.userQr;
}

export interface EditQrPayload extends CreateQrPayload {
  id: string;
}

/** POST .../edit (static) or .../update (dynamic) → updates an existing userQr. */
export async function editQrCode(
  payload: EditQrPayload,
  qrType: QrType = "static",
): Promise<UserQr> {
  const res = await api
    .post(ENDPOINTS[qrType].edit, { json: payload })
    .json<ApiResponse<{ userQr: UserQr }>>();
  return res.data.userQr;
}

/** POST qr-code/user/delete → removes a saved QR (same endpoint for static & dynamic). */
export async function deleteQrCode(id: string): Promise<void> {
  await api.post("qr-code/user/delete", { json: { id } });
}

/** Production domain used for dynamic QR redirect links. */
const QSHOT_DOMAIN = "qshot.com";

/**
 * The target URL a saved QR points to, mirroring the mobile
 * `GeneratedQrUtils.getLaunchUri`. Returns null when the QR isn't launchable.
 */
export function getLaunchUrl(qr: UserQr): string | null {
  const cfg = typeof qr.qrCode === "object" ? qr.qrCode : null;
  if (cfg?.qr_type === "dynamic") {
    return `https://qr.${QSHOT_DOMAIN}/${qr._id}`;
  }
  const d = qr.data ?? {};
  const s = (k: string) => (d[k] == null ? "" : String(d[k]));
  switch (qr.type) {
    case "text": {
      let url = s("text");
      if (!url) return null;
      if (cfg?.name === "URL" && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      return url;
    }
    case "sms":
      return s("phone")
        ? `sms:${s("phone")}?body=${encodeURIComponent(s("message"))}`
        : null;
    case "call":
      return s("phone") ? `tel:${s("phone")}` : null;
    case "telegram":
      return s("username") ? `https://t.me/${s("username")}` : null;
    case "email":
      return s("email")
        ? `mailto:${s("email")}?subject=${encodeURIComponent(
            s("subject"),
          )}&body=${encodeURIComponent(s("message"))}`
        : null;
    default:
      return null;
  }
}

/**
 * Download a stored QR image. The URL must be the VERSIONED one
 * (`qrPngUrl`/`qrSvgUrl`) so a restyle never serves a stale cache; the
 * filename is derived by the caller from the record, never from the URL.
 */
export async function downloadQrFile(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
