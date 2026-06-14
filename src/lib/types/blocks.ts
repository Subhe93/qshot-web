/**
 * TypeScript model for the 17 builder block types.
 *
 * SOURCE OF TRUTH: the Flutter mobile app
 * `lib/features/website/domain/entities/block_entity.dart`, captured verbatim in
 * `docs/web-app-study/CONTRACT-json.md`. The shapes below mirror the real JSON
 * keys 1:1 (snake_case, `*Module` / `social_links` discriminators) so a site
 * built in the mobile app loads, edits and saves with byte-identical JSON.
 *
 * Rules:
 *  - `type` values are the EXACT mobile blockName constants.
 *  - Field names are the EXACT JSON keys (snake_case). Do NOT invent camelCase.
 *  - Colors are ARGB integers (0xAARRGGBB) via Color.toARGB32(), except
 *    `settings.background.color_value.color` which may also arrive as a hex
 *    string (see profile.ts / serialization.ts).
 *  - Unknown keys are preserved on round-trip (serialization spreads the raw
 *    object); only the keys we actively edit are typed here.
 */

export type ArgbColor = number;

// ---- Layout type enums (per block) — exact mobile `.name` values ----
export type SocialLinksLayoutType =
  | "gridAlignStart"
  | "gridAlignEnd"
  | "gridAlignCenter"
  | "layoutSlider"
  | "grid"
  | "list"
  | "listAlignEnd"
  | "listAlignCenter";

export type ExternalLinksLayoutType =
  | "largeGrid"
  | "list"
  | "grid"
  | "swiper"
  | "swiper2"
  | "promo";

export type VideoLinksLayoutType = "swiper" | "list" | "grid";

export type ProductsLayoutType =
  | "grid"
  | "swiper"
  | "swiper2"
  | "swiper3"
  | "list"
  | "promo"
  | "shop"
  | "grid2"
  | "banner";

export type ImagesLayoutType =
  | "cards"
  | "carousel"
  | "shorts"
  | "swiper"
  | "singleSizable";

export type ButtonsLayoutType = "list" | "grid";

export type ButtonThemeType = "minimal" | "solid" | "soft" | "outline" | "pill";

export type ReviewsLayoutType = "cards" | "list" | "testimonial";

export type SocialFeedLayoutType = "swiper" | "list" | "grid";

export type SocialIconType = "original" | "darkFilled";

export type ImageAlignment = "start" | "center" | "end";

export type FeedConfiguration = "youtube" | "vimeo" | "instagram";

export type EmbedConfiguration =
  | "custom"
  | "youtube"
  | "tiktok"
  | "twitter"
  | "telegram"
  | "vimeo"
  | "pinterest"
  | "behance";

// Social link item `type` — LinkConfiguration.name (non-throwing, falls back to "link").
export type LinkConfigurationName =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "snapchat"
  | "whatsapp"
  | "twitter"
  | "youtube"
  | "pinterest"
  | "twitch"
  | "vimeo"
  | "behance"
  | "wechat"
  | "phone"
  | "email"
  | "link"
  | "website"
  | "location"
  | "custom";

// ---- Discriminator: EXACT mobile blockName constants ----
export type BlockType =
  | "social_links"
  | "ExternalLinksModule"
  | "VideoLinksModule"
  | "ProductsModule"
  | "ImageModule"
  | "ReviewsModule"
  | "HeaderModule"
  | "ParagraphModule"
  | "SpacerModule"
  | "DividerModule"
  | "ButtonModule"
  | "SocialFeedModule"
  | "FormModule"
  | "LocationModule"
  | "EmbedModule"
  | "IntroductionVideoModule"
  | "BookingModule";

// ---- Common fields shared by every block ----
export interface BaseBlock {
  id: string;
  type: BlockType;
  hide?: boolean;
  use_background_color?: boolean;
  background_color?: ArgbColor | null;
}

// NamedBlock adds a `title` heading.
interface NamedBlock extends BaseBlock {
  title: string;
}

// ---- Item shapes (exact JSON keys) ----
export interface SocialLinkItem {
  id?: string;
  type: LinkConfigurationName | string;
  icon?: string | null;
  /** NOTE: the URL/value lives under `link`, NOT `url`. */
  link: string;
  name?: string | null;
  hidden?: boolean;
}

export interface ExternalLinkItem {
  id?: string;
  title?: string;
  url?: string;
  icon?: string | null;
  thumbnail_url?: string | null;
  description?: string | null;
  hidden?: boolean;
  [key: string]: unknown;
}

export interface VideoLinkItem {
  id?: string;
  title?: string;
  url?: string;
  thumbnail_url?: string | null;
  hidden?: boolean;
  [key: string]: unknown;
}

export interface ProductItem {
  id?: string;
  thumbnail_url?: string | null;
  url?: string;
  title?: string;
  description?: string;
  currency?: string | null;
  /** Prices are STRINGS in the mobile contract, not numbers. */
  price?: string | null;
  price_after_discount?: string | null;
  hidden?: boolean;
}

export interface ImageItem {
  id?: string;
  url: string;
  /** [left, top, right, bottom] crop rect. */
  rect?: [number, number, number, number] | null;
  hidden?: boolean;
}

