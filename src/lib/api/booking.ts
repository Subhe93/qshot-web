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
  order?: number;
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
  currency?: string;
  createdAt?: string;
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
  last30Days?: { revenue?: number; bookingCount?: number };
  byProvider?: Array<{ name?: string; bookingCount?: number; revenue?: number }>;
  byService?: Array<{ name?: string; bookingCount?: number; revenue?: number }>;
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

// Helper: unwrap { data } | array | object.
function arr<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const d = (res as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}
function meta(res: unknown): { total: number; totalPages: number; page: number } {
  const m = (res as { meta?: { total?: number; totalPages?: number; page?: number } })?.meta;
  return { total: m?.total ?? 0, totalPages: m?.totalPages ?? 1, page: m?.page ?? 1 };
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
  return readOne<BookingConfig>(api.post("booking/config", { json: { profileId, ...body } }), {
    profileId,
    ...body,
  });
}
export async function updateBookingConfig(profileId: string, body: Partial<BookingConfig>) {
  return readOne<BookingConfig>(api.patch(`booking/config/${profileId}`, { json: body }), {
    profileId,
    ...body,
  });
}
export async function toggleBookingConfig(profileId: string) {
  return readOne<BookingConfig>(api.patch(`booking/config/${profileId}/toggle`), { profileId });
}
export async function getStripeStatus(profileId: string): Promise<StripeStatus | null> {
  try {
    return await api.get(`booking/config/${profileId}/stripe/status`).json<StripeStatus>();
  } catch {
    return null;
  }
}
export async function getStripeOnboardUrl(profileId: string) {
  return api
    .post(`booking/config/${profileId}/stripe/onboard`)
    .json<{ onboardingUrl?: string }>();
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
  page?: number;
  limit?: number;
}) {
  const search: Record<string, string> = {
    profileId: params.profileId,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  };
  if (params.status) search.status = params.status;
  const res = await api.get("booking/dashboard/bookings", { searchParams: search }).json();
  return { items: arr<Booking>(res), ...meta(res) };
}
export async function getBooking(ref: string): Promise<Booking | null> {
  try {
    return one<Booking>(await api.get(`booking/dashboard/bookings/${ref}`).json());
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
  return { items: arr<Customer>(res), ...meta(res) };
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
    return await api
      .get("booking/dashboard/analytics", { searchParams: { profileId } })
      .json<BookingAnalytics>();
  } catch {
    return {};
  }
}

export const idOf = (x: { _id?: string; id?: string }) => x._id ?? x.id ?? "";
