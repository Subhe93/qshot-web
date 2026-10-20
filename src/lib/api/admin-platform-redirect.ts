import { HTTPError } from "ky";
import { api, httpErrorBody } from "./client";

/**
 * ADMIN API for the "Platform redirect cards" feature —
 * `@Controller('dashboard/platform-redirect')` (AuthGuard + AdminGuard).
 *
 * Contract: docs/new section/api-design.md §5 (routes), §6 (error codes),
 * §7 (xlsx files); integration-guide.md §4 (platform statuses), §6 (envelopes).
 * Response shapes below were confirmed against the live dev API on 2026-10-20.
 *
 * Success envelope: `{ success: true, data }`. Feature refusals carry their
 * own HTTP status and `{ success:false, error:{ code, message, ...extra } }`;
 * framework refusals are HTTP 400 with `{ error:{ name, description } }`.
 * Use `parseAdminError()` and branch on `code` / `name` — never show the
 * server's English `message` to users.
 */

const BASE = "dashboard/platform-redirect";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const PLATFORM_CODES = [
  "google_reviews",
  "instagram",
  "tiktok",
  "whatsapp",
  "facebook",
  "snapchat",
] as const;
export type PlatformCode = (typeof PLATFORM_CODES)[number];

export const PLATFORM_STATUSES = ["active", "paused", "hidden"] as const;
export type PlatformStatus = (typeof PLATFORM_STATUSES)[number];

export const CODE_STATUSES = ["unassigned", "assigned", "disabled"] as const;
export type CodeStatus = (typeof CODE_STATUSES)[number];

export const CODE_SOURCES = ["pre_printed", "generated"] as const;
export type CodeSource = (typeof CODE_SOURCES)[number];

