import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";
import type { Profile, ProfileSummary } from "@/lib/types/profile";

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

// Best-effort single-profile load: the list endpoint carries each profile's
// settings, so we find the one we need there.
export async function getProfile(id: string): Promise<Profile | null> {
  const all = await listProfiles();
  return (all.find((p) => p._id === id || p.id === id) as Profile) ?? null;
}

// Persist the edited profile. Payload shape mirrors the mobile edit call;
// settings (hero + modules) is sent as a JSON string.
export async function saveProfile(
  id: string,
  name: string,
  settings: unknown,
) {
  return api
    .post("q-profile/user/edit", {
      body: new URLSearchParams({
        id,
        name,
        settings: JSON.stringify(settings),
      }),
    })
    .json<ApiResponse<unknown>>();
}
