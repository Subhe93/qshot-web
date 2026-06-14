import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

// Profile-transfer requests (mirror mobile WebsiteTransferIn/Out data sources).
// Incoming  → q-profile/temp-receive/*  (index / accept / reject)
// Outgoing  → q-profile/temp-move/*     (index / delete)

export interface TransferSourceUser {
  _id: string;
  name: string;
}

export interface TransferProfile {
  _id: string;
  sourceUser?: TransferSourceUser | null;
  destUser?: string;
  status: string;
  createdAt: string;
  userProfileTemplate: {
    _id: string;
    name: string;
    info: {
      image?: string | null;
      username: string;
      bio: string;
    };
  };
}

interface TransferListPayload {
  profiles: TransferProfile[];
}

export async function getTransferIn() {
  const res = await api
    .get("q-profile/temp-receive/index")
    .json<ApiResponse<TransferListPayload>>();
  return res.data?.profiles ?? [];
}

export async function acceptTransferIn(id: string) {
  return api
    .post("q-profile/temp-receive/accept", { body: new URLSearchParams({ id }) })
    .json<ApiResponse<unknown>>();
}

export async function rejectTransferIn(id: string) {
  return api
    .post("q-profile/temp-receive/reject", { body: new URLSearchParams({ id }) })
    .json<ApiResponse<unknown>>();
}

export async function getTransferOut() {
  const res = await api
    .get("q-profile/temp-move/index")
    .json<ApiResponse<TransferListPayload>>();
  return res.data?.profiles ?? [];
}

export async function deleteTransferOut(id: string) {
  return api
    .post("q-profile/temp-move/delete", { body: new URLSearchParams({ id }) })
    .json<ApiResponse<unknown>>();
}
