import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

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
// Customizes (style payload) — mirrors mobile Customizes.
// ---------------------------------------------------------------------------

export interface Customizes {
  foregroundColor: string;
  eyeInternalColor: string;
  eyeExternalColor: string;
  backgroundColor: string;
  module: string;
  finder: string;
  finderDot: string;
  shape: string;
  frameColor: string;
  logoUrl: string;
  logoPositionX: string;
  logoPositionY: string;
  logoRotate: string;
  advancedShape: string;
  text: string;
  textColor: string;
  fontFamily: string;
  textSize: number;
  fontVariant: string;
  advancedShapeDropShadow: boolean;
  advancedShapeFrameColor: string;
}

/** Default style, matching mobile `Customizes.newInstance()`. */
export const DEFAULT_CUSTOMIZES: Customizes = {
  foregroundColor: "#000000",
  eyeInternalColor: "#000000",
  eyeExternalColor: "#000000",
  backgroundColor: "#FFFFFF",
  module: "square",
  finder: "default",
  finderDot: "default",
  shape: "none",
  frameColor: "#000000",
  logoUrl: "",
  logoPositionX: "0.5",
  logoPositionY: "0.5",
  logoRotate: "0.0",
  advancedShape: "none",
  text: "Scan Me",
  textColor: "#000000",
  fontFamily: "Roboto",
  textSize: 5,
  fontVariant: "",
  advancedShapeDropShadow: false,
  advancedShapeFrameColor: "#000000",
};

/** Selectable style options, matching the mobile enums. */
export const MODULE_OPTIONS = [
  "square",
  "dots",
  "diamond",
  "fish",
  "fourTriangles",
  "horizontal-lines",
  "rhombus",
  "roundness",
  "star-5",
  "star-7",
  "tree",
  "triangle",
  "triangle-end",
  "vertical-lines",
] as const;

export const FINDER_OPTIONS = [
  "default",
  "circle",
  "circle-dots",
  "eye-shaped",
  "octagon",
  "rounded-corners",
  "water-drop",
  "whirlpool",
  "zigzag",
] as const;

export const FINDER_DOT_OPTIONS = [
  "default",
  "circle",
  "eye-shaped",
  "octagon",
  "rounded-corners",
  "water-drop",
  "whirlpool",
  "zigzag",
] as const;

// ---------------------------------------------------------------------------
// Preview + create — mirrors mobile QrDataSource.generate / create.
// ---------------------------------------------------------------------------

export interface QrDataPayload {
  type: string; // the config `tag`
  data: Record<string, unknown>;
  customizes: Customizes;
}

/** Endpoints differ between static and dynamic QR codes (mirrors the two mobile data sources). */
const ENDPOINTS = {
  static: {
    preview: "qr-code/user/preview",
    create: "qr-code/user/create",
    edit: "qr-code/user/edit",
  },
  dynamic: {
    preview: "qr-code-dynamic/user/preview",
    create: "qr-code-dynamic/user/create",
    edit: "qr-code-dynamic/user/update",
  },
} as const;

/** POST .../preview → returns the rendered SVG markup as plain text. */
export async function previewQrCode(
  payload: QrDataPayload,
  qrType: QrType = "static",
): Promise<string> {
  return api.post(ENDPOINTS[qrType].preview, { json: payload }).text();
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
  customizes: Customizes;
  pngImage: string;
  svgImage: string;
  createdAt: string;
  updatedAt: string;
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
