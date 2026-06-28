import { api } from "./client";

/**
 * Booking API — a standalone service (NOT the q-profile { status, message, data }
 * envelope). List endpoints return either a raw array or { data, meta }.
 * Field names mirror the mobile booking models exactly.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────
export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled";

export const BOOKING_STATUSES: BookingStatus[] = [
  "pending_payment",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
];

// Per-booking payment mode (mobile PaymentMode enum: online / on_site / free).
export type PaymentMode = "online" | "on_site" | "free";

// status → { color, key } for badges
export const STATUS_META: Record<
  BookingStatus,
  { color: string; key: string }
> = {
  pending_payment: { color: "#ffaf05", key: "pendingPayment" },
  confirmed: { color: "#3b82f6", key: "confirmed" },
  completed: { color: "#34c360", key: "completed" },
  no_show: { color: "#f35054", key: "noShow" },
  cancelled: { color: "#818490", key: "cancelled" },
};

// ─── Models ─────────────────────────────────────────────────────────────────
export interface BookingConfig {
  _id?: string;
  profileId?: string;
  userId?: string;
  isEnabled?: boolean;
  defaultCurrency?: string;
  generalGapBefore?: number;
  generalGapAfter?: number;
  minNoticeTime?: number;
  maxAdvancedBooking?: number;
  userBookingLimit?: number;
  cooldownBetweenBookings?: number;
  softHoldDuration?: number;
  cancellationCutoffHours?: number;
  cancellationRefundPercent?: number;
  depositPercent?: number;
  platformFeePercent?: number;
  stripeAccountId?: string | null;
}

export interface WorkingHours {
  dayOfWeek: number; // 0=Sun..6=Sat
  startTime: string; // HH:mm
  endTime: string;
}

export interface Provider {
  _id?: string;
  id?: string;
  profileId?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  specialization?: string | null;
  bio?: string | null;
  timezone?: string;
  slotGranularity?: number;
  blackoutDates?: string[];
  dailyBookingLimit?: number;
  dailyHoursLimit?: number;
  forcedBreakAfterCount?: number;
  forcedBreakDuration?: number;
  isActive?: boolean;
  isDefault?: boolean;
  order?: number;
  workingHours?: WorkingHours[];
  // Provider-portal secret code — only present on create + GET-one (not lists).
  secretCode?: string | null;
  codeVersion?: number;
}

export interface Service {
  _id?: string;
  id?: string;
  profileId?: string;
  name: string;
  description?: string | null;
  duration?: number;
  defaultPrice?: number;
  currency?: string;
  gapBefore?: number;
  gapAfter?: number;
  isActive?: boolean;
  // Show/hide on the PUBLIC booking site (hide-service-contract). Independent of
  // isActive (which is soft-delete only). Default true.
  isVisible?: boolean;
  // Pay online vs pay on-site (mobile paymentEnabled); sent on save.
  paymentEnabled?: boolean;
  // Service hierarchy (mobile parentId/hasChildren): a service with children is a
  // category and cannot be booked or linked to a provider directly.
  parentId?: string | null;
  hasChildren?: boolean;
  order?: number;
}

/**
 * Extra Service (add-on) — an optional item attached to a service NODE (leaf or
 * category) and inherited down the tree (integration-guide-0.md). Adds its price
 * to the total and its duration to the appointment.
 *
 * MONEY UNITS: WHOLE units (e.g. `price: 15` = $15.00), consistent with
 * Service.defaultPrice / booking totals / the public flow's useCurrencyFormat.
 * (The guide labels prices "cents", but the shared booking system uses whole
 * units and a booking total = service + extras must share one unit.)
 */
