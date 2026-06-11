import type { ArgbColor, Block } from "./blocks";

// Hero / settings entity (mobile: settings_entity.dart). Partial — extended per phase.
export interface CoverPhoto {
  image_url?: string;
  hide?: boolean;
  shape?: "horizontal" | "square" | "poster" | "vertical";
  color?: ArgbColor;
}

export interface ProfilePicture {
  image_url?: string;
  image_rect?: [number, number, number, number];
  shape?: "circle" | "square" | "rectangle";
  alignment?: "center" | "start" | "end";
  hide?: boolean;
  border_width?: number;
  border_color?: ArgbColor;
}

export interface TextField {
  text?: string;
  color?: ArgbColor;
  hide?: boolean;
}

export interface WebsiteSettings {
  cover_photo?: CoverPhoto;
  profile_picture?: ProfilePicture;
  logo?: { image_url?: string };
  name?: TextField;
  bio?: TextField | string;
  modules?: Block[];
}

// Dashboard list item (mobile: website_model.dart).
export interface ProfileSummary {
  _id: string;
  id?: string;
  name: string;
  type?: "redirect" | "profile" | string;
  thumbnail_url?: string;
  user_name?: string;
  [key: string]: unknown;
}

export interface Profile extends ProfileSummary {
  settings?: WebsiteSettings;
}
