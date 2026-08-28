import { HTTPError } from "ky";
import { api } from "./client";

/**
 * Contacts feature — API layer. Mirrors the mobile data sources under
 * `lib/features/contacts/data/` (branch `feature/contacts`, merged to dev
 * build 179) and `docs/api-spec.en.md` (repo root, 2026-08-27).
 *
 * Envelope: `{ success: true, data }` on success and
 * `{ success: false, error: { code, message, … } }` on failure — a DIFFERENT
 * shape from the q-profile `{ status, data }` envelope, hence the local
 * `unwrap`. Failures carry a machine `code` the UI must branch on
 * (LIMIT_REACHED shows numbers, DUPLICATE_CANDIDATES is a question, scan
 * 422s cost nothing) — `readContactsError` turns any thrown HTTPError into a
 * typed `ContactsError`.
 */

// ─── Envelope + errors ──────────────────────────────────────────────────────

interface Envelope<T> {
  success?: boolean;
  data?: T;
}

function unwrap<T>(body: Envelope<T> | T): T {
  const env = body as Envelope<T>;
  return (env && typeof env === "object" && "data" in env ? env.data : body) as T;
}

/** Typed contacts failure — `code` comes from api-spec §2. */
export class ContactsError extends Error {
  code: string;
  status: number;
  /** LIMIT_REACHED carries the ceiling and the current usage. */
  limit?: number;
  current?: number;
  featureCode?: string;
  /** Scan 422s: explicitly false — a failed scan costs nothing. */
  quotaConsumed?: boolean;
  /** DUPLICATE_CANDIDATES: the matching contacts. */
  duplicates?: Contact[];

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Convert any error thrown by the calls below into a `ContactsError`
 * (`code: "unknown"` when the body carries none). Callers branch on `code`.
 */
export async function readContactsError(e: unknown): Promise<ContactsError> {
  if (e instanceof ContactsError) return e;
  if (e instanceof HTTPError) {
    try {
      const body = (await e.response.clone().json()) as {
        error?: {
          code?: string;
          message?: string;
          limit?: number;
          current?: number;
          featureCode?: string;
          quotaConsumed?: boolean;
        };
        duplicates?: Contact[];
        data?: { duplicates?: Contact[] };
        message?: string;
      };
      const err = new ContactsError(
        body?.error?.code ?? "unknown",
        body?.error?.message ?? body?.message ?? e.message,
        e.response.status,
      );
      err.limit = body?.error?.limit;
      err.current = body?.error?.current;
      err.featureCode = body?.error?.featureCode;
      err.quotaConsumed = body?.error?.quotaConsumed;
      err.duplicates = body?.duplicates ?? body?.data?.duplicates;
      return err;
    } catch {
      return new ContactsError("unknown", e.message, e.response.status);
    }
  }
  return new ContactsError("unknown", e instanceof Error ? e.message : String(e), 0);
}

// ─── Models (api-spec §4.3) ─────────────────────────────────────────────────

export interface ContactPhone {
  label?: string; // mobile | mobile2 | landline | work | fax | whatsapp | other
  number?: string; // display exactly as entered
  e164?: string; // matching + dialling
  countryCode?: string;
  isPrimary?: boolean;
}

export interface ContactEmail {
  label?: string; // personal | work | other
  address?: string;
  isPrimary?: boolean;
}

export interface ContactWebsite {
  label?: string;
  url?: string;
}

export interface ContactSocial {
  platform?: string;
  url?: string;
}

export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface ContactTag {
  _id: string;
  name: string;
  color?: string | null;
}

export interface ContactCardImage {
  url?: string;
  side?: string; // front | back
}

export interface Contact {
  _id: string;
  source?: string; // manual | qr_scan | card_scan | lead_form | booking
  linkedProfile?: string | null;
  linkedUser?: string | null;
  /** none | live | frozen — `frozen` must NEVER be surfaced (api-spec §4.3). */
  linkState?: string;
  kind?: string; // person | organization
  firstName?: string;
  lastName?: string;
  displayName?: string;
  company?: string;
  jobTitle?: string;
  avatarUrl?: string;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  websites?: ContactWebsite[];
  socials?: ContactSocial[];
  address?: ContactAddress | null;
  note?: string;
  /** Populated objects on reads, but bare id STRINGS on some write responses
   *  (create/update/tag-set echo the stored ids). Read through
   *  `contactTagIds` / `resolveContactTags`, never `tag._id` directly —
   *  a string entry made `._id` undefined, which serialised as `null` and
   *  the server 400'd "each value in tags must be a string" (live
   *  2026-08-27). */
  tags?: (ContactTag | string)[];
  isFavorite?: boolean;
  /** Fields the owner edited; protected from live sync. */
  overrides?: string[];
  cardImages?: ContactCardImage[];
  capturedAt?: string;
  metadata?: { eventId?: string | null };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ContactsPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ContactsSummary {
  total?: number;
  favorites?: number;
  tagsCount?: number;
  sources?: Record<string, number>;
  /** null on an unlimited plan. */
  limit?: number | null;
  remaining?: number | null;
}

/** The fields `POST /contacts/:id/reset-field` accepts (api-spec §4.7). */
export const CONTACT_RESETABLE_FIELDS = [
  "firstName",
  "lastName",
  "company",
  "jobTitle",
  "avatarUrl",
  "phones",
  "emails",
  "websites",
  "socials",
  "address",
] as const;

export const CONTACT_SOURCES = [
  "manual",
  "qr_scan",
  "card_scan",
  "lead_form",
  "booking",
] as const;

export const PHONE_LABELS = [
  "mobile",
  "mobile2",
  "landline",
  "work",
  "fax",
  "whatsapp",
  "other",
] as const;

export const EMAIL_LABELS = ["personal", "work", "other"] as const;

// ─── Entitlements (api-spec §3) ─────────────────────────────────────────────

/** Feature-code constants — mobile `ContactsFeatureCodes`. */
export const FC = {
  enabled: "contacts_enabled",
  max: "contacts_max",
  noteMaxLength: "contacts_note_max_length",
  tagsEnabled: "contacts_tags_enabled",
  tagsMax: "contacts_tags_max",
  exportSingle: "contacts_export_single",
  liveLink: "contacts_live_link",
  addedMe: "contacts_added_me",
  exchangeMode: "contacts_exchange_mode",
  cardScanEnabled: "contacts_card_scan_enabled",
  cardScanBatch: "contacts_card_scan_batch",
  cardScanBatchMax: "contacts_card_scan_batch_max",
  eventMode: "contacts_event_mode",
  exportBulk: "contacts_export_bulk",
  offlineCapture: "contacts_offline_capture",
} as const;

export interface ContactsEntitlements {
  /** Raw feature map — booleans are "true"/"false", numbers are numeric strings, "unlimited" = no ceiling. */
  features: Record<string, string>;
  usage: { contactsCount?: number; tagsCount?: number };
}

/** `"true"` → true; anything else (including absence) → false. */
export function entBool(e: ContactsEntitlements | undefined, code: string): boolean {
  return e?.features?.[code] === "true";
}

/** Numeric ceiling, or null for `"unlimited"` / absent / unparsable. */
export function entLimit(
  e: ContactsEntitlements | undefined,
  code: string,
): number | null {
  const raw = e?.features?.[code];
  if (raw == null || raw === "unlimited") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function getContactsEntitlements(): Promise<ContactsEntitlements> {
  return unwrap(await api.get("contacts/entitlements").json());
}

// ─── The book (api-spec §4) ─────────────────────────────────────────────────

export async function getContactsSummary(): Promise<ContactsSummary> {
  return unwrap(await api.get("contacts/summary").json());
}

export interface ListContactsParams {
  q?: string;
  tag?: string;
  source?: string;
  favorite?: boolean;
  sort?: "recent" | "name" | "created";
  page?: number;
  limit?: number;
}

export async function listContacts(
  params: ListContactsParams = {},
): Promise<{ contacts: Contact[]; pagination: ContactsPagination }> {
  const searchParams: Record<string, string | number | boolean> = {};
  if (params.q) searchParams.q = params.q;
  if (params.tag) searchParams.tag = params.tag;
  if (params.source) searchParams.source = params.source;
  if (params.favorite != null) searchParams.favorite = params.favorite;
  if (params.sort) searchParams.sort = params.sort;
  if (params.page) searchParams.page = params.page;
  if (params.limit) searchParams.limit = params.limit;
  return unwrap(await api.get("contacts", { searchParams }).json());
}

export async function getContact(id: string): Promise<Contact> {
  const d = unwrap<{ contact?: Contact } | Contact>(
    await api.get(`contacts/${id}`).json(),
  );
  return ((d as { contact?: Contact }).contact ?? d) as Contact;
}

/** Create/update body — api-spec §4.4. On UPDATE send ONLY edited fields:
 *  every field sent in PUT becomes permanently protected from live sync. */
export interface ContactWriteBody {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  company?: string;
  jobTitle?: string;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  websites?: ContactWebsite[];
  socials?: ContactSocial[];
  address?: ContactAddress;
  note?: string;
  tags?: string[];
  kind?: string;
  clientRequestId?: string;
  capturedAt?: string;
  [key: string]: unknown;
}

export interface SaveContactResult {
  contact: Contact;
  alreadyExisted?: boolean;
  notified?: boolean;
}

export async function createContact(body: ContactWriteBody): Promise<SaveContactResult> {
  return unwrap(await api.post("contacts/create", { json: body }).json());
}

export async function updateContact(
  id: string,
  body: ContactWriteBody,
): Promise<Contact> {
  const d = unwrap<{ contact?: Contact } | Contact>(
    await api.put(`contacts/${id}`, { json: body }).json(),
  );
  return ((d as { contact?: Contact }).contact ?? d) as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`contacts/${id}`);
}

export async function toggleFavorite(id: string): Promise<Contact> {
  const d = unwrap<{ contact?: Contact } | Contact>(
    await api.post(`contacts/${id}/favorite`).json(),
  );
  return ((d as { contact?: Contact }).contact ?? d) as Contact;
}

export async function resetContactField(id: string, field: string): Promise<Contact> {
  const d = unwrap<{ contact?: Contact } | Contact>(
    await api.post(`contacts/${id}/reset-field`, { json: { field } }).json(),
  );
  return ((d as { contact?: Contact }).contact ?? d) as Contact;
}

/** Fold `sourceContactId` into `id` (api-spec §4.8) — never automatic. */
export async function mergeContacts(
  id: string,
  sourceContactId: string,
): Promise<Contact> {
  const d = unwrap<{ contact?: Contact } | Contact>(
    await api.post(`contacts/${id}/merge`, { json: { sourceContactId } }).json(),
  );
  return ((d as { contact?: Contact }).contact ?? d) as Contact;
}

export async function checkDuplicate(body: {
  phones?: { number: string }[];
  emails?: { address: string }[];
}): Promise<{ duplicates: Contact[] }> {
  return unwrap(await api.post("contacts/check-duplicate", { json: body }).json());
}

// ─── Downloads (authenticated blobs) ────────────────────────────────────────

async function downloadBlob(path: string, filename: string): Promise<void> {
  const blob = await api.get(path).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Single-contact vCard — available on every plan (api-spec §4.9). */
export async function downloadVcard(id: string, name: string): Promise<void> {
  await downloadBlob(`contacts/${id}/vcard`, `${name || "contact"}.vcf`);
}

/** Bulk export — gated by `contacts_export_bulk`; 3 requests / 5 min. */
export async function downloadBulkExport(
  format: "csv" | "vcf",
  opts: { tag?: string; event?: string } = {},
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.event) params.set("event", opts.event);
  await downloadBlob(`contacts/export?${params}`, `contacts.${format}`);
}

// ─── Tags (api-spec §5) ─────────────────────────────────────────────────────

export async function listContactTags(): Promise<ContactTag[]> {
  const d = unwrap<{ tags?: ContactTag[] } | ContactTag[]>(
    await api.get("contact-tags").json(),
  );
  return Array.isArray(d) ? d : (d.tags ?? []);
}

export async function createContactTag(
  name: string,
  color?: string,
): Promise<{ tag: ContactTag; alreadyExisted?: boolean }> {
  const d = unwrap<{ tag?: ContactTag; alreadyExisted?: boolean } | ContactTag>(
    await api.post("contact-tags/create", { json: { name, color } }).json(),
  );
  if ((d as { tag?: ContactTag }).tag) {
    return d as { tag: ContactTag; alreadyExisted?: boolean };
  }
  return { tag: d as ContactTag };
}

export async function updateContactTag(
  id: string,
  body: { name?: string; color?: string },
): Promise<ContactTag> {
  const d = unwrap<{ tag?: ContactTag } | ContactTag>(
    await api.put(`contact-tags/${id}`, { json: body }).json(),
  );
  return ((d as { tag?: ContactTag }).tag ?? d) as ContactTag;
}

export async function deleteContactTag(id: string): Promise<void> {
  await api.delete(`contact-tags/${id}`);
}

/** REPLACES the contact's tag list entirely (api-spec §5). */
export async function setContactTags(
  contactId: string,
  tagIds: string[],
): Promise<Contact> {
  // Belt and braces: the server rejects the whole call for one non-string.
  const tags = tagIds.filter((id): id is string => typeof id === "string" && id !== "");
  const d = unwrap<{ contact?: Contact } | Contact>(
    await api.post(`contact-tags/contact/${contactId}`, { json: { tags } }).json(),
  );
  return ((d as { contact?: Contact }).contact ?? d) as Contact;
}

/** The contact's tag IDS, whichever shape the server sent. */
export function contactTagIds(c: Contact): string[] {
  return (c.tags ?? [])
    .map((t) => (typeof t === "string" ? t : t?._id))
    .filter((id): id is string => typeof id === "string" && id !== "");
}

/** The contact's tags as displayable objects: populated entries pass
 *  through, bare ids resolve against `all` (the user's tag list), and ids
 *  of deleted/unknown tags drop out. */
export function resolveContactTags(c: Contact, all: ContactTag[]): ContactTag[] {
  const byId = new Map(all.map((t) => [t._id, t]));
  const out: ContactTag[] = [];
  for (const t of c.tags ?? []) {
    if (typeof t === "string") {
      const found = byId.get(t);
      if (found) out.push(found);
    } else if (t && t._id) {
      out.push(t);
    }
  }
  return out;
}

// ─── The social loop (api-spec §6) ──────────────────────────────────────────

export interface AddedMeItem {
  userId: string;
  addedAt?: string;
  profile?: {
    _id?: string;
    name?: string;
    displayName?: string;
    kind?: string;
    [key: string]: unknown;
  };
  alreadyInMyContacts?: boolean;
}

export async function listAddedMe(
  page = 1,
  limit = 20,
): Promise<{ items: AddedMeItem[]; pagination: ContactsPagination }> {
  return unwrap(
    await api.get("contacts-social/added-me", { searchParams: { page, limit } }).json(),
  );
}

export async function addBack(
  userId: string,
  clientRequestId: string,
): Promise<SaveContactResult> {
  return unwrap(
    await api
      .post(`contacts-social/added-me/${userId}/add-back`, {
        json: { clientRequestId },
      })
      .json(),
  );
}

export interface ContactsSocialSettings {
  addedYouNotifications?: boolean;
  addedYouMode?: "instant" | "digest";
  /** Whether the USER appears in other people's "who added me" lists. */
  allowAddedMeList?: boolean;
}

export async function getSocialSettings(): Promise<ContactsSocialSettings> {
  const d = unwrap<{ settings?: ContactsSocialSettings } | ContactsSocialSettings>(
    await api.get("contacts-social/settings").json(),
  );
  return ((d as { settings?: ContactsSocialSettings }).settings ?? d) as ContactsSocialSettings;
}

export async function updateSocialSettings(
  body: ContactsSocialSettings,
): Promise<ContactsSocialSettings> {
  const d = unwrap<{ settings?: ContactsSocialSettings } | ContactsSocialSettings>(
    await api.put("contacts-social/settings", { json: body }).json(),
  );
  return ((d as { settings?: ContactsSocialSettings }).settings ?? d) as ContactsSocialSettings;
}

export interface BlockedUser {
  userId: string;
  blockedAt?: string;
  profile?: { name?: string; displayName?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const d = unwrap<{ items?: BlockedUser[]; blocked?: BlockedUser[] } | BlockedUser[]>(
    await api.get("contacts-social/blocked").json(),
  );
  if (Array.isArray(d)) return d;
  return d.items ?? d.blocked ?? [];
}

export async function blockUser(userId: string): Promise<void> {
  await api.post(`contacts-social/block/${userId}`);
}

export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`contacts-social/block/${userId}`);
}

// ─── Business-card scanning (api-spec §7) ───────────────────────────────────

export interface CardScanQuota {
  /** null on an unlimited plan. */
  monthlyLimit?: number | null;
  monthlyUsed?: number;
  trialLimit?: number;
  trialUsed?: number;
  remaining?: number | null;
  periodKey?: string;
}

export async function getCardScanQuota(): Promise<CardScanQuota> {
  const d = unwrap<{ quota?: CardScanQuota } | CardScanQuota>(
    await api.get("contacts/card-scan/quota").json(),
  );
  return ((d as { quota?: CardScanQuota }).quota ?? d) as CardScanQuota;
}

export interface CardScanJob {
  _id: string;
  status?: string; // pending | processing | review | saved | failed | discarded
  fields?: ContactWriteBody;
  confidence?: Record<string, number>;
  alternates?: { field?: string; value?: string; lang?: string }[];
  detectedLanguages?: string[];
  detectedProfileId?: string | null;
  quotaConsumed?: boolean;
  images?: { side?: string; url?: string }[];
  duplicates?: Contact[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface CardScanResult {
  job: CardScanJob;
  detectedProfile?: { profileId?: string; profileName?: string } | null;
}

/** Scan one card: front (+ optional back). 422s cost nothing (§7.2). */
export async function scanCard(
  images: File[],
  clientRequestId?: string,
): Promise<CardScanResult> {
  const form = new FormData();
  for (const file of images) form.append("images", file);
  if (clientRequestId) form.append("clientRequestId", clientRequestId);
  return unwrap(
    await api.post("contacts/card-scan", { body: form, timeout: 120_000 }).json(),
  );
}

export async function getCardScanJob(id: string): Promise<CardScanResult> {
  const d = unwrap<CardScanResult | { job: CardScanJob }>(
    await api.get(`contacts/card-scan/${id}`).json(),
  );
  return d as CardScanResult;
}

/** Save after the MANDATORY review (§7.3–7.4). */
export async function saveCardScan(
  id: string,
  body: { fields?: ContactWriteBody; linkProfile?: boolean; clientRequestId?: string },
): Promise<SaveContactResult> {
  return unwrap(await api.post(`contacts/card-scan/${id}/save`, { json: body }).json());
}

export async function discardCardScan(id: string): Promise<void> {
  await api.delete(`contacts/card-scan/${id}`);
}

export async function listCardScans(limit = 20): Promise<CardScanJob[]> {
  const d = unwrap<{ jobs?: CardScanJob[]; scans?: CardScanJob[] } | CardScanJob[]>(
    await api.get("contacts/card-scan", { searchParams: { limit } }).json(),
  );
  if (Array.isArray(d)) return d;
  return d.jobs ?? d.scans ?? [];
}

/**
 * Card images are PRIVATE (§7.5): authenticated route only, no public URL,
 * and nothing may be cached publicly. Fetch with the bearer and hand back an
 * object URL; the caller revokes it on unmount.
 */
export async function fetchCardImage(scanId: string, side: string): Promise<string> {
  const blob = await api.get(`contacts/card-scan/${scanId}/image/${side}`).blob();
  return URL.createObjectURL(blob);
}

export async function deleteContactCardImage(
  contactId: string,
  side: string,
): Promise<void> {
  await api.delete(`contacts/${contactId}/card-image/${side}`);
}

// ─── Events (api-spec §8.2) ─────────────────────────────────────────────────

export interface ContactEvent {
  _id: string;
  name?: string;
  startedAt?: string;
  endsAt?: string;
  endedAt?: string | null;
  active?: boolean;
  contactsCount?: number;
  summary?: { total?: number; sources?: Record<string, number> };
  [key: string]: unknown;
}

export async function listContactEvents(): Promise<ContactEvent[]> {
  const d = unwrap<{ events?: ContactEvent[] } | ContactEvent[]>(
    await api.get("contact-events").json(),
  );
  return Array.isArray(d) ? d : (d.events ?? []);
}

export async function getActiveContactEvent(): Promise<ContactEvent | null> {
  const d = unwrap<{ event?: ContactEvent | null } | ContactEvent | null>(
    await api.get("contact-events/active").json(),
  );
  if (d == null) return null;
  return ((d as { event?: ContactEvent | null }).event ?? d) as ContactEvent | null;
}

export async function startContactEvent(
  name: string,
  endsAt?: string,
): Promise<ContactEvent> {
  const d = unwrap<{ event?: ContactEvent } | ContactEvent>(
    await api.post("contact-events/start", { json: { name, endsAt } }).json(),
  );
  return ((d as { event?: ContactEvent }).event ?? d) as ContactEvent;
}

export async function getContactEvent(
  id: string,
): Promise<{ event?: ContactEvent; contacts?: Contact[]; summary?: unknown }> {
  return unwrap(await api.get(`contact-events/${id}`).json());
}

export async function endContactEvent(id: string): Promise<ContactEvent> {
  const d = unwrap<{ event?: ContactEvent } | ContactEvent>(
    await api.post(`contact-events/${id}/end`).json(),
  );
  return ((d as { event?: ContactEvent }).event ?? d) as ContactEvent;
}

// ─── Display helpers (mobile `contact_display.dart` semantics) ──────────────

/** The name a row/detail shows; never empty (mobile falls back to "unnamed"). */
export function contactDisplayName(c: Contact): string {
  const display = (c.displayName ?? "").trim();
  if (display) return display;
  const joined = [c.firstName, c.lastName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (joined) return joined;
  const company = (c.company ?? "").trim();
  if (company) return company;
  const phone = c.phones?.find((p) => (p.number ?? "").trim());
  if (phone) return phone.number!.trim();
  const email = c.emails?.find((p) => (p.address ?? "").trim());
  if (email) return email.address!.trim();
  return "";
}

/** Primary (or first) phone, for the row subtitle and tap-to-call. */
export function primaryPhone(c: Contact): ContactPhone | null {
  const phones = (c.phones ?? []).filter((p) => (p.number ?? "").trim());
  return phones.find((p) => p.isPrimary) ?? phones[0] ?? null;
}

export function primaryEmail(c: Contact): ContactEmail | null {
  const emails = (c.emails ?? []).filter((p) => (p.address ?? "").trim());
  return emails.find((p) => p.isPrimary) ?? emails[0] ?? null;
}

/** A phone the row may CALL — mobile shows no call button for fax-only. */
export function callablePhone(c: Contact): ContactPhone | null {
  const phones = (c.phones ?? []).filter(
    (p) => (p.number ?? "").trim() && p.label !== "fax",
  );
  return phones.find((p) => p.isPrimary) ?? phones[0] ?? null;
}

/** The number to dial: e164 when present, else the display number. */
export function dialNumber(p: ContactPhone): string {
  return (p.e164 ?? "").trim() || (p.number ?? "").trim();
}

/** wa.me links take digits only. */
export function whatsappNumber(p: ContactPhone): string {
  return dialNumber(p).replace(/[^0-9]/g, "");
}