export interface ButtonItem {
  id?: string;
  title: string;
  url?: string | null;
  icon?: string | null;
  hidden?: boolean;
  background_color?: ArgbColor | null;
  use_background_color?: boolean | null;
  border_color?: ArgbColor | null;
  use_border?: boolean | null;
  text_color?: ArgbColor | null;
  use_text_color?: boolean | null;
  corner_radius?: number | null;
}

export interface ReviewItem {
  id?: string;
  reviewer_name?: string;
  reviewer_photo_url?: string | null;
  rating?: number;
  text?: string;
  relative_time_description?: string;
  hidden?: boolean;
  locked?: boolean;
  google_review_key?: string | null;
}

export interface EmbedData {
  url?: string;
  html?: string;
  author_name?: string | null;
  author_url?: string | null;
  provider_name?: string | null;
  provider_url?: string | null;
  title?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  /** NOTE: camelCase in the mobile contract, unlike its snake_case siblings. */
  thumbnailUrl?: string | null;
  /** NOTE: camelCase in the mobile contract. */
  aspectRatio?: number | null;
}

// ---- Concrete blocks ----
export interface SocialLinksBlock extends BaseBlock {
  type: "social_links";
  layout_type: SocialLinksLayoutType;
  icon_type: SocialIconType;
  adaptive_icon_color?: boolean;
  custom_icon_color?: ArgbColor | null;
  links: SocialLinkItem[];
}

export interface ExternalLinksBlock extends NamedBlock {
  type: "ExternalLinksModule";
  foldable?: boolean;
  show_arrow?: boolean | null;
  circle_image?: boolean | null;
  layout_type: ExternalLinksLayoutType;
  links: ExternalLinkItem[];
}

export interface VideoLinksBlock extends NamedBlock {
  type: "VideoLinksModule";
  foldable?: boolean;
  layout_type: VideoLinksLayoutType;
  items: VideoLinkItem[];
}

export interface ProductsBlock extends NamedBlock {
  type: "ProductsModule";
  foldable?: boolean;
  show_arrow?: boolean | null;
  circle_image?: boolean | null;
  layout_type: ProductsLayoutType;
  items: ProductItem[];
}

export interface ImagesBlock extends BaseBlock {
  type: "ImageModule";
  layout_type: ImagesLayoutType;
  items: ImageItem[];
}

export interface ReviewsBlock extends NamedBlock {
  type: "ReviewsModule";
  foldable?: boolean;
  layout_type: ReviewsLayoutType;
  reviews: ReviewItem[];
  google_place_id?: string | null;
  google_place_url?: string | null;
  google_last_fetched_at?: number | null;
  click_url?: string | null;
  show_add_review_button?: boolean;
  add_review_url?: string | null;
}

export interface HeaderBlock extends BaseBlock {
  type: "HeaderModule";
  value: string;
  align: ImageAlignment;
  size: number;
}

export interface ParagraphBlock extends BaseBlock {
  type: "ParagraphModule";
  /** A JSON-encoded Quill Delta string (jsonEncode of the delta ops array). */
  content: string;
}

export interface SpacerBlock extends BaseBlock {
  type: "SpacerModule";
  space: number;
}

export interface DividerBlock extends BaseBlock {
  type: "DividerModule";
  /** Divider line THICKNESS (mobile field `thickness`, JSON key `space`). */
  space: number;
  /** Divider line color — ARGB int (non-null in the mobile contract). */
  color: ArgbColor;
}

export interface ButtonBlock extends NamedBlock {
  type: "ButtonModule";
  foldable?: boolean;
  layout_type: ButtonsLayoutType;
  theme: ButtonThemeType;
  show_arrow?: boolean | null;
  buttons: ButtonItem[];
}

export interface SocialFeedBlock extends NamedBlock {
  type: "SocialFeedModule";
  configuration: FeedConfiguration;
  layout_type: SocialFeedLayoutType;
  info: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
  posts_count?: number;
}

export interface FormQuestion {
  type: string;
  data: {
    by_default?: boolean;
    question?: string;
    description?: string | null;
    required?: boolean;
    hint?: string;
    [key: string]: unknown;
  };
}

export interface FormBlock extends NamedBlock {
  type: "FormModule";
  questions: FormQuestion[];
}

export interface LocationBlock extends NamedBlock {
  type: "LocationModule";
  /** Opaque place_picker_google Place map — passed through verbatim. */
  value: Record<string, unknown>;
  hide_reviews?: boolean;
}

export interface EmbedBlock extends BaseBlock {
  type: "EmbedModule";
  configuration: EmbedConfiguration;
  data: EmbedData;
}

export interface IntroductionVideoBlock extends BaseBlock {
  type: "IntroductionVideoModule";
  url: string;
  thumbnail_url: string;
}

export interface BookingBlock extends NamedBlock {
  type: "BookingModule";
  foldable?: boolean;
  button_label?: string;
}

export type Block =
  | SocialLinksBlock
  | ExternalLinksBlock
  | VideoLinksBlock
  | ProductsBlock
  | ImagesBlock
  | ReviewsBlock
  | HeaderBlock
  | ParagraphBlock
  | SpacerBlock
  | DividerBlock
  | ButtonBlock
  | SocialFeedBlock
  | FormBlock
  | LocationBlock
  | EmbedBlock
  | IntroductionVideoBlock
  | BookingBlock;