export interface Extra {
  _id?: string;
  id?: string;
  profileId?: string;
  serviceId?: string;
  name: string;
  description?: string | null;
  price?: number; // whole units
  duration?: number; // minutes
  currency?: string;
  isActive?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Snapshot of a selected extra captured on a booking (immutable). */
export interface BookingExtraSnapshot {
  extraServiceId?: string;
  name?: string;
  price?: number; // whole units
  duration?: number; // minutes
}

// Provider↔Service pivot (which services a provider offers, with optional
// per-link price/duration overrides). Mirrors mobile ProviderServiceModel.
export interface ProviderService {
  _id?: string;
  id?: string;
  profileId?: string;
  providerId: string;
  serviceId: string;
  price?: number | null;
  duration?: number | null;
  isActive?: boolean;
}

export interface BookingCustomer {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
}

export interface Booking {
  _id?: string;
  bookingRef: string;
  profileId?: string;
  status: BookingStatus;
  startTimeUTC?: string;
  endTimeUTC?: string;
  slotStart?: string;
  slotEnd?: string;
  customer?: BookingCustomer;
  customerId?: BookingCustomer;
  service?: { name?: string; duration?: number; id?: string };
  provider?: { name?: string; id?: string };
  serviceId?: string;
  providerId?: string;
  notes?: string | null;
  cancellationReason?: string | null;
  totalAmount?: number;
  depositAmount?: number;
  remainingAmount?: number;
  refundedAmount?: number;
  refundable?: boolean;
  refundPercent?: number;
  paymentStatus?: string;
  paymentMode?: PaymentMode;
  providerTimezone?: string;
  currency?: string;
  // Snapshot of extras booked with this appointment (integration-guide-0 §4.5).
  extras?: BookingExtraSnapshot[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  notes?: string | null;
  address?: string | null;
  timezone?: string;
  isActive?: boolean;
  totalBookings?: number;
  totalSpent?: number;
  createdAt?: string;
  bookings?: Booking[];
}

export interface BookingAnalytics {
  overview?: {
    totalBookings?: number;
    confirmedBookings?: number;
    completedBookings?: number;
    cancelledBookings?: number;
  };
  last30Days?: {
    revenue?: number;
    collectedRevenue?: number;
    onSiteDue?: number;
    bookingCount?: number;
  };
  byProvider?: Array<{ name?: string; _id?: string; bookingCount?: number; count?: number; revenue?: number }>;
  byService?: Array<{ name?: string; _id?: string; bookingCount?: number; count?: number; revenue?: number }>;
  totalRevenue?: number;
  totalCustomers?: number;
  currency?: string;
}

export interface StripeStatus {
  connected?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  onboardingStatus?: string;
  accountId?: string;
}

// ─── Google Calendar sync (integration-guide.md) ─────────────────────────────
export interface GoogleCalendarStatus {
  connected: boolean;
  googleEmail?: string | null;
  lastSyncedAt?: string | null;
  status?: "connected" | "revoked" | "error" | null;
}

/** A platform booking in the merged dashboard calendar view. */
export interface CalendarPlatformItem {
  source: "platform";
  id: string;
  startTimeUTC: string;
  endTimeUTC: string;
  status?: BookingStatus;
  booking?: {
    bookingRef?: string;
    status?: BookingStatus;
    paymentMode?: PaymentMode;
    totalAmount?: number;
    currency?: string;
    extras?: BookingExtraSnapshot[];
    customerId?: { name?: string; email?: string; phone?: string };
    serviceId?: { name?: string };
    providerId?: { name?: string };
  };
}
/** An external Google "busy" block in the merged calendar view. */
export interface CalendarGoogleItem {
  source: "google";
  id: string;
  startTimeUTC: string;
  endTimeUTC: string;
  isAllDay?: boolean;
  summary?: string;
}
export type CalendarItem = CalendarPlatformItem | CalendarGoogleItem;

// Helper: unwrap { data } | array | object.
function arr<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const d = (res as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Booking dashboard list endpoints return a NESTED envelope
 *   { data: { bookings|customers: [...], total, page, pages } }
 * (mobile booking_dashboard_data_source.dart / booking_customers_data_source.dart),
 * NOT a top-level array or a `{ meta }` block. Read items + paging from `data`.
 */
function listEnvelope<T>(
  res: unknown,
  key: string,
): { items: T[]; total: number; totalPages: number; page: number } {
  const d = asObj((res as { data?: unknown })?.data) ?? asObj(res) ?? {};
  const raw = d[key];
  const items = Array.isArray(raw)
    ? (raw as T[])
    : Array.isArray(d.data)
      ? (d.data as T[])
      : [];
  return {
    items,
    total: Number(d.total ?? items.length ?? 0),
    totalPages: Number(d.pages ?? d.totalPages ?? 1),
    page: Number(d.page ?? 1),
  };
}

/**
 * The booking list nests the customer under `customerId` and (in the detail
 * payload) the service/provider under `serviceId`/`providerId` objects. Surface
 * them as the flat `customer`/`service`/`provider` convenience fields the panes read.
 */
function normalizeBooking(rawValue: unknown): Booking {
  const b = asObj(rawValue);
  if (!b) return rawValue as Booking;
  const out: Record<string, unknown> = { ...b };
  const cust = asObj(b.customerId);
  if (cust) out.customer = cust;
  const svc = asObj(b.serviceId);
  if (svc) out.service = { name: svc.name, duration: svc.duration, id: svc._id ?? svc.id };
  const prov = asObj(b.providerId);
  if (prov) {
    out.provider = { name: prov.name, id: prov._id ?? prov.id };
    out.providerTimezone = out.providerTimezone ?? prov.timezone;
  }
  return out as unknown as Booking;
}

/**
 * Read a single object from a ky request. Throws on HTTP error (so mutations
 * surface failures), but tolerates an empty/non-JSON 2xx body (e.g. a 201 with
 * no payload) by returning the fallback — fixing "saved on the server but the
 * client errored" cases. Unwraps a `{ data }` envelope when present.
 */
async function readOne<T>(
  rp: { then: Promise<Response>["then"] },
  fallback: T,
): Promise<T> {
  const res = (await rp) as Response;
  const text = await res.text();
  if (!text) return fallback;
  try {
    const j = JSON.parse(text);
    return ((j?.data ?? j) as T) ?? fallback;
  } catch {
    return fallback;
  }
}
function one<T>(res: unknown): T {
  return ((res as { data?: T })?.data ?? (res as T));
}

// ─── Config ─────────────────────────────────────────────────────────────────
export async function getBookingConfig(profileId: string): Promise<BookingConfig | null> {
  try {
    return one<BookingConfig>(await api.get(`booking/config/${profileId}`).json());
  } catch {
    return null;
  }
}
export async function createBookingConfig(profileId: string, body: Partial<BookingConfig>) {
  // One-step activation: creating the config sends the active state directly, so
  // there's no separate /toggle call to enable booking (backend contract).
  return readOne<BookingConfig>(
    api.post("booking/config", { json: { profileId, isEnabled: true, ...body } }),
    { profileId, isEnabled: true, ...body },
  );
}
export async function updateBookingConfig(profileId: string, body: Partial<BookingConfig>) {
  return readOne<BookingConfig>(api.patch(`booking/config/${profileId}`, { json: body }), {
    profileId,
    ...body,
  });
}
export async function toggleBookingConfig(profileId: string): Promise<boolean> {
  // Mobile reads response.data.isEnabled (a bool).
  const res = await readOne<{ isEnabled?: boolean }>(
    api.patch(`booking/config/${profileId}/toggle`),
    {},
  );
  return !!res?.isEnabled;
}
// Stripe is ACCOUNT-level (shared across all profiles), not profile-scoped — the
// profile-level endpoints are deprecated (mobile links.dart: booking/account/stripe/*).
export async function getStripeStatus(): Promise<StripeStatus | null> {
  try {
    return one<StripeStatus>(await api.get("booking/account/stripe/status").json());
  } catch {
    return null;
  }
}
export async function getStripeOnboardUrl() {
  return one<{ onboardingUrl?: string }>(
    await api.post("booking/account/stripe/onboard").json(),
  );
}

// ─── Providers ──────────────────────────────────────────────────────────────
export async function listProviders(profileId: string): Promise<Provider[]> {
  return arr<Provider>(
    await api.get("booking/providers", { searchParams: { profileId } }).json(),
  );
}
export async function createProvider(profileId: string, body: Partial<Provider>) {
  return readOne<Provider>(api.post("booking/providers", { json: { profileId, ...body } }), {
    profileId,
    ...body,
  } as Provider);
}
export async function updateProvider(id: string, body: Partial<Provider>) {
  return readOne<Provider>(api.patch(`booking/providers/${id}`, { json: body }), {
    _id: id,
    ...body,
  } as Provider);
}
export async function deleteProvider(id: string) {
  return api.delete(`booking/providers/${id}`).json();
}
/** GET one provider — includes the portal `secretCode` (lists don't). */
export async function getProvider(id: string): Promise<Provider | null> {
  try {
    return one<Provider>(await api.get(`booking/providers/${id}`).json());
  } catch {
    return null;
  }
}
/** Regenerate a provider's portal code (invalidates the old code + sessions). */
export async function regenerateProviderCode(id: string) {
  return readOne<{ secretCode?: string }>(
    api.post(`booking/providers/${id}/regenerate-code`),
    {},
  );
}

// ─── Services ───────────────────────────────────────────────────────────────
export async function listServices(profileId: string): Promise<Service[]> {
  return arr<Service>(
    await api.get("booking/services", { searchParams: { profileId } }).json(),
  );
}
export async function createService(profileId: string, body: Partial<Service>) {
  return readOne<Service>(api.post("booking/services", { json: { profileId, ...body } }), {
    profileId,
    ...body,
  } as Service);
}
export async function updateService(id: string, body: Partial<Service>) {
  return readOne<Service>(api.patch(`booking/services/${id}`, { json: body }), {
    _id: id,
    ...body,
  } as Service);
}
export async function deleteService(id: string) {
  return api.delete(`booking/services/${id}`).json();
}

// ─── Extras (add-ons) ────────────────────────────────────────────────────────
// integration-guide-0.md §3 (admin) + §4.1 (public resolver).
export async function listExtras(params: {
  profileId: string;
  serviceId?: string;
}): Promise<Extra[]> {
  const search: Record<string, string> = { profileId: params.profileId };
  if (params.serviceId) search.serviceId = params.serviceId;
  const items = arr<Extra>(
    await api.get("booking/extras", { searchParams: search }).json(),
  );
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export async function createExtra(
  profileId: string,
  serviceId: string,
  body: Partial<Extra>,
) {
  return readOne<Extra>(
    api.post("booking/extras", { json: { profileId, serviceId, ...body } }),
    { profileId, serviceId, ...body } as Extra,
  );
}
export async function updateExtra(id: string, body: Partial<Extra>) {
  return readOne<Extra>(api.patch(`booking/extras/${id}`, { json: body }), {
    _id: id,
    ...body,
  } as Extra);
}
export async function deleteExtra(id: string) {
  // Soft delete (sets isActive:false) — returns the now-inactive extra.
  return readOne<Extra>(api.delete(`booking/extras/${id}`), { _id: id } as Extra);
}
/** Public resolver — merged (own + inherited) extras for a bookable leaf. */
export async function listExtrasForService(
  profileId: string,
  serviceId: string,
): Promise<Extra[]> {
  return arr<Extra>(
    await api.get(`booking/extras/public/${profileId}/for-service/${serviceId}`).json(),
  );
}

// ─── Provider-Services pivot ─────────────────────────────────────────────────
export async function listProviderServices(params: {
  profileId?: string;
  providerId?: string;
  serviceId?: string;
}): Promise<ProviderService[]> {
  const search: Record<string, string> = {};
  if (params.profileId) search.profileId = params.profileId;
  if (params.providerId) search.providerId = params.providerId;
  if (params.serviceId) search.serviceId = params.serviceId;
  return arr<ProviderService>(
    await api.get("booking/provider-services", { searchParams: search }).json(),
  );
}

export async function linkProviderService(body: {
  profileId: string;
  providerId: string;
  serviceId: string;
  price?: number | null;
  duration?: number | null;
}) {
  return readOne<ProviderService>(
    api.post("booking/provider-services", { json: body }),
    { providerId: body.providerId, serviceId: body.serviceId },
  );
}

export async function updateProviderService(
  id: string,
  body: { price?: number | null; duration?: number | null; isActive?: boolean },
) {
  return readOne<ProviderService>(
    api.patch(`booking/provider-services/${id}`, { json: body }),
    { _id: id, providerId: "", serviceId: "" },
  );
}

export async function unlinkProviderService(id: string) {
  return api.delete(`booking/provider-services/${id}`).json();
}

// ─── Bookings ───────────────────────────────────────────────────────────────
export async function listBookings(params: {
  profileId: string;
  status?: BookingStatus | null;
  providerId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
}) {
  const search: Record<string, string> = {
    profileId: params.profileId,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  };
  if (params.status) search.status = params.status;
  if (params.providerId) search.providerId = params.providerId;
  if (params.dateFrom) search.dateFrom = params.dateFrom;
  if (params.dateTo) search.dateTo = params.dateTo;
  if (params.search) search.search = params.search;
  const res = await api.get("booking/dashboard/bookings", { searchParams: search }).json();
  const env = listEnvelope<Booking>(res, "bookings");
  return { ...env, items: env.items.map(normalizeBooking) };
}
export async function getBooking(ref: string): Promise<Booking | null> {
  try {
    return normalizeBooking(one(await api.get(`booking/dashboard/bookings/${ref}`).json()));
  } catch {
    return null;
  }
}
export async function updateBookingStatus(ref: string, status: BookingStatus) {
  return readOne<Booking>(
    api.patch(`booking/dashboard/bookings/${ref}/status`, { json: { status } }),
    { bookingRef: ref, status },
  );
}
export async function refundBooking(ref: string) {
  return api.post(`booking/dashboard/bookings/${ref}/refund`).json();
}

// ─── Customers ──────────────────────────────────────────────────────────────
export async function listCustomers(params: {
  profileId: string;
  search?: string;
  page?: number;
}) {
  const sp: Record<string, string> = {
    profileId: params.profileId,
    page: String(params.page ?? 1),
  };
  if (params.search) sp.search = params.search;
  const res = await api.get("booking/dashboard/customers", { searchParams: sp }).json();
  return listEnvelope<Customer>(res, "customers");
}
export async function getCustomer(id: string): Promise<Customer | null> {
  try {
    return one<Customer>(await api.get(`booking/dashboard/customers/${id}`).json());
  } catch {
    return null;
  }
}
export async function updateCustomer(id: string, body: Partial<Customer>) {
  return readOne<Customer>(api.patch(`booking/dashboard/customers/${id}`, { json: body }), {
    _id: id,
    ...body,
  } as Customer);
}

// ─── Analytics ──────────────────────────────────────────────────────────────
export async function getBookingAnalytics(profileId: string): Promise<BookingAnalytics> {
  try {
    // Mobile reads response.data — unwrap the envelope (raw body is { status, data }).
    return one<BookingAnalytics>(
      await api.get("booking/dashboard/analytics", { searchParams: { profileId } }).json(),
    );
  } catch {
    return {};
  }
}

// ─── Google Calendar sync endpoints ─────────────────────────────────────────
/**
 * Start linking — returns the Google consent `authUrl` to open in a popup.
 * Returns `{ error }` instead of throwing so the UI can detect "not configured"
 * (400 "Google Calendar is not configured") and hide the feature gracefully.
 */
export async function getGoogleCalendarConnectUrl(
  providerId: string,
): Promise<{ authUrl?: string; error?: string }> {
  try {
    const res = one<{ authUrl?: string }>(
      await api.get(`booking/providers/${providerId}/google-calendar/connect`).json(),
    );
    return { authUrl: res?.authUrl };
  } catch (e) {
    let message = "";
    try {
      const r = (e as { response?: Response })?.response;
      const body = r ? ((await r.json()) as { message?: string }) : null;
      message = body?.message ?? "";
    } catch {
      /* ignore — fall through to a generic error */
    }
    return { error: message || "error" };
  }
}

export async function getGoogleCalendarStatus(
  providerId: string,
): Promise<GoogleCalendarStatus> {
  try {
    return one<GoogleCalendarStatus>(
      await api.get(`booking/providers/${providerId}/google-calendar/status`).json(),
    );
  } catch {
    return { connected: false, googleEmail: null, lastSyncedAt: null, status: null };
  }
}

export async function disconnectGoogleCalendar(providerId: string) {
  return readOne<{ disconnected?: boolean }>(
    api.delete(`booking/providers/${providerId}/google-calendar`),
    { disconnected: true },
  );
}

/** Merged platform bookings + Google busy blocks (sorted by startTimeUTC). */
export async function getDashboardCalendar(params: {
  profileId: string;
  providerId?: string;
  from?: string;
  to?: string;
}): Promise<CalendarItem[]> {
  const search: Record<string, string> = { profileId: params.profileId };
  if (params.providerId) search.providerId = params.providerId;
  if (params.from) search.from = params.from;
  if (params.to) search.to = params.to;
  return arr<CalendarItem>(
    await api.get("booking/dashboard/calendar", { searchParams: search }).json(),
  );
}

export const idOf = (x: { _id?: string; id?: string }) => x._id ?? x.id ?? "";
