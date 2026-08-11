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
  | "list"
  | "grid"
  | "singleSizable";

export type ButtonsLayoutType = "list" | "grid";

export type ButtonThemeType = "minimal" | "solid" | "soft" | "outline" | "pill";

export type ReviewsLayoutType = "cards" | "list" | "testimonial";

export type SocialFeedLayoutType = "swiper" | "list" | "grid";

export type SocialIconType = "original" | "darkFilled";

export type ImageAlignment = "start" | "center" | "end";

/**
 * Link-based feed providers. These are the ONLY three present in
 * `FeedConfiguration.values` on the mobile `dev` branch, i.e. the only values
 * every shipped mobile build can parse.
 *
 * DANGER — the mobile parser is not defensive here:
 * ```dart
 * // block_entity.dart · SocialFeedBlock.fromJson
 * var configuration = FeedConfiguration.values[json['configuration']]!;
 * ```
 * `values` is a NAME-keyed map and the `!` is a non-null assertion, so an
 * unknown or missing `configuration` throws, and the throw escapes
 * `BlockEntity.fromJson` — the WHOLE page fails to parse, not just this block.
 * Every other field in that factory has a `??` fallback. Never write a
 * `configuration` outside this union unless the target mobile build is known
 * to know it.
 *
 * ⚠️ `instagram` is the odd one out: the value is link-based HISTORICALLY, but
 * it now carries TWO different `info` shapes — see `InstagramFeedInfo` below.
 * It stays in this union because the *configuration string* is what every
 * shipped build parses, and that has not changed.
 */
export type LinkFeedConfiguration = "youtube" | "vimeo" | "instagram";

/**
 * Providers whose `info` is produced by a server-side OAuth **connect flow**
 * instead of a link the user types. Both are unparseable by every currently
 * released mobile build — see `LinkFeedConfiguration` above:
 *
 * - `facebook` — `FacebookFeedConfiguration`, mobile branch
 *   `feature/social-feed-refactor` (catalog 2026-07-23).
 * - `tiktok` — `TiktokFeedConfiguration`, mobile commit 121470ef on branch
 *   `feature/template-sites` (catalog 2026-08-03). Own videos only, because
 *   that is all TikTok's API scope (`user.info.basic`, `video.list`) returns.
 *
 * They stay in the union so a block created on a mobile feature build
 * round-trips untouched, but the builder gates whether either can be *chosen*
 * (SocialFeedBlockEditor · FACEBOOK_FEED_ENABLED / TIKTOK_FEED_ENABLED).
 */
export type ConnectFeedConfiguration = "facebook" | "tiktok";

/** All providers the web model can represent. */
export type FeedConfiguration = LinkFeedConfiguration | ConnectFeedConfiguration;

/**
 * Provider-specific `info` payloads. The mobile display layer indexes these
 * keys directly and passes the result to non-nullable `String` parameters
 * (feed_display_cubit.dart · `_youtube(block.info["channel_id"])`,
 * `_instagram(block.info["username"])`, `VimeoFeedConfiguration.extractId(
 * block.info["link"])`), and it does so in the `FeedDisplayCubit` CONSTRUCTOR
 * (via `_cacheKey`), outside any try/catch. A MISSING key is therefore a hard
 * `TypeError` that breaks the widget build; an empty string only degrades to
 * the cubit's catchable "failed to load" state. Always write the keys.
 */
export interface YoutubeFeedInfo {
  /** Channel URL as typed by the user (`youtube.com/@handle`). */
  link: string;
  /**
   * Resolved channel id, used verbatim as the `channel_id` query param of
   * `youtube.com/feeds/videos.xml`. Mobile resolves handles through
   * `GET q-profile/youtube-channel/name?url=` before storing this; the web
   * builder has no such call yet and stores the URL (or a `UC…` id parsed out
   * of it), which yields a recoverable fetch error rather than a crash.
   */
  channel_id: string;
}

export interface VimeoFeedInfo {
  /**
   * Channel URL or bare id. Mobile runs
   * `^(?:https://vimeo\.com/)?(?<id>.+)$` and force-unwraps the match, so an
   * EMPTY link crashes it — a Vimeo feed block must never be saved blank.
   */
  link: string;
}

/**
 * ── Instagram: ONE `configuration`, TWO `info` shapes ────────────────────────
 *
 * `configuration: "instagram"` predates the connect flow, and real saved sites
 * carry the legacy payload. Mobile commit 20941620 retires the mechanism behind
 * it (the public `business_discovery` lookup, one shared qshot token) in favour
 * of **Business Login for Instagram**, a per-user OAuth connect flow with the
 * same shape as Facebook/TikTok — but it did NOT change the configuration
 * value: `InstagramFeedConfiguration` stays registered precisely so existing
 * blocks keep deserializing and rendering.
 *
 * So `info` is a two-member union discriminated by which identifier is present:
 *
 *   legacy    → `{ link, username }`                        (business_discovery)
 *   connected → `{ connection_id, ig_user_id, username }`   (Business Login)
 *
 * `username` is in BOTH, which is the property that makes the split safe:
 * `FeedDisplayCubit` dereferences `info["username"]` into a NON-NULLABLE String
 * in its constructor, outside any try/catch, so a missing key is a hard crash
 * while an empty string is a recoverable "failed to load". Every writer of
 * either shape therefore writes `username`, and an old build handed the new
 * shape still resolves the SAME account through the old path for as long as
 * that endpoint keeps serving (server-contract.md §7 keeps it alive until no
 * live site has an `instagram` block).
 *
 * Why not the `instagram_connected` configuration value that
 * `docs/plans/social-instagram-feed/plan.md` §4 sketches? Because it exists in
 * that document only — no mobile code registers it, so on EVERY shipped build
 * `FeedConfiguration.values["instagram_connected"]!` throws and takes down the
 * parse of the whole page; and our copy of the server's website-JSON validator
 * pins `socialFeedBlock.configuration` to
 * `["youtube","vimeo","instagram","facebook"]`, which would additionally 422 the
 * save. Writing `"instagram"` keeps the block parseable, savable and renderable
 * everywhere today. If mobile does land `instagram_connected`, adding it is a
 * pure additive change: this union already models the payload it would carry.
 */

