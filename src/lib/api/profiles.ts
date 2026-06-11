import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";
import type { ProfileSummary } from "@/lib/types/profile";

export async function listProfiles() {
  const res = await api
    .get("q-profile/user/index")
    .json<ApiResponse<ProfileSummary[]>>();
  return res.data ?? [];
}

export async function checkUserName(name: string) {
  return api
    .post("q-profile/user/check-user-name", {
      body: new URLSearchParams({ name }),
    })
    .json<ApiResponse<unknown>>();
}
