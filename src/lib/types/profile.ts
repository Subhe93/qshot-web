/**
 * Website SETTINGS model (mobile: settings_entity.dart + profile/cover/header/
 * button/card_style/color entities). Captured in docs/web-app-study/CONTRACT-json.md.
 *
 * Every key mirrors the real JSON 1:1 (snake_case). Colors are ARGB ints, except
 * background.color_value.color which may also be a hex string (correction ❶).
 * Unknown settings keys (e.g. the legacy `header_text`) are preserved via the
 * index signature + serialization passthrough (correction ❷).
 */

import type { ArgbColor, Block, ImageAlignment } from "./blocks";
import type { ColorValue } from "@/lib/builder/color-value";

export type HeroStyle =
  | "style1"
  | "style2"
  | "style3"
  | "style4"
  | "style5"
  | "style6"
  | "style7";

export type CoverPhotoSize = "horizontal" | "square" | "poster" | "vertical";

// Hero editing tabs (mobile HeroTab enum). name/bio open separate sheets.
export type HeroTab =
  | "style"
  | "header"
  | "picture"
  | "cover"
  | "title"
  | "text"
  | "button1"
  | "button2"
  | "name"
  | "bio";
export type ImageShape = "circle" | "square" | "rectangle";
export type HeaderPosition = "aboveCover" | "onCover";
export type FloatingButtonVariant =
  | "whatsapp"
  | "phone"
  | "email"
  | "telegram"
  | "messenger"
  | "customLink"
  | "form"
  | "buyNow";

/** A 4-tuple crop rect [left, top, right, bottom]. */
export type RectTuple = [number, number, number, number];

// HeroText shape — used by `title`, `text`, and `header.title`.
export interface HeroText {
  hide?: boolean | null;
  text?: string | null;
  color?: ArgbColor | null;
}

export interface Logo {
  image_url?: string | null;
  hide?: boolean | null;
}

export interface Header {
  hide?: boolean | null;
  title?: HeroText | null;
  leading_alignment?: ImageAlignment | null;
  foreground_color?: ArgbColor | null;
  background_color?: ArgbColor | null;
  position?: HeaderPosition | null;
  background_opacity?: number | null;
  /** NOTE: literal camelCase key `fillSides`, unlike the snake_case siblings. */
  fillSides?: boolean | null;
}

export interface ProfilePicture {
  image_url?: string | null;
  image_rect?: RectTuple | null;
  hide?: boolean | null;
  alignment?: ImageAlignment | null;
  shape?: ImageShape | null;
  border_width?: number | null;
  border_color?: ArgbColor | null;
}

export interface CoverPhoto {
  image_url?: string | null;
  image_rect?: RectTuple | null;
  hide?: boolean | null;
  /** Cover aspect-ratio selector — JSON key is `size`, NOT `shape`. */
  size?: CoverPhotoSize | null;
  transparency?: number | null;
  fade?: boolean | null;
  /** ARGB int overlay tint (distinct from background.color_value). */
  color?: ArgbColor | null;
}

export interface HeroButton {
  hide?: boolean | null;
  text?: string | null;
  url?: string | null;
  foreground_color?: ArgbColor | null;
  background_color?: ArgbColor | null;
}

export interface PageBackground {
  image?: string | null;
  color_value?: ColorValue | null;
}

export interface NameField {
  text?: string | null;
  alignment?: ImageAlignment | null;
  hide?: boolean | null;
  color?: ArgbColor | null;
}

export interface BioField {
  text?: string | null;
  alignment?: ImageAlignment | null;
  hide?: boolean | null;
}

export interface FloatingButton {
  hide?: boolean | null;
  values?: Record<string, Record<string, string | null>>;
  type?: FloatingButtonVariant | null;
}

export interface CardStyle {
  color?: ArgbColor | null;
}

export interface WebsiteSettings {
  website_logo?: string | null;
  website_name?: string | null;
  style?: HeroStyle;
  logo?: Logo;
  header?: Header;
  /** Legacy/un-modeled key seen in real data — preserved verbatim (correction ❷). */
  header_text?: HeroText | null;
  profile_picture?: ProfilePicture;
  cover_photo?: CoverPhoto;
  title?: HeroText;
  text?: HeroText;
  button1?: HeroButton;
  button2?: HeroButton;
  background?: PageBackground;
  name?: NameField;
  bio?: BioField;
  floating_button?: FloatingButton;
  font_family?: string | null;
  font_color?: ArgbColor | null;
  card_style?: CardStyle;
  can_save_contact?: boolean;
  index_in_google?: boolean;
  /** Website verification flag (mobile: EditorConfig.verified). Shows a verified badge next to the name. */
  verified?: boolean;
  /** Blocks may live here in legacy payloads; canonical location is info.modules. */
  modules?: Block[];
  /** Preserve any other backend keys on round-trip. */
  [key: string]: unknown;
}

// Dashboard list item (mobile: website_model.dart). The list endpoint
// `q-profile/user/index` returns full models carrying settings + info(blocks).
export interface ProfileSummary {
  _id: string;
  id?: string;
  name: string;
  type?: string;
  thumbnail_url?: string;
  user_name?: string;
  [key: string]: unknown;
}

// The webpage content (mobile: WebpageEntity) — blocks live here as `modules`.
export interface Webpage {
  modules?: Block[];
}

export interface Profile extends ProfileSummary {
  settings?: WebsiteSettings;
  info?: Webpage;
  websiteName?: string;
  unreadContactFormMessages?: number;
}
