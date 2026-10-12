import { HTTPError, NetworkError, TimeoutError } from "ky";
import { useAuthStore } from "@/stores/auth-store";
import { api, httpErrorBody, isWrapped401Body } from "./client";
import type { SchemaValidationFailure, SchemaValidationIssue } from "./profiles";

/**
 * `q-profile/history/*` — the website change history (contract
 * `docs/profile-history-api-contract.md`, §4–§5, §9).
 *
 * The server records history by itself on every save; this module only READS
 * it and calls the restore / pin routes. Every function throws
 * `HistoryApiError` — branch on its `code`, never on the HTTP status.
 *
 * Readers are tolerant (mobile `fromJson` discipline): a missing array is
 * `[]`, a missing `actor` is `null`, `seq` is a number, dates stay strings.
 * The UI formats them; nothing here depends on the browser.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Types (§4, §5)
 * ──────────────────────────────────────────────────────────────────────────── */

export type HistorySource = "editor" | "initial" | "external" | "restore" | "page_deleted";
export type HistoryActorRole = "owner" | "company" | "admin";

export interface HistoryBlockRef {
  id: string;
  /** Block type as stored (`HeaderModule`, `social_links`, …). */
  type: string;
}

export interface HistorySummary {
  added: HistoryBlockRef[];
  removed: HistoryBlockRef[];
  edited: HistoryBlockRef[];
  moved: boolean;
  /** Top-level `settings` keys that changed (main page only). */
  settings: string[];
  /** Top-level `info` keys other than `modules` that changed (rare). */
  info: string[];
}

export interface HistoryActor {
  userId: string;
  role: HistoryActorRole;
}

/** `page_deleted` rows only. */
export interface HistoryDeletedPage {
  urlName: string;
  listName: string;
  listViewStatus: boolean;
  order: number;
  /** Set once the page has been recreated (§5.8) — hide "Restore page" then. */
  restoredPageId: string | null;
}

export interface HistoryPinned {
  label: string;
  pinnedAt: string;
  pinnedBy: string;
}

export interface HistoryRow {
  /** Read from `_id` — the `historyId` every other route takes. */
  id: string;
  profileId: string;
  /** `"main"` or `"page:<pageId>"`. */
  document: string;
  /** The `<pageId>` of a `page:<pageId>` document; `null` for `main`. */
  pageId: string | null;
  seq: number;
  source: HistorySource;
  /** `null` on `initial` / `external` rows. */
  actor: HistoryActor | null;
  summary: HistorySummary;
  startedAt: string;
  endedAt: string;
  saveCount: number;
  /** `restore` rows: the row that was restored. */
  restoredFrom: string | null;
  page: HistoryDeletedPage | null;
  pinned: HistoryPinned | null;
}

/** A row from `show`: the page content at the end of the session. */
export interface HistoryRowContent extends HistoryRow {
  /** Normal page format — `info.modules` holds the blocks. */
  info: Record<string, unknown>;
  /** Main page only; `null` for sub-pages. */
  settings: Record<string, unknown> | null;
}

export type HistoryChange = "added" | "removed" | "edited";

