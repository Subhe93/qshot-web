import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint paths — mirror the LIVE mobile client (Flutter
// core/resources/remote/links.dart), which is the DEPLOYED contract. A few of
// these differ from the Postman dossier (confirmed by the parity audit):
// duplicate, plans, and the whole external-domain family. If any 404s against
// staging, switch the one line here.
// ─────────────────────────────────────────────────────────────────────────────
const PATHS = {
  search: "q-profile-user-control/search",
  show: "q-profile-user-control/show",
  update: "q-profile-user-control/update",
  verify: "q-profile-user-control/verify",
  // ADMIN duplicate of ANY profile → the control endpoint (links.dart
  // `duplicateWebsite`). `q-profile/user/duplicate` is the USER self-duplicate
  // and 400s on a foreign profileId.
  duplicate: "q-profile-user-control/duplicate",
  moveProfile: "q-profile-user-control/move-profile",
  activateCompany: "q-profile-user-control/activate-company",
  activateSubscribe: "q-profile-user-control/activate-subscribe",
  listPlans: "plans/table2", // NOT plans/index; body has top-level { plans, features }
  externalDomainShow: "q-profile/external-link-user-request/show",
  externalDomainStore: "q-profile/external-link-user-request/store",
  externalDomainUpdate: "q-profile/external-link-user-request/update",
  externalDomainDelete: "q-profile/external-link-user-request/delete",
  domainRequestsIndex: "q-profile-user-external-link-control/index",
  domainRequestsApprove: "q-profile-user-external-link-control/store",
  cloudflareIndex: "q-profile-domain-control/cloudflare-domains/index",
  cloudflareCreate: "q-profile-domain-control/cloudflare-domains/create",
  cloudflareDelete: "q-profile-domain-control/cloudflare-domains/delete",
} as const;

// NOTE ON ENCODING: the mobile Dio client sends every POST as JSON
// (Content-Type: application/json, request.toJson()). We therefore use ky's
// `{ json }` for all POST bodies — NOT form-urlencoded — to match the backend
// contract exactly.

// ─── Types (mirror the mobile models; loose where the backend is schemaless) ──

/** Nested settings shapes the mobile profile uses (subset we render). */
interface SettingsPicture {
  image_url?: string;
}
interface SettingsText {
  text?: string;
}
export interface ProfileSettings {
  profile_picture?: SettingsPicture;
  name?: SettingsText;
  bio?: SettingsText;
  [key: string]: unknown;
}

export interface AdminProfileSummary {
  id: string;
  name: string;
  /** Nested settings: profile_picture.image_url, name.text, bio.text, … */
  settings?: ProfileSettings;
  [key: string]: unknown;
}

export interface AdminSearchResult {
  profiles: AdminProfileSummary[];
}

/** A single profile's admin view. Schemaless `info`/`settings` from the backend. */
export interface AdminProfile {
  id: string;
  name: string;
  settings?: ProfileSettings;
  info?: Record<string, unknown>;
  verified?: boolean;
  verifiedAt?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

export interface Plan {
  _id: string;
  plan_name?: string;
  free?: boolean;
  popular?: boolean;
  best_for?: string;
  /** Mobile emits `colors: { from, to }` + `highlight` as ARGB ints. */
  colors?: { from?: number; to?: number };
  highlight?: number;
  /** Feature-key → this plan's value (true / number / string; 0/false = locked). */
  values?: Record<string, unknown>;
  ref?: { monthly?: string; yearly?: string };
  [key: string]: unknown;
}

/**
 * plans/table2 body — plans + the feature matrix (key → human label), BOTH at the
 * TOP level (no `data` envelope). Mirrors mobile PlanTableModel.fromJson(response.data).
 */
export interface PlanTable {
  plans: Plan[];
  features: Record<string, string>;
}

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  value: string;
  status: boolean;
  [key: string]: unknown;
}

/** A profile's single connected/pending external domain (mobile: one per profile). */
export interface ExternalDomain {
  id?: string;
  name: string;
  status?: boolean;
  dnsRecords?: DnsRecord[];
  [key: string]: unknown;
}

export interface DomainRequest {
  id: string;
  name: string;
  status: boolean;
  createdAt?: string;
  dnsRecords: DnsRecord[];
  cloudflareDomainId?: string;
  [key: string]: unknown;
}

export interface DomainRequestQueue {
  activeRequests: DomainRequest[];
  completedRequests: DomainRequest[];
}

export interface CloudflareDomain {
  id: string;
  hostname: string;
  status: string;
  created_at?: string;
  ssl?: { status?: string };
  [key: string]: unknown;
}

/** Body for the JSON `update` endpoint. `info`/`settings` are schemaless. */
export interface UpdateProfileBody {
  id: string;
  name: string;
  info?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

/** Backend returns `_id`; the mobile models normalize to `id`. Do the same. */
function withId<T extends { id?: string; _id?: string }>(o: T): T & { id: string } {
  return { ...o, id: (o.id ?? o._id ?? "") as string };
}
function normalizeRequest(r: DomainRequest): DomainRequest {
  const req = withId(r);
  return { ...req, dnsRecords: (req.dnsRecords ?? []).map((d) => withId(d)) };
}

// ─── Profile control ────────────────────────────────────────────────────────

/** POST search — JSON `{ searchTerm }`. Response: `data.profiles` (ids normalized). */
export async function searchProfiles(
  searchTerm: string,
): Promise<AdminSearchResult> {
  const res = await api
    .post(PATHS.search, { json: { searchTerm } })
    .json<ApiResponse<AdminSearchResult>>();
  return { profiles: (res.data?.profiles ?? []).map(withId) };
}

/**
 * GET show — query `{ name }`. Response: `data.profile` (null when not found).
 * The backend sends `_id`; normalize to `id` (mobile WebsiteModel does the same)
 * so `profile.id` is usable for duplicate / external-domain / builder-save.
 */
export async function getProfile(name: string): Promise<AdminProfile | null> {
  const res = await api
    .get(PATHS.show, { searchParams: { name } })
    .json<ApiResponse<{ profile?: AdminProfile }>>();
  const p = res.data?.profile;
  return p ? withId(p) : null;
}

/** POST update — JSON `{ id, name, info, settings? }`. */
export async function updateProfile(
  body: UpdateProfileBody,
): Promise<AdminProfile | null> {
  const res = await api
    .post(PATHS.update, { json: body })
    .json<ApiResponse<{ profile?: AdminProfile }>>();
  return res.data?.profile ?? null;
}

/** POST verify — JSON `{ name }`. Single endpoint toggles verify/unverify. */
export async function verifyProfile(name: string): Promise<void> {
  await api.post(PATHS.verify, { json: { name } });
}

/** POST duplicate (q-profile/user/duplicate) — JSON `{ name, profileId }`. */
export async function duplicateProfile(
  name: string,
  profileId: string,
): Promise<AdminProfile | null> {
  const res = await api
    .post(PATHS.duplicate, { json: { name, profileId } })
    .json<ApiResponse<{ profile?: AdminProfile }>>();
  return res.data?.profile ?? null;
}

/** POST move-profile — JSON `{ profileName, email }`. Transfers ownership. */
export async function moveProfile(
  profileName: string,
  email: string,
): Promise<void> {
  await api.post(PATHS.moveProfile, { json: { profileName, email } });
}

/** POST activate-company — JSON `{ email }`. Converts a personal account. */
export async function activateCompany(email: string): Promise<void> {
  await api.post(PATHS.activateCompany, { json: { email } });
}

/** POST activate-subscribe — JSON `{ email, subscribeId }`. */
export async function activateSubscribe(
  email: string,
  subscribeId: string,
): Promise<void> {
  await api.post(PATHS.activateSubscribe, { json: { email, subscribeId } });
}

/** GET plans/table2 → TOP-LEVEL `{ plans, features }` (NO data envelope). */
export async function getPlansTable(): Promise<PlanTable> {
  const body = await api
    .get(PATHS.listPlans)
    .json<Partial<PlanTable> & { data?: Partial<PlanTable> }>();
  // Tolerate an accidental `data` envelope, but the mobile contract is top-level.
  const table = (body?.plans ? body : body?.data) ?? body ?? {};
  return { plans: table.plans ?? [], features: table.features ?? {} };
}

/** Convenience — just the paid, assignable plans (mobile filters `free != true`). */
export async function listPlans(): Promise<Plan[]> {
  return (await getPlansTable()).plans;
}

// ─── Per-profile external domain (one per profile) ───────────────────────────

/** POST external-link-user-request/show — JSON `{ profileId }`. Response: `data.domain` | null. */
export async function getExternalDomain(
  profileId: string,
): Promise<ExternalDomain | null> {
  const res = await api
    .post(PATHS.externalDomainShow, { json: { profileId } })
    .json<ApiResponse<{ domain?: ExternalDomain | null }>>();
  const d = res.data?.domain;
  return d ? withId(d) : null;
}

/** POST external-link-user-request/store — JSON `{ name, profileId }` (name = the domain). */
export async function addExternalDomain(
  name: string,
  profileId: string,
): Promise<void> {
  await api.post(PATHS.externalDomainStore, { json: { name, profileId } });
}

/** POST external-link-user-request/update — JSON `{ name, profileId }`. */
export async function updateExternalDomain(
  name: string,
  profileId: string,
): Promise<void> {
  await api.post(PATHS.externalDomainUpdate, { json: { name, profileId } });
}

/** POST external-link-user-request/delete — JSON `{ profileId }` (no domain field). */
export async function deleteExternalDomain(profileId: string): Promise<void> {
  await api.post(PATHS.externalDomainDelete, { json: { profileId } });
}

// ─── External-domain-link approval queue ─────────────────────────────────────

/** GET approval queue → `data.{ activeRequests, completedRequests }` (ids normalized). */
export async function listDomainRequests(): Promise<DomainRequestQueue> {
  const res = await api
    .get(PATHS.domainRequestsIndex)
    .json<ApiResponse<Partial<DomainRequestQueue>>>();
  const data = res.data ?? {};
  return {
    activeRequests: (data.activeRequests ?? []).map(normalizeRequest),
    completedRequests: (data.completedRequests ?? []).map(normalizeRequest),
  };
}

/** POST approve — JSON `{ name, requestDomainId }`. Provisions a Cloudflare hostname. */
export async function approveDomainRequest(
  name: string,
  requestDomainId: string,
): Promise<void> {
  await api.post(PATHS.domainRequestsApprove, {
    json: { name, requestDomainId },
  });
}

// ─── Cloudflare domains CRUD ─────────────────────────────────────────────────

/** GET cloudflare-domains/index → `data.domain.result[]`. */
export async function listCloudflareDomains(): Promise<CloudflareDomain[]> {
  const res = await api
    .get(PATHS.cloudflareIndex)
    .json<ApiResponse<{ domain?: { result?: CloudflareDomain[] } }>>();
  return res.data?.domain?.result ?? [];
}

/** POST cloudflare-domains/create — JSON `{ name, profileId }`. */
export async function createCloudflareDomain(
  name: string,
  profileId: string,
): Promise<void> {
  await api.post(PATHS.cloudflareCreate, { json: { name, profileId } });
}

/** POST cloudflare-domains/delete — JSON `{ id }` (Cloudflare UUID, not ObjectId). */
export async function deleteCloudflareDomain(id: string): Promise<void> {
  await api.post(PATHS.cloudflareDelete, { json: { id } });
}
