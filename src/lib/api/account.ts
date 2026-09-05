import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export interface AccountUser {
  _id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
  isCompany?: boolean;
  verifiedAt?: string | null;
  /** Per-user website-count overrides (0 = not set → the plan decides).
      Selected by `plan.free` — see lib/plan/features.ts websiteCountAvailable. */
  maxFreeProfilesCount?: number;
  maxPremProfilesCount?: number;
}

/** One entry of plan.planFeatures[] — value vocabulary "Yes"/"No"/"Multiple"/numeric string. */
export interface PlanFeature {
  value?: string;
  feature?: { code?: string; name?: string };
}

export interface AccountPlan {
  name?: string;
  free?: boolean;
  color?: string; // hex without '#', e.g. "FFAF05"
  /** The plan's feature grants, flattened by lib/plan/features.ts into code → value. */
  planFeatures?: PlanFeature[];
}

/**
 * A pending email-change request (docs/email-change.md): `user.email` stays the
 * CURRENT address until the user clicks the link mailed to `newEmail`. Use
 * `canResendAt` to gate the resend button (60s server cooldown).
 */
export interface PendingEmailChange {
  newEmail: string;
  requestedAt: string;
  expiresAt: string;
  canResendAt: string;
}

export interface Account {
  user: AccountUser;
  plan?: AccountPlan;
  expireSubscribe?: string | null;
  qrCodeStaticCount?: number;
  qrCodeDynamicCount?: number;
  profileCounts?: number;
  domainLinksRequestCount?: number;
  /** `null` when nothing is pending (added with the email-change feature). */
  pendingEmailChange?: PendingEmailChange | null;
}

export async function getAccount() {
  const res = await api.get("account").json<ApiResponse<Account>>();
  return res.data;
}

// ─── Personal info mutations (mirror mobile ProfileDataSource) ───────────────

/** POST account/update-name — { name }. */
export async function updateName(name: string) {
  return api
    .post("account/update-name", { body: new URLSearchParams({ name }) })
    .json<ApiResponse<unknown>>();
}

/** POST account/update-image — multipart { image }; backend returns { user: { image } }. */
export async function updateImage(image: File) {
  const body = new FormData();
  body.append("image", image);
  const res = await api
    .post("account/update-image", { body })
    .json<{ user?: { image?: string | null } }>();
  return res.user?.image ?? null;
}

/** GET account/password-status — whether the account already has a password (social users may not). */
export async function getPasswordStatus() {
  const res = await api
    .get("account/password-status")
    .json<ApiResponse<{ password: boolean }>>();
  return Boolean(res.data?.password);
}

/** POST account/update-password — { oldPassword?, newPassword }. */
export async function changePassword(params: {
  oldPassword?: string;
  newPassword: string;
}) {
  const body = new URLSearchParams();
  if (params.oldPassword) body.append("oldPassword", params.oldPassword);
  body.append("newPassword", params.newPassword);
  return api
    .post("account/update-password", { body })
    .json<ApiResponse<unknown>>();
}

/** POST account/delete — permanently delete the account. */
export async function deleteAccount() {
  return api.post("account/delete").json<ApiResponse<unknown>>();
}

// ─── Email change (docs/email-change.md; mirrors mobile ProfileDataSource) ───

/**
 * POST account/request-email-change — start an email change. Never changes the
 * account email by itself; a confirmation link is mailed to `newEmail`.
 * `password` is required unless the account has none (social sign-in) — check
 * with {@link getPasswordStatus} first. 400: wrong password / already current /
 * already in use. Rate limited 3/min.
 */
export async function requestEmailChange(params: {
  newEmail: string;
  password?: string;
}): Promise<PendingEmailChange | null> {
  const body: Record<string, string> = { newEmail: params.newEmail };
  if (params.password != null) body.password = params.password;
  const res = await api
    .post("account/request-email-change", { json: body })
    .json<ApiResponse<{ pendingEmailChange: PendingEmailChange | null }>>();
  return res.data?.pendingEmailChange ?? null;
}

/**
 * POST account/resend-email-change — re-mail the confirmation link (ROTATES the
 * token; older links die). 400 inside the 60s cooldown (`canResendAt`) or when
 * the address got taken meanwhile (the request is dropped). Rate limited 3/min.
 */
export async function resendEmailChange(): Promise<PendingEmailChange | null> {
  const res = await api
    .post("account/resend-email-change")
    .json<ApiResponse<{ pendingEmailChange: PendingEmailChange | null }>>();
  return res.data?.pendingEmailChange ?? null;
}

/** POST account/cancel-email-change — drop the pending request. */
export async function cancelEmailChange(): Promise<void> {
  await api.post("account/cancel-email-change").json<ApiResponse<unknown>>();
}