export const BATCH_STATUSES = ["generated", "printed", "void"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/** `GeneratePlatformBatchDto.count` bounds — confirmed by the live 400 messages
 *  ("count must not be less than 1", "count must not be greater than 5000"). */
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 5000;
/** `note` / `reason` / override label max lengths (§8 DTOs). */
export const MAX_NOTE_LENGTH = 200;
export const MAX_REASON_LENGTH = 200;
export const MAX_LABEL_LENGTH = 60;

// ─── Shapes (observed live) ──────────────────────────────────────────────────

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CodeCounts {
  total: number;
  unassigned: number;
  assigned: number;
  disabled: number;
}

/** One row of `GET /platforms` (rich admin view). */
export interface AdminPlatform {
  platform: PlatformCode;
  path: string;
  label: string;
  purpose: "review" | "follow" | "message" | string;
  status: PlatformStatus;
  enabled: boolean;
  urlHint: string;
  examples: string[];
  allowedHosts: string[];
  order: number;
  defaultStatus: PlatformStatus;
  overrides: {
    label: string | null;
    urlHint: string | null;
    order: number | null;
  };
  /** Human-readable accepted link shapes, e.g. "Profile (instagram.com/{username})". */
  rules: string[];
  counts: CodeCounts;
  linksCount: number;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

/** `PATCH /platforms/:platform` returns the public (lean) platform row. */
export interface PublicPlatform {
  platform: PlatformCode;
  path: string;
  label: string;
  purpose: string;
  status: PlatformStatus;
  enabled: boolean;
  urlHint: string;
  examples: string[];
  allowedHosts: string[];
  order: number;
}

export interface PlatformPatch {
  status?: PlatformStatus;
  /** `null` clears the override. */
  label?: string | null;
  urlHint?: string | null;
  order?: number | null;
}

/** One entry of `GET /platforms/:platform/history`. Shape inferred (the live
 *  list was empty); read defensively. */
export interface PlatformHistoryEntry {
  action?: string;
  at?: string;
  by?: string | null;
  byEmail?: string | null;
  from?: unknown;
  to?: unknown;
  changes?: Record<string, unknown>;
  note?: string | null;
  [key: string]: unknown;
}

export interface PendingBatchSummary {
  _id: string;
  platform: PlatformCode;
  requested: number;
  generated: number;
  note: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface PlatformStats {
  total: number;
  unassigned: number;
  assigned: number;
  disabled: number;
  pre_printed: number;
  generated: number;
  orphaned: number;
  /** Share of the 90 000-code space already issued, in percent (e.g. 0.22). */
  spaceUsedPercent: number;
  pendingBatch: PendingBatchSummary | null;
}

export interface StatsResponse {
  platforms: Partial<Record<PlatformCode, PlatformStats>>;
  totals: Omit<PlatformStats, "pendingBatch">;
}

export interface Batch {
  _id: string;
  platform: PlatformCode;
  requested: number;
  generated: number;
  note: string | null;
  status: BatchStatus;
  createdBy: string;
  createdByEmail: string | null;
  printedAt?: string | null;
  printedBy?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  exportCount: number;
  lastExportedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BatchWithCounts = Batch & { counts: CodeCounts };

export interface CodeHistoryEntry {
  action: string;
  at: string;
  by?: string | null;
  note?: string | null;
  reason?: string | null;
  [key: string]: unknown;
}

export interface CodeUser {
  _id: string;
  name?: string | null;
  email?: string | null;
  isCompany?: boolean;
}

export interface CodeLink {
  platform?: PlatformCode;
  url: string;
  host: string;
  updatedAt?: string;
}

/** Unified admin code row (`GET /codes`, `GET /batches/:id` codes, `GET /codes/:platform/:code`). */
export interface AdminCode {
  _id: string;
  platform: PlatformCode;
  code: string;
  cardUrl: string;
  status: CodeStatus;
  source: CodeSource;
  label: string | null;
  batch: {
    _id: string;
    note: string | null;
    status: BatchStatus;
    createdAt: string;
  } | null;
  userId: string | null;
  user: CodeUser | null;
  userDeleted: boolean;
  link: CodeLink | null;
  hits: number;
  lastHitAt: string | null;
  assignedAt: string | null;
  createdAt: string;
  disabledAt: string | null;
  disabledReason: string | null;
  /** Only on the single-code route. */
  history?: CodeHistoryEntry[];
}

export interface AccountView {
  user: CodeUser;
  links: CodeLink[];
  codes: AdminCode[];
}

export interface ByHostLink {
  user: CodeUser | null;
  platform: PlatformCode;
  url: string;
  host: string;
  updatedAt: string;
}

// ─── Error parsing ───────────────────────────────────────────────────────────

/** A feature refusal (`error.code`) or a framework refusal (`error.name`). */
export type AdminApiError =
  | {
      kind: "code";
      status: number;
      code: string;
      message: string;
      extra: Record<string, unknown>;
    }
  | {
      kind: "framework";
      status: number;
      name: string;
      messages: string[];
    }
  | { kind: "network"; status: 0; message: string }
  | { kind: "unknown"; status: number; message: string };

type ErrorBody = {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
    name?: string;
    description?: { message?: string | string[] };
    [key: string]: unknown;
  };
} | null;

function classify(status: number, body: ErrorBody, fallback: string): AdminApiError {
  const err = body?.error;
  if (err && typeof err.code === "string") {
    const { code, message, ...extra } = err;
    return { kind: "code", status, code, message: typeof message === "string" ? message : "", extra };
  }
  if (err && typeof err.name === "string") {
    const m = err.description?.message;
    return {
      kind: "framework",
      status,
      name: err.name,
      messages: Array.isArray(m) ? m : typeof m === "string" ? [m] : [],
    };
  }
  return { kind: "unknown", status, message: fallback };
}

function nonHttp(e: unknown): AdminApiError {
  if (e instanceof TypeError) return { kind: "network", status: 0, message: e.message };
  return { kind: "unknown", status: 0, message: e instanceof Error ? e.message : String(e) };
}

/**
 * Synchronous variant for render-time use (`useMemo`): ky ≥ 2 pre-reads the
 * error body into `HTTPError.data`, so no await is needed in practice.
 */
export function parseAdminErrorSync(e: unknown): AdminApiError {
  if (e instanceof HTTPError) {
    let data: unknown = e.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }
    return classify(e.response.status, (data ?? null) as ErrorBody, e.message);
  }
  return nonHttp(e);
}

/** Classify any thrown value from this module into a UI-mappable error. */
export async function parseAdminError(e: unknown): Promise<AdminApiError> {
  if (e instanceof HTTPError) {
    const status = e.response.status;
    const body = (await httpErrorBody(e)) as
      | {
          success?: boolean;
          error?: {
            code?: string;
            message?: string;
            name?: string;
            description?: { message?: string | string[] };
            [key: string]: unknown;
          };
        }
      | null;
    return classify(status, body, e.message);
  }
  return nonHttp(e);
}

/** react-query `retry` option: never retry a 4xx (it is a deliberate refusal), once otherwise. */
export function retryUnlessRefused(failureCount: number, error: unknown): boolean {
  if (error instanceof HTTPError && error.response.status < 500) return false;
  return failureCount < 1;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Envelope<T> = { success: boolean; data: T };

/** Drop undefined / empty-string params so the DTO validators never see "". */
function clean(params: object) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

async function get<T>(path: string, searchParams?: Record<string, string>) {
  const res = await api.get(`${BASE}/${path}`, { searchParams }).json<Envelope<T>>();
  return res.data;
}

async function send<T>(method: "post" | "patch" | "delete", path: string, json?: unknown) {
  const res = await api(`${BASE}/${path}`, {
    method,
    json: json === undefined ? undefined : json,
  }).json<Envelope<T>>();
  return res.data;
}

export interface XlsxDownload {
  blob: Blob;
  /** From `Content-Disposition` (exposed via CORS); falls back to §7 naming. */
  filename: string;
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function downloadXlsx(path: string, searchParams: Record<string, string>, fallbackName: string) {
  const res = await api.get(`${BASE}/${path}`, { searchParams });
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get("content-disposition")) ?? fallbackName;
  return { blob, filename } satisfies XlsxDownload;
}

/** Trigger a browser "Save as" for a downloaded file. */
export function saveBlob({ blob, filename }: XlsxDownload) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Overview ────────────────────────────────────────────────────────────────

export function getPlatformStats(platform?: PlatformCode) {
  return get<StatsResponse>("stats", clean({ platform }));
}

export interface ExportFilters {
  platform?: PlatformCode | "";
  status?: CodeStatus | "";
  source?: CodeSource | "";
  batchId?: string;
  userEmail?: string;
}

/** `GET /export` — `@Throttle(5, 300)`; `EXPORT_TOO_LARGE` carries `max`. */
export function exportAllCodes(filters: ExportFilters = {}) {
  return downloadXlsx("export", clean(filters), `qshot-platform-redirect-codes-${today()}.xlsx`);
}

// ─── Platforms ───────────────────────────────────────────────────────────────

export async function listAdminPlatforms() {
  const d = await get<{ platforms: AdminPlatform[] }>("platforms");
  return d.platforms;
}

export function updatePlatform(platform: PlatformCode, patch: PlatformPatch) {
  return send<{ platform: PublicPlatform }>("patch", `platforms/${platform}`, patch);
}

export async function getPlatformHistory(platform: PlatformCode) {
  const d = await get<{ platform: PlatformCode; history: PlatformHistoryEntry[] }>(
    `platforms/${platform}/history`,
  );
  return d.history ?? [];
}

// ─── Batches ─────────────────────────────────────────────────────────────────

export interface ListBatchesParams {
  platform?: PlatformCode | "";
  status?: BatchStatus | "";
  page?: number;
  limit?: number;
}

export function listBatches(params: ListBatchesParams = {}) {
  return get<{ batches: BatchWithCounts[]; pagination: Pagination }>("batches", clean(params));
}

export interface RequestBatchBody {
  platform: PlatformCode;
  count: number;
  note?: string;
  /** Overrides `PENDING_BATCH` (a `generated` batch of the same platform not yet confirmed). */
  force?: boolean;
}

export function requestBatch(body: RequestBatchBody) {
  return send<{ batch: Batch; requested: number; generated: number; shortfall: number }>(
    "post",
    "batches",
    body,
  );
}

export interface BatchDetailParams {
  status?: CodeStatus | "";
  page?: number;
  limit?: number;
}

export function getBatch(batchId: string, params: BatchDetailParams = {}) {
  return get<{ batch: Batch; counts: CodeCounts; codes: AdminCode[]; pagination: Pagination }>(
    `batches/${encodeURIComponent(batchId)}`,
    clean(params),
  );
}

/** `GET /batches/:id/export` — `@Throttle(10, 300)`; bumps `exportCount`/`lastExportedAt`. */
export function exportBatch(batch: Pick<Batch, "_id" | "platform">) {
  return downloadXlsx(
    `batches/${encodeURIComponent(batch._id)}/export`,
    {},
    `qshot-platform-redirect-batch-${batch.platform}-${batch._id.slice(-6)}-${today()}.xlsx`,
  );
}

export function markBatchPrinted(batchId: string) {
  return send<{ batch: Batch; changed: boolean }>("patch", `batches/${encodeURIComponent(batchId)}/printed`);
}

export function voidBatch(batchId: string, reason?: string) {
  return send<{ batch: Batch; disabledCount: number }>(
    "patch",
    `batches/${encodeURIComponent(batchId)}/void`,
    reason ? { reason } : {},
  );
}

// ─── Cards (codes) ───────────────────────────────────────────────────────────

export interface ListCodesParams extends ExportFilters {
  /** Prefix match, max 5 chars. */
  code?: string;
  page?: number;
  limit?: number;
}

export function listCodes(params: ListCodesParams = {}) {
  return get<{ codes: AdminCode[]; pagination: Pagination }>("codes", clean(params));
}

export async function getCode(platform: PlatformCode, code: string) {
  const d = await get<{ code: AdminCode }>(`codes/${platform}/${encodeURIComponent(code)}`);
  return d.code;
}

export function disableCode(platform: PlatformCode, code: string, reason?: string) {
  return send<{ code: AdminCode; changed: boolean }>(
    "patch",
    `codes/${platform}/${encodeURIComponent(code)}/disable`,
    reason ? { reason } : {},
  );
}

export function enableCode(platform: PlatformCode, code: string) {
  return send<{ code: AdminCode; changed: boolean }>(
    "patch",
    `codes/${platform}/${encodeURIComponent(code)}/enable`,
  );
}

export function unlinkCode(platform: PlatformCode, code: string, reason?: string) {
  return send<{ code: AdminCode; previousUserId: string | null }>(
    "patch",
    `codes/${platform}/${encodeURIComponent(code)}/unlink`,
    reason ? { reason } : {},
  );
}

// ─── Support & abuse ─────────────────────────────────────────────────────────

export function getAccountView(userId: string) {
  return get<AccountView>(`accounts/${encodeURIComponent(userId)}`);
}

/** Audit-logged removal of an account's link for one platform. */
export function removeAccountLink(userId: string, platform: PlatformCode, reason?: string) {
  return send<{ removed: boolean }>(
    "delete",
    `accounts/${encodeURIComponent(userId)}/links/${platform}`,
    reason ? { reason } : {},
  );
}

export interface ByHostParams {
  host: string;
  page?: number;
  limit?: number;
}

/** Suffix match on the saved link host. */
export function listLinksByHost(params: ByHostParams) {
  return get<{ links: ByHostLink[]; pagination: Pagination }>("by-host", clean(params));
}
