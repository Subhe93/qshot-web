/**
 * TypeScript model for the 16 builder block types.
 * Source of truth: mobile app `lib/features/website/domain/entities/block_entity.dart`.
 * The JSON produced here must match what the Flutter app produces so the same
 * payload renders identically in the public Nuxt renderer.
 *
 * Colors are ARGB integers (0xAARRGGBB) exactly like the mobile app.
 */

export type ArgbColor = number;

// ---- Layout type enums (per block) ----
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
  | "singleSizable"
  | "grid"
  | "list"
  | "stories";

export type ButtonsLayoutType = "list" | "grid";

export type ReviewsLayoutType = "cards" | "list" | "testimonial";

export type SocialFeedLayoutType = "swiper" | "list" | "grid";

// ---- Discriminator ----
export type BlockType =
  | "SocialLinksBlock"
  | "ExternalLinksBlock"
  | "VideoLinksBlock"
  | "ProductsBlock"
  | "IntroductionVideoBlock"
  | "EmbedBlock"
  | "SocialFeedBlock"
  | "FormBlock"
  | "HeaderBlock"
  | "ParagraphBlock"
  | "ImagesBlock"
  | "ButtonBlock"
  | "SpacerBlock"
  | "DividerBlock"
  | "LocationBlock"
  | "ReviewsBlock"
  | "BookingBlock";

// ---- Common fields shared by every block ----
export interface BaseBlock {
  id: string;
  type: BlockType;
  hide?: boolean;
  useBackgroundColor?: boolean;
  backgroundColor?: ArgbColor | null;
}

interface NamedBlock extends BaseBlock {
  title: string;
}

// ---- Item shapes ----
export interface SocialLinkItem {
  id?: string;
  type: string; // instagram, twitter, facebook, ...
  name?: string;
  url: string;
  icon?: string;
}

export interface ExternalLinkItem {
  id?: string;
  title: string;
  url: string;
  icon?: string;
  thumbnail_url?: string;
}

export interface VideoLinkItem {
  id?: string;
  title: string;
  url: string;
  thumbnail_url?: string;
}

export interface ProductItem {
  id?: string;
  title: string;
  description?: string;
  thumbnail_url: string;
  url: string;
  price?: number | string;
  price_after_discount?: number | string;
  currency?: string;
}

export interface ImageItem {
  url: string;
  rect?: [number, number, number, number];
  title?: string;
}

export interface ButtonItem {
  id?: string;
  title: string;
  url?: string | null;
  icon?: string | null;
  hidden?: boolean;
  backgroundColor?: ArgbColor;
  useBackgroundColor?: boolean;
  borderColor?: ArgbColor;
  useBorder?: boolean;
  textColor?: ArgbColor;
  useTextColor?: boolean;
  cornerRadius?: number;
}

export interface ReviewItem {
  id: string;
  reviewer_name: string;
  reviewer_photo_url?: string | null;
  rating: number;
  text: string;
  relative_time_description?: string;
  hidden?: boolean;
}

// ---- Concrete blocks ----
export interface SocialLinksBlock extends BaseBlock {
  type: "SocialLinksBlock";
  layout_type: SocialLinksLayoutType;
  links: SocialLinkItem[];
}

export interface ExternalLinksBlock extends NamedBlock {
  type: "ExternalLinksBlock";
  layout_type: ExternalLinksLayoutType;
  links: ExternalLinkItem[];
  show_arrow?: boolean;
  circle_image?: boolean;
}

export interface VideoLinksBlock extends NamedBlock {
  type: "VideoLinksBlock";
  layout_type: VideoLinksLayoutType;
  items: VideoLinkItem[];
}

export interface ProductsBlock extends NamedBlock {
  type: "ProductsBlock";
  layout_type: ProductsLayoutType;
  items: ProductItem[];
  show_arrow?: boolean;
  circle_image?: boolean;
}

export interface ImagesBlock extends BaseBlock {
  type: "ImagesBlock";
  layout_type: ImagesLayoutType;
  items: ImageItem[];
}

export interface ButtonBlock extends BaseBlock {
  type: "ButtonBlock";
  title?: string;
  layout_type?: ButtonsLayoutType;
  show_arrow?: boolean;
  buttons?: ButtonItem[];
}

export interface ReviewsBlock extends BaseBlock {
  type: "ReviewsBlock";
  title?: string;
  layout_type: ReviewsLayoutType;
  reviews: ReviewItem[];
  click_url?: string | null;
  show_add_review_button?: boolean;
  add_review_url?: string | null;
}

export interface SocialFeedBlock extends NamedBlock {
  type: "SocialFeedBlock";
  layout_type: SocialFeedLayoutType;
  configuration: "instagram" | "youtube" | "vimeo";
  info: Record<string, unknown>;
  posts_count?: number;
}

export interface FormBlock extends NamedBlock {
  type: "FormBlock";
  fields: Array<{
    id?: string;
    name: string;
    type: string;
    label?: string;
    required?: boolean;
  }>;
  submit_url?: string;
}

export interface HeaderBlock extends BaseBlock {
  type: "HeaderBlock";
  value: string;
  size: number;
  align: "left" | "center" | "right";
}

export interface ParagraphBlock extends BaseBlock {
  type: "ParagraphBlock";
  content: string; // Quill delta serialized / HTML
}

export interface SpacerBlock extends BaseBlock {
  type: "SpacerBlock";
  space: number;
}

export interface DividerBlock extends BaseBlock {
  type: "DividerBlock";
  space: number;
  color: ArgbColor | string;
}

export interface LocationBlock extends NamedBlock {
  type: "LocationBlock";
  latitude: number;
  longitude: number;
  address?: string;
  zoom?: number;
}

export interface EmbedBlock extends NamedBlock {
  type: "EmbedBlock";
  embed_code: string;
}

export interface IntroductionVideoBlock extends NamedBlock {
  type: "IntroductionVideoBlock";
  video_url: string;
  cover_image_url?: string;
}

export interface BookingBlock extends BaseBlock {
  type: "BookingBlock";
  title: string;
  profile_id?: string;
  button_label?: string;
  service_filter?: string[];
  provider_filter?: string[];
}

export type Block =
  | SocialLinksBlock
  | ExternalLinksBlock
  | VideoLinksBlock
  | ProductsBlock
  | ImagesBlock
  | ButtonBlock
  | ReviewsBlock
  | SocialFeedBlock
  | FormBlock
  | HeaderBlock
  | ParagraphBlock
  | SpacerBlock
  | DividerBlock
  | LocationBlock
  | EmbedBlock
  | IntroductionVideoBlock
  | BookingBlock;
