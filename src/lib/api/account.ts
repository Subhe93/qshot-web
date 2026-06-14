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
}

export interface AccountPlan {
  name?: string;
  free?: boolean;
  color?: string; // hex without '#', e.g. "FFAF05"
}

export interface Account {
  user: AccountUser;
  plan?: AccountPlan;
  expireSubscribe?: string | null;
  qrCodeStaticCount?: number;
  qrCodeDynamicCount?: number;
  profileCounts?: number;
  domainLinksRequestCount?: number;
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