/** Legacy Instagram payload — the retired public `business_discovery` path. */
export interface InstagramLinkFeedInfo {
  /** Profile URL as typed by the user (`instagram.com/username`). */
  link: string;
  /** Bare handle extracted from `link` — what mobile actually fetches with. */
  username: string;
}

/**
 * Business Login payload — written by `InstagramConnectSheet` from the
 * connection record the server stores (`social_connections` with
 * `platform = "instagram"`). The posts themselves are NEVER in the website
 * JSON: the public renderer calls `GET instagram/feed?connection_id=…`.
 */
export interface InstagramConnectedFeedInfo {
  /** `social_connections.id` — the key `instagram/feed` is loaded by. */
  connection_id: string;
  /**
   * `social_connections.platform_user_id`, i.e. Instagram's `user_id`.
   * OPTIONAL in the contract — "a redundant safety check against the
   * connection" — exactly like TikTok's `open_id`. We still always WRITE the
   * key, empty string included, for the reason in the block comment above.
   */
  ig_user_id: string;
  /** Instagram handle — display only here, but load-bearing on old builds. */
  username: string;
}

/** Either Instagram shape. Discriminate on `connection_id` / `link`. */
export type InstagramFeedInfo =
  | InstagramLinkFeedInfo
  | InstagramConnectedFeedInfo;

/**
 * `info` payload written by the Facebook (Meta) feed configuration. Posts are
 * NEVER stored in the website JSON — the public renderer fetches them
 * server-side from `meta/feed` using `connection_id`.
 */
export interface FacebookFeedInfo {
  /** Opaque Mongo id of the user's Meta connection — what the renderer uses. */
  connection_id: string;
  /** Chosen Facebook Page id. */
  page_id: string;
  /** Page name — display only. */
  username: string;
}

/**
 * `info` payload written by the TikTok feed configuration. Like Facebook it
 * carries connection identifiers rather than a link — the videos are fetched
 * server-side from `tiktok-integration/feed` and are never stored in the
 * website JSON.
 *
 * Mirrors what mobile's `TiktokConnectCubit` builds from the deep-link return
 * (`qshot://social/connected?connection_id=…&platform=tiktok&username=…`):
 * ```dart
 * info: {
 *   "connection_id": connectionId,
 *   "open_id": uri.queryParameters['open_id'],
 *   "username": username,
 * }
 * ```
 */
export interface TiktokFeedInfo {
  /** Opaque server id of the user's TikTok connection — what the renderer uses. */
  connection_id: string;
  /**
   * TikTok's user id. OPTIONAL in the contract (a redundant server-side check
   * against the connection) — mobile passes it as `String? openId` and the data
   * source drops it from the query when empty. We still always WRITE the key,
   * empty string included, for the same reason as every other `info` key.
   */
  open_id: string;
  /** TikTok display name — display only. */
  username: string;
}

/** Union of the per-provider `info` shapes above. */
export type SocialFeedInfo =
  | YoutubeFeedInfo
  | VimeoFeedInfo
  | InstagramFeedInfo
  | FacebookFeedInfo
  | TiktokFeedInfo;

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

// NOTE: there is deliberately NO `icon` here. Mobile `ExternalLinkItem.toJson()`
// writes exactly these six keys, the server schema lists the same six, and the
// deployed validator enforces `additionalProperties: false` — emitting `icon`
// produced `422 unknown field "icon" is not allowed` and killed the whole save.
// (`SocialLinkItem.icon` and `ButtonItem.icon` ARE in the contract; only the
// external-link one was our invention.) See serialization.ts:parseExternalLinkItem.
export interface ExternalLinkItem {
  id?: string;
  title?: string;
  url?: string;
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
  /** Mobile `fromJson` falls back to `list` for an unknown/absent value. */
  layout_type: SocialFeedLayoutType;
  /**
   * Provider-specific payload — see `SocialFeedInfo`. Typed loosely because
   * unknown keys written by a newer mobile build must round-trip untouched,
   * but the builder always keeps the current provider's required keys present
   * as strings (a missing key crashes the mobile FeedDisplayCubit).
   */
  info: Record<string, unknown>;
  /** `{ show_profile_details: boolean }` for instagram/facebook, else null. */
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
