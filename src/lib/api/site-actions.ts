import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

/**
 * Website settings actions — Activate Card (link a QR/card number to the site) and
 * Transfer (temporarily move the site to another user). Mirrors the mobile
 * q-profile/profile-qr-code-number/* and q-profile/temp-move/* endpoints.
 */

// ── Activate card (QR number) ──────────────────────────────────────────────

export async function getQrNumber(profileId: string): Promise<string> {
  const res = await api
    .get("q-profile/profile-qr-code-number/show-by-profile", {
      searchParams: { userProfileTamplateId: profileId },
    })
    .json<ApiResponse<{ qrcodeNumber?: string }>>()
    .catch(() => null);
  return res?.data?.qrcodeNumber ?? "";
}

export async function createQrNumber(profileId: string, qrcodeNumber: string) {
  return api
    .post("q-profile/profile-qr-code-number/create", {
      json: { userProfileTamplateId: profileId, qrcodeNumber },
    })
    .json<ApiResponse<unknown>>();
}

// ── Transfer (temp-move) ───────────────────────────────────────────────────

/** Resolve a destination user's display name (throws/null if not found). */
export async function getTransferUserName(user: string): Promise<string | null> {
  const res = await api
    .get(`q-profile/temp-move/get-name/${encodeURIComponent(user)}`)
    .json<ApiResponse<{ name?: string }>>()
    .catch(() => null);
  return res?.data?.name ?? null;
}

export async function transferSite(destUser: string, profileTemplate: string) {
  return api
    .post("q-profile/temp-move/store", {
      json: { destUser, profileTemplate },
    })
    .json<ApiResponse<unknown>>();
}