export interface HistoryDiffBlock {
  id: string;
  type: string;
  change: HistoryChange;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface HistoryDiff {
  historyId: string;
  /** `null` on the first row of a page (no earlier state). */
  previous: { id: string; seq: number } | null;
  blocks: HistoryDiffBlock[];
  /** Present only when blocks were moved. */
  order: { before: string[]; after: string[] } | null;
  settings: { key: string; before: unknown; after: unknown }[];
  info: { key: string; before: unknown; after: unknown }[];
}

export interface HistoryPage {
  history: HistoryRow[];
  /** Send back as `cursor`; `null` on the last page. */
  nextCursor: number | null;
}

export interface HistoryRestoreResult {
  /** `false`: the page already equals that state; nothing was written. */
  changed: boolean;
  /** `""` when the server omits it (the live server does on `changed: false`). */
  document: string;
}

export interface HistoryRestoredPage {
  /** The NEW page id (read from `_id`). */
  id: string;
  /** May differ from the deleted page's name (`-2`, `-3`, …) — show it. */
  urlName: string;
  listName: string;
  listViewStatus: boolean;
  order: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tolerant readers
 * ──────────────────────────────────────────────────────────────────────────── */

type Json = Record<string, unknown>;

function isMap(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStr(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function readStrOrNull(value: unknown): string | null {
  const text = readStr(value);
  return text === "" ? null : text;
}

function readInt(value: unknown, fallback = 0): number {
  return readIntOrNull(value) ?? fallback;
}

function readIntOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return null;
}

function readBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function readStrList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => readStr(v)).filter((v) => v !== "");
}

function readMapOrNull(value: unknown): Json | null {
  return isMap(value) ? value : null;
}

const SOURCES: readonly HistorySource[] = ["editor", "initial", "external", "restore", "page_deleted"];
const ROLES: readonly HistoryActorRole[] = ["owner", "company", "admin"];
const CHANGES: readonly HistoryChange[] = ["added", "removed", "edited"];

/**
 * A `source` this client does not know reads as `external` ("Updated by the
 * system"): it still gets a badge and never passes for a plain edit.
 */
function readSource(value: unknown): HistorySource {
  return (SOURCES as readonly string[]).includes(readStr(value))
    ? (value as HistorySource)
    : "external";
}

/** `"page:<id>"` → `<id>`; anything else (`"main"`, garbage) → `null`. */
export function historyPageIdOf(document: string): string | null {
  if (!document.startsWith("page:")) return null;
  const id = document.slice("page:".length);
  return id === "" ? null : id;
}

/** The inverse: `main` or `page:<pageId>`, for the `document` filter. */
export function historyDocumentOf(pageId: string | null | undefined): string {
  return pageId ? `page:${pageId}` : "main";
}

function readBlockRefs(value: unknown): HistoryBlockRef[] {
  if (!Array.isArray(value)) return [];
  const out: HistoryBlockRef[] = [];
  for (const item of value) {
    if (!isMap(item)) continue;
    const id = readStr(item.id ?? item._id);
    if (!id) continue;
    out.push({ id, type: readStr(item.type) });
  }
  return out;
}

export function readHistorySummary(value: unknown): HistorySummary {
  const raw = isMap(value) ? value : {};
  return {
    added: readBlockRefs(raw.added),
    removed: readBlockRefs(raw.removed),
    edited: readBlockRefs(raw.edited),
    moved: readBool(raw.moved, false),
    settings: readStrList(raw.settings),
    info: readStrList(raw.info),
  };
}

function readActor(value: unknown): HistoryActor | null {
  if (!isMap(value)) return null;
  const userId = readStr(value.userId ?? value.user_id);
  if (!userId) return null;
  const role = readStr(value.role);
  return {
    userId,
    role: (ROLES as readonly string[]).includes(role) ? (role as HistoryActorRole) : "owner",
  };
}

function readDeletedPage(value: unknown): HistoryDeletedPage | null {
  if (!isMap(value)) return null;
  return {
    urlName: readStr(value.urlName),
    listName: readStr(value.listName),
    listViewStatus: readBool(value.listViewStatus, true),
    order: readInt(value.order, 0),
    restoredPageId: readStrOrNull(value.restoredPageId),
  };
}

export function readHistoryPinned(value: unknown): HistoryPinned | null {
  if (!isMap(value)) return null;
  return {
    label: readStr(value.label),
    pinnedAt: readStr(value.pinnedAt),
    pinnedBy: readStr(value.pinnedBy),
  };
}

/** One §4 row (without content). Unknown shapes degrade, never throw. */
export function readHistoryRow(value: unknown): HistoryRow {
  const raw = isMap(value) ? value : {};
  const document = readStr(raw.document, "main") || "main";
  return {
    id: readStr(raw._id ?? raw.id),
    profileId: readStr(raw.profileId),
    document,
    pageId: historyPageIdOf(document),
    seq: readInt(raw.seq, 0),
    source: readSource(raw.source),
    actor: readActor(raw.actor),
    summary: readHistorySummary(raw.summary),
    startedAt: readStr(raw.startedAt),
    endedAt: readStr(raw.endedAt),
    saveCount: readInt(raw.saveCount, 0),
    restoredFrom: readStrOrNull(raw.restoredFrom),
    page: readDeletedPage(raw.page),
    pinned: readHistoryPinned(raw.pinned),
  };
}

/** A `show` row: the §4 row plus `info` / `settings`. */
export function readHistoryRowContent(value: unknown): HistoryRowContent {
  const raw = isMap(value) ? value : {};
  return {
    ...readHistoryRow(raw),
    info: readMapOrNull(raw.info) ?? {},
    settings: readMapOrNull(raw.settings),
  };
}

export function readHistoryPage(value: unknown): HistoryPage {
  const raw = isMap(value) ? value : {};
  const list = Array.isArray(raw.history) ? raw.history : [];
  return {
    history: list.map(readHistoryRow),
    nextCursor: readIntOrNull(raw.next_cursor ?? raw.nextCursor),
  };
}

function readDiffBlocks(value: unknown): HistoryDiffBlock[] {
  if (!Array.isArray(value)) return [];
  const out: HistoryDiffBlock[] = [];
  for (const item of value) {
    if (!isMap(item)) continue;
    const change = readStr(item.change);
    if (!(CHANGES as readonly string[]).includes(change)) continue;
    const before = readMapOrNull(item.before);
    const after = readMapOrNull(item.after);
    const id = readStr(item.id ?? after?.id ?? before?.id);
    if (!id) continue;
    out.push({
      id,
      type: readStr(item.type ?? after?.type ?? before?.type),
      change: change as HistoryChange,
      before,
      after,
    });
  }
  return out;
}

function readKeyChanges(value: unknown): { key: string; before: unknown; after: unknown }[] {
  if (!Array.isArray(value)) return [];
  const out: { key: string; before: unknown; after: unknown }[] = [];
  for (const item of value) {
    if (!isMap(item)) continue;
    const key = readStr(item.key);
    if (!key) continue;
    out.push({
      key,
      before: item.before === undefined ? null : item.before,
      after: item.after === undefined ? null : item.after,
    });
  }
  return out;
}

export function readHistoryDiff(value: unknown): HistoryDiff {
  const raw = isMap(value) ? value : {};
  const previous = isMap(raw.previous) ? raw.previous : null;
  const previousId = previous ? readStr(previous._id ?? previous.id) : "";
  const order = isMap(raw.order) ? raw.order : null;
  return {
    historyId: readStr(raw.historyId),
    previous: previous && previousId ? { id: previousId, seq: readInt(previous.seq, 0) } : null,
    blocks: readDiffBlocks(raw.blocks),
    order: order ? { before: readStrList(order.before), after: readStrList(order.after) } : null,
    settings: readKeyChanges(raw.settings),
    info: readKeyChanges(raw.info),
  };
}

export function readHistoryRestoreResult(value: unknown): HistoryRestoreResult {
  const raw = isMap(value) ? value : {};
  return {
    changed: readBool(raw.changed, true),
    document: readStr(raw.document),
  };
}

export function readHistoryRestoredPage(value: unknown): HistoryRestoredPage {
  const raw = isMap(value) ? value : {};
  return {
    id: readStr(raw._id ?? raw.id),
    urlName: readStr(raw.urlName),
    listName: readStr(raw.listName),
    listViewStatus: readBool(raw.listViewStatus, true),
    order: readInt(raw.order, 0),
  };
}

/**
 * Strip the `{ success, data }` envelope. A bare payload (no `data` key) is
 * tolerated for the day the envelope changes; a non-object body reads as `{}`.
 */
export function readHistoryEnvelope(body: unknown): Json {
  if (!isMap(body)) return {};
  if ("data" in body) return isMap(body.data) ? body.data : {};
  return body;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Errors (§9)
 * ──────────────────────────────────────────────────────────────────────────── */

export type HistoryErrorCode =
  | "forbidden"
  | "not_found"
  | "conflict"
  /** 422 on `restore` of a `page_deleted` row — use `restoreHistoryPage`. */
  | "deleted_page"
  /** 422 `ProfileValidationError`: the old state fails today's schema. */
  | "validation"
  | "bad_request"
  /** Missing / invalid token (arrives as HTTP 400, §9 shape 3). */
  | "unauthorized"
  | "network"
  | "unknown";

export class HistoryApiError extends Error {
  readonly code: HistoryErrorCode;
  readonly status: number | null;
  /** The server's own sentence, when it sent one. English; may change. */
  readonly serverMessage: string | null;
  /** Filled for `code === "validation"`. */
  readonly validation: SchemaValidationFailure | null;

  constructor(init: {
    code: HistoryErrorCode;
    status?: number | null;
    serverMessage?: string | null;
    validation?: SchemaValidationFailure | null;
    message?: string;
    cause?: unknown;
  }) {
    super(init.message ?? init.serverMessage ?? `History request failed (${init.code})`, {
      cause: init.cause,
    });
    this.name = "HistoryApiError";
    this.code = init.code;
    this.status = init.status ?? null;
    this.serverMessage = init.serverMessage ?? null;
    this.validation = init.validation ?? null;
  }
}

/** The exact sentence the server uses for a `restore` of a `page_deleted` row. */
const DELETED_PAGE_MESSAGE = /this page was deleted/i;

/** Text or bytes back into the map the parser expects; else untouched. */
function decodeBody(body: unknown): unknown {
  if (isMap(body)) return body;
  if (typeof body !== "string" || !body.trim()) return body;
  try {
    const decoded: unknown = JSON.parse(body);
    return isMap(decoded) ? decoded : body;
  } catch {
    return body;
  }
}

/** A `message` that is a list (NestJS 400) is joined; else the first string. */
function joinMessage(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.map((v) => readStr(v)).filter((v) => v !== "");
    return parts.length ? parts.join(", ") : null;
  }
  return readStrOrNull(value);
}

/** `error.name` when `error` is an object (§9 shapes 2 and 3). */
function errorNameOf(body: unknown): string | null {
  if (!isMap(body) || !isMap(body.error)) return null;
  return readStrOrNull(body.error.name);
}

/**
 * The most useful sentence in a failure body. Shape 1: `error` is a string.
 * Shapes 2–3: `error.description.message` (string or list). Fallbacks: a
 * top-level `message`, a text body.
 */
export function historyServerMessage(body: unknown): string | null {
  if (isMap(body)) {
    const error = body.error;
    if (typeof error === "string") return readStrOrNull(error);
    if (isMap(error)) {
      const description = error.description;
      if (isMap(description)) {
        const fromDescription = joinMessage(description.message);
        if (fromDescription) return fromDescription;
      } else if (typeof description === "string") {
        return readStrOrNull(description);
      }
      const fromError = joinMessage(error.message);
      if (fromError) return fromError;
    }
    return joinMessage(body.message);
  }
  if (typeof body === "string") return readStrOrNull(body.trim());
  return null;
}

function asIssue(value: unknown): SchemaValidationIssue | null {
  if (!isMap(value)) return null;
  const str = (k: string) => (typeof value[k] === "string" ? (value[k] as string) : undefined);
  const issue: SchemaValidationIssue = {
    path: str("path") ?? str("instancePath") ?? str("dataPath"),
    message: str("message"),
    keyword: str("keyword"),
    field: str("field") ?? str("property"),
  };
  return issue.path || issue.message || issue.field ? issue : null;
}

/**
 * The `ProfileValidationError` report as `SchemaValidationFailure` — the same
 * shape `readSchemaValidationFailure` (profiles.ts) builds off a failed save,
 * read here from an already-decoded body so the mapping stays pure.
 */
export function historyValidationFailure(status: number, body: unknown): SchemaValidationFailure | null {
  if (!isMap(body)) return null;
  const error = isMap(body.error) ? body.error : {};
  const description = isMap(error.description) ? error.description : {};
  const pick = (k: string): unknown => body[k] ?? error[k] ?? description[k];
  const rawErrors = pick("errors");
  const errors = Array.isArray(rawErrors)
    ? rawErrors.map(asIssue).filter((i): i is SchemaValidationIssue => i != null)
    : [];
  const message = readStr(pick("message"));
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

/**
 * Pure §9 mapping of an HTTP failure. `body` is whatever ky pre-read
 * (object, text, `undefined`); nothing here may throw.
 */
export function parseHistoryError(input: {
  status: number | null;
  body?: unknown;
  transportMessage?: string | null;
}): HistoryApiError {
  const status = input.status;
  const body = decodeBody(input.body);
  const serverMessage = historyServerMessage(body);
  const errorName = errorNameOf(body);
  const make = (code: HistoryErrorCode, validation: SchemaValidationFailure | null = null) =>
    new HistoryApiError({
      code,
      status,
      serverMessage,
      validation,
      message: serverMessage ?? input.transportMessage ?? undefined,
    });

  if (status === null) return make("network");
  // Token failures hide behind HTTP 400 (§9 shape 3) — check the name first.
  if (errorName === "UnauthorizedException" || isWrapped401Body(body) || status === 401) {
    return make("unauthorized");
  }
  if (status === 403) return make("forbidden");
  if (status === 404) return make("not_found");
  if (status === 409) return make("conflict");
  if (status === 422) {
    if (errorName === "ProfileValidationError") {
      return make("validation", historyValidationFailure(status, body));
    }
    if (serverMessage && DELETED_PAGE_MESSAGE.test(serverMessage)) return make("deleted_page");
    return make("bad_request");
  }
  if (status === 400) return make("bad_request");
  return make("unknown");
}

/** A failure that never reached the server: offline, DNS, timeout, abort. */
function isTransportFailure(e: unknown): boolean {
  if (e instanceof TimeoutError || e instanceof NetworkError) return true;
  if (e instanceof TypeError) return true; // bare fetch: "Failed to fetch"
  if (e instanceof DOMException && e.name === "AbortError") return true;
  return false;
}

/** The pre-read body on a ky ≥ 2 `HTTPError`, synchronously (text → JSON). */
function preReadBody(e: HTTPError): unknown {
  const data: unknown = e.data;
  return data === undefined ? null : decodeBody(data);
}

/**
 * Any thrown value → `HistoryApiError`. Synchronous: ky ≥ 2 pre-reads the body
 * into `HTTPError.data` before the error reaches us, so no `await` is needed
 * (and `response.json()` would throw — the body is consumed). An invalid
 * session hidden in a 400 (§9 shape 3) signs the user out, as the client
 * hook does for real 401s.
 */
export function toHistoryError(e: unknown): HistoryApiError {
  if (e instanceof HistoryApiError) return e;
  if (e instanceof HTTPError) {
    const body = preReadBody(e);
    return fromHttpFailure(e, body);
  }
  if (isTransportFailure(e)) {
    return new HistoryApiError({
      code: "network",
      message: e instanceof Error ? e.message : String(e),
      cause: e,
    });
  }
  return new HistoryApiError({
    code: "unknown",
    message: e instanceof Error ? e.message : String(e),
    cause: e,
  });
}

function fromHttpFailure(e: HTTPError, body: unknown): HistoryApiError {
  const status = e.response.status;
  const err = parseHistoryError({ status, body, transportMessage: e.message });
  if (err.code === "unauthorized" && status === 400) {
    // The client hook only sees real 401s; sign out for the wrapped one too.
    useAuthStore.getState().logout();
  }
  return err;
}

/** The async twin used by the request helpers: reads the body the shared
 *  `httpErrorBody` way (pre-read `data`, then the older Response path). */
async function toHistoryErrorAsync(e: unknown): Promise<HistoryApiError> {
  if (e instanceof HTTPError) {
    const body = await httpErrorBody(e);
    return fromHttpFailure(e, body);
  }
  return toHistoryError(e);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Routes (§5)
 * ──────────────────────────────────────────────────────────────────────────── */

const PATHS = {
  index: "q-profile/history/index",
  show: "q-profile/history/show",
  diff: "q-profile/history/diff",
  restore: "q-profile/history/restore",
  restoreBlock: "q-profile/history/restore-block",
  pin: "q-profile/history/pin",
  unpin: "q-profile/history/unpin",
  restorePage: "q-profile/history/restore-page",
} as const;

/** §5.1 `limit`: default 30, max 100. */
export const HISTORY_PAGE_SIZE = 30;
export const HISTORY_PAGE_SIZE_MAX = 100;

type Query = Record<string, string | number | boolean>;

async function get(path: string, searchParams: Query): Promise<Json> {
  try {
    const body = await api.get(path, { searchParams }).json<unknown>();
    return readHistoryEnvelope(body);
  } catch (e) {
    throw await toHistoryErrorAsync(e);
  }
}

async function post(path: string, json: Json): Promise<Json> {
  try {
    const text = await api.post(path, { json }).text();
    if (!text) return {};
    try {
      return readHistoryEnvelope(JSON.parse(text) as unknown);
    } catch {
      // A 2xx whose body is not JSON — the action DID run; callers read `{}`
      // through tolerant readers rather than reporting a failure.
      return {};
    }
  } catch (e) {
    throw await toHistoryErrorAsync(e);
  }
}

export interface ListHistoryParams {
  profileId: string;
  /** `main` or `page:<pageId>`; omit for every page. */
  document?: string;
  /** `true` → pinned rows only. */
  pinned?: boolean;
  /** `nextCursor` from the previous page. */
  cursor?: number | null;
  /** 1–100, default 30. */
  limit?: number;
}

/** §5.1 — rows newest first, without content. Reload on every screen open. */
export async function listHistory(p: ListHistoryParams): Promise<HistoryPage> {
  const query: Query = { profileId: p.profileId };
  if (p.document) query.document = p.document;
  if (p.pinned === true) query.pinned = "true";
  if (p.cursor != null) query.cursor = p.cursor;
  if (p.limit != null) {
    query.limit = Math.min(HISTORY_PAGE_SIZE_MAX, Math.max(1, Math.trunc(p.limit)));
  }
  return readHistoryPage(await get(PATHS.index, query));
}

/** §5.2 — one row WITH `info` (and `settings` on `main`), for the preview. */
export async function showHistory(profileId: string, historyId: string): Promise<HistoryRowContent> {
  const data = await get(PATHS.show, { profileId, historyId });
  return readHistoryRowContent(data.history ?? data);
}

/** §5.3 — what the row changed against the previous row of the same page. */
export async function diffHistory(profileId: string, historyId: string): Promise<HistoryDiff> {
  return readHistoryDiff(await get(PATHS.diff, { profileId, historyId }));
}

/** §5.4 — whole page back to that row. Close the page's editor FIRST (§7.1). */
export async function restoreHistory(profileId: string, historyId: string): Promise<HistoryRestoreResult> {
  return readHistoryRestoreResult(await post(PATHS.restore, { profileId, historyId }));
}

/** §5.5 — one block as it was in that row (see `blockRestoreHistoryId`). */
export async function restoreHistoryBlock(
  profileId: string,
  historyId: string,
  blockId: string,
): Promise<HistoryRestoreResult> {
  return readHistoryRestoreResult(await post(PATHS.restoreBlock, { profileId, historyId, blockId }));
}

/** §5.6 — pin or rename (already pinned → rename, `pinnedAt` kept). */
export async function pinHistory(profileId: string, historyId: string, label: string): Promise<HistoryPinned> {
  const trimmed = label.trim();
  const data = await post(PATHS.pin, { profileId, historyId, label: trimmed });
  return (
    readHistoryPinned(data.pinned) ?? {
      label: trimmed,
      pinnedAt: new Date().toISOString(),
      pinnedBy: "",
    }
  );
}

/** §5.7 — the row counts toward the 300 again (an old row may vanish). */
export async function unpinHistory(profileId: string, historyId: string): Promise<void> {
  await post(PATHS.unpin, { profileId, historyId });
}

/** §5.8 — recreate a deleted sub-page; returns the NEW page. */
export async function restoreHistoryPage(profileId: string, historyId: string): Promise<HistoryRestoredPage> {
  const data = await post(PATHS.restorePage, { profileId, historyId });
  return readHistoryRestoredPage(data.page ?? data);
}

/* ────────────────────────────────────────────────────────────────────────────
 * react-query keys — invalidate `historyQueryKeys.all(profileId)` after every
 * restore / pin / unpin (§6.2.6).
 * ──────────────────────────────────────────────────────────────────────────── */

export const historyQueryKeys = {
  all: (profileId: string) => ["history", profileId] as const,
  list: (profileId: string, document?: string, pinned?: boolean) =>
    ["history", profileId, "list", document ?? "", pinned === true] as const,
  show: (profileId: string, historyId: string) => ["history", profileId, "show", historyId] as const,
  diff: (profileId: string, historyId: string) => ["history", profileId, "diff", historyId] as const,
};
