import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";
import type { Profile, ProfileSummary, WebsiteSettings, HeroStyle } from "@/lib/types/profile";
import type { Block } from "@/lib/types/blocks";
import {
  parseBlocks,
  parseSettings,
  serializeBlocks,
  serializeSettings,
} from "@/lib/builder/serialization";
import { fillDefaults } from "@/lib/builder/hero-defaults";

// The list endpoint returns the user's + employee profiles, each a FULL model
// carrying `settings` and `info: { modules }` (the blocks).
interface UserWebsiteData {
  user_template_profiles?: Profile[];
  employee_template_profiles?: Profile[];
}

export async function listProfiles(): Promise<Profile[]> {
  const res = await api
    .get("q-profile/user/index")
    .json<ApiResponse<UserWebsiteData>>();
  const data = res.data ?? {};
  return [
    ...(data.user_template_profiles ?? []),
    ...(data.employee_template_profiles ?? []),
  ];
}

export async function checkUserName(name: string) {
  return api
    .post("q-profile/user/check-user-name", {
      body: new URLSearchParams({ name }),
    })
    .json<ApiResponse<unknown>>();
}

// The list response already carries each profile's full settings + info(blocks),
// so we resolve a single profile from there (mirrors the mobile app, which passes
// the already-loaded model straight into the editor — no separate fetch). Blocks
// and settings are parsed here (mobile fromJson defaults) so the editor always
// works with normalized data regardless of which keys the backend omitted.
export async function getProfile(id: string): Promise<Profile | null> {
  const all = await listProfiles();
  const profile = all.find((p) => p._id === id || p.id === id) ?? null;
  if (!profile) return null;
  const rawBlocks =
    profile.info?.modules ??
    (profile.settings?.modules as unknown[] | undefined) ??
    [];
  return {
    ...profile,
    settings: parseSettings(profile.settings),
    info: { ...profile.info, modules: parseBlocks(rawBlocks) },
  };
}

// Persist the edited profile — JSON body matching the mobile StoreWebsiteRequest:
// blocks live under `info.modules`, hero/style/logo under `settings`.
export async function saveProfile(
  id: string,
  name: string,
  blocks: Block[],
  settings: WebsiteSettings,
) {
  return api
    .post("q-profile/user/edit", {
      json: {
        id,
        name,
        info: { modules: serializeBlocks(blocks) },
        settings: serializeSettings(settings),
      },
    })
    .json<ApiResponse<unknown>>();
}

// The default backend template id used on create (mobile: kMainTemplate).
export const MAIN_TEMPLATE = "6627d338fbcf288835ef634b";

// Upload a logo/image — mirrors mobile websiteImageUpload (q-profile/image/create);
// returns the stored file name (CDN path).
export async function uploadProfileImage(file: File): Promise<string | null> {
  // Field name is `images` (Postman collection "upload new profile image" +
  // mobile UploadImageRequest). Response: { data: [ { file_name } ] }.
  const body = new FormData();
  body.append("images", file);
  const res = await api
    .post("q-profile/image/create", { body })
    .json<ApiResponse<Array<{ file_name?: string }>>>();
  const data = res.data;
  if (Array.isArray(data)) return data[0]?.file_name ?? null;
  return null;
}

export interface CreateProfileInput {
  domain: string;
  websiteName: string;
  websiteLogo?: string | null;
  style: string; // HeroStyle, e.g. "style2"
}

// Create a new website — mirrors mobile StoreWebsiteRequest. `name` carries the
// domain/slug; settings is the chosen style's FULL template defaults merged with
// the user's name/logo (mobile SettingsEntity.fillDefaults), so the new site
// arrives pre-populated with the template's hero (cover/title/text/buttons).
export async function createProfile(
  input: CreateProfileInput,
): Promise<ProfileSummary | null> {
  const settings = serializeSettings(
    fillDefaults(input.style as HeroStyle, {
      websiteName: input.websiteName,
      websiteLogo: input.websiteLogo ?? null,
    }),
  );
  const res = await api
    .post("q-profile/user/create", {
      json: {
        name: input.domain,
        profileTamplate: MAIN_TEMPLATE,
        info: { modules: [] },
        settings,
      },
    })
    .json<ApiResponse<ProfileSummary>>();
  return res.data ?? null;
}

// Delete a website — mirrors mobile DeleteWebsiteRequest (POST q-profile/user/delete, body { id }).
export async function deleteProfile(id: string) {
  return api
    .post("q-profile/user/delete", { json: { id } })
    .json<ApiResponse<unknown>>();
}
