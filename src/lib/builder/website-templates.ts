/**
 * The built-in website templates — exact port of the mobile
 * `website_template_registry.dart` + the data half of `website_template.dart`
 * (origin/dev). Kept separate from `templates.ts` (the 7-hero-STYLE picker).
 *
 * A template = hero style + font + a style per block type + starter block
 * composition + a default/suggested brand color set. Applying one is a
 * one-shot stamp (see template-apply.ts) — palette colors are baked into the
 * document as literal ARGB ints; the only persisted trace is
 * `settings.template` ({id, brand_color}).
 *
 * Starter compositions only seed blocks whose content can be honestly
 * placeholder'd — Location (needs an address) and Social Feed (needs a
 * connected account) are stamped with template styles when the user adds
 * them, but never pre-inserted.
 *
 * Starter titles/questions are baked as LOCALIZED literals (mobile bakes
 * `LocaleKeys.x.tr()` at build time), so builders take a translator param —
 * the caller passes the active builder locale's lookup.
 */

import { nanoid } from "nanoid";
import type {
  Block,
  BookingBlock,
  ButtonsLayoutType,
  ButtonThemeType,
  ExternalLinksBlock,
  ExternalLinksLayoutType,
  FormBlock,
  ImagesBlock,
  ImagesLayoutType,
  ParagraphBlock,
  ProductsBlock,
  ProductsLayoutType,
  ReviewsBlock,
  ReviewsLayoutType,
  SocialFeedLayoutType,
  SocialIconType,
  SocialLinksBlock,
  SocialLinksLayoutType,
  VideoLinksBlock,
  VideoLinksLayoutType,
} from "@/lib/types/blocks";
import type { HeroStyle } from "@/lib/types/profile";

/** Localized starter-content strings a template composition can bake. */
export type TemplateContentKey =
  | "menu"
  | "reviews"
  | "booking"
  | "videos"
  | "links"
  | "products"
  | "about"
  | "contact"
  | "name"
  | "email"
  | "message";

/** i18n lookup for starter titles/questions (active builder locale). */
export type TemplateTranslator = (key: TemplateContentKey) => string;

/** The style each block type takes when a template is applied. */
export interface TemplateBlockStyles {
  socialLinks: SocialLinksLayoutType;
  socialIconType: SocialIconType;
  externalLinks: ExternalLinksLayoutType;
  videoLinks: VideoLinksLayoutType;
  products: ProductsLayoutType;
  images: ImagesLayoutType;
  buttons: ButtonsLayoutType;
  buttonTheme: ButtonThemeType;
  reviews: ReviewsLayoutType;
  socialFeed: SocialFeedLayoutType;
}

/** Mobile `const TemplateBlockStyles()` parameter defaults. */
const DEFAULT_BLOCK_STYLES: TemplateBlockStyles = {
  socialLinks: "gridAlignCenter",
  socialIconType: "darkFilled",
  externalLinks: "list",
  videoLinks: "swiper",
  products: "grid",
  images: "carousel",
  buttons: "list",
  buttonTheme: "solid",
  reviews: "cards",
  socialFeed: "grid",
};

function blockStyles(overrides: Partial<TemplateBlockStyles>): TemplateBlockStyles {
  return { ...DEFAULT_BLOCK_STYLES, ...overrides };
}

export interface WebsiteTemplate {
  id: string;
  /** i18n key for the display name (builder.theme namespace). */
  nameKey: string;
  heroStyle: HeroStyle;
  fontFamily: string;
  /** ARGB32 int. */
  defaultBrandColor: number;
  /** Swatches offered in the brand color bar (first = default). ARGB32 ints. */
  suggestedColors: number[];
  blockStyles: TemplateBlockStyles;
  /**
   * Starter blocks for a fresh site. Content is placeholder; styles are
   * stamped by `createFromTemplate` afterwards, so builders only decide
   * composition. (Mobile buildBlocks takes the palette but never uses it.)
   */
  buildBlocks: (t: TemplateTranslator) => Block[];
}

// ---- Starter block factories -----------------------------------------------
// Each mirrors the mobile `<Block>.init(...)` defaults AND its `toJson()` key
// order exactly (see block_entity.dart), so a freshly created site serializes
// the same key set the mobile app would emit: fresh id, hide:false,
// use_background_color:false, background_color:null, foldable:false, etc.
// Ids are nanoid (web precedent, catalog.ts) — mobile uses UUIDv8; ids are
// opaque strings to both apps.

function productsInit(title: string, layoutType: ProductsLayoutType = "list"): ProductsBlock {
  return {
    type: "ProductsModule",
    id: nanoid(),
    title,
    background_color: null,
    use_background_color: false,
    hide: false,
    foldable: false,
    show_arrow: null,
    circle_image: null,
    layout_type: layoutType,
    items: [],
  };
}

function reviewsInit(title: string): ReviewsBlock {
  return {
    type: "ReviewsModule",
    id: nanoid(),
    title,
    background_color: null,
    use_background_color: false,
    hide: false,
    foldable: false,
    layout_type: "cards",
    reviews: [],
    google_place_id: null,
    google_place_url: null,
    google_last_fetched_at: null,
    click_url: null,
    show_add_review_button: false,
    add_review_url: null,
  };
}

function bookingInit(title: string): BookingBlock {
  return {
    type: "BookingModule",
    id: nanoid(),
    title,
    background_color: null,
    use_background_color: false,
    hide: false,
    foldable: false,
    // Hardcoded Dart default (BookingBlock.init) — intentionally NOT localized.
    button_label: "Book Now",
  };
}

function imagesInit(layoutType: ImagesLayoutType): ImagesBlock {
  return {
    type: "ImageModule",
    id: nanoid(),
    background_color: null,
    use_background_color: false,
    hide: false,
    layout_type: layoutType,
    items: [],
  };
}

function socialLinksInit(): SocialLinksBlock {
  return {
    type: "social_links",
    id: nanoid(),
    hide: false,
    use_background_color: false,
    background_color: null,
    layout_type: "gridAlignCenter",
    icon_type: "darkFilled",
    adaptive_icon_color: true,
    custom_icon_color: null,
    links: [],
  };
}

function videoLinksInit(title: string, layoutType: VideoLinksLayoutType): VideoLinksBlock {
  return {
    type: "VideoLinksModule",
    id: nanoid(),
    title,
    background_color: null,
    use_background_color: false,
    hide: false,
    foldable: false,
    layout_type: layoutType,
    items: [],
  };
}

function externalLinksInit(title: string, layoutType: ExternalLinksLayoutType): ExternalLinksBlock {
  return {
    type: "ExternalLinksModule",
    id: nanoid(),
    title,
    background_color: null,
    use_background_color: false,
    hide: false,
    foldable: false,
    show_arrow: null,
    circle_image: null,
    layout_type: layoutType,
    links: [],
  };
}

function paragraphInit(text: string): ParagraphBlock {
  return {
    type: "ParagraphModule",
    id: nanoid(),
    background_color: null,
    use_background_color: false,
    hide: false,
    // jsonEncode(Delta()..insert("<text>\n")) — e.g. "[{\"insert\":\"About\\n\"}]"
    content: JSON.stringify([{ insert: `${text}\n` }]),
  };
}

function formInit(title: string, questions: FormBlock["questions"]): FormBlock {
  return {
    type: "FormModule",
    id: nanoid(),
    title,
    background_color: null,
    use_background_color: false,
    hide: false,
    questions,
  };
}

// ---- The 5 templates (order matters: picker order + `all.first` fallback) --

const restaurant: WebsiteTemplate = {
  id: "restaurant",
  nameKey: "template_restaurant",
  heroStyle: "style7",
  fontFamily: "Playfair Display",
  defaultBrandColor: 0xff6f4e37,
  suggestedColors: [0xff6f4e37, 0xffb85c38, 0xff8c3b3b, 0xff3e5641, 0xff1f2937],
  blockStyles: blockStyles({
    products: "list",
    reviews: "testimonial",
    images: "carousel",
    buttonTheme: "solid",
  }),
  buildBlocks: (t) => [
    productsInit(t("menu")),
    reviewsInit(t("reviews")),
    bookingInit(t("booking")),
  ],
};

const salon: WebsiteTemplate = {
  id: "salon",
  nameKey: "template_salon",
  heroStyle: "style3",
  fontFamily: "Poppins",
  defaultBrandColor: 0xffb76e79,
  suggestedColors: [0xffb76e79, 0xff884a62, 0xff2e2e2e, 0xff7e6b8f, 0xffc98963],
  blockStyles: blockStyles({
    images: "grid",
    reviews: "cards",
    products: "swiper2",
    buttonTheme: "pill",
    socialLinks: "gridAlignCenter",
  }),
  buildBlocks: (t) => [
    bookingInit(t("booking")),
    imagesInit("grid"),
    reviewsInit(t("reviews")),
    socialLinksInit(),
  ],
};

const creator: WebsiteTemplate = {
  id: "creator",
  nameKey: "template_creator",
  heroStyle: "style2",
  fontFamily: "Montserrat",
  defaultBrandColor: 0xff7c3aed,
  suggestedColors: [0xff7c3aed, 0xffec4899, 0xff06b6d4, 0xfff59e0b, 0xff10b981],
  blockStyles: blockStyles({
    videoLinks: "grid",
    externalLinks: "largeGrid",
    images: "shorts",
    buttonTheme: "pill",
    socialFeed: "grid",
  }),
  buildBlocks: (t) => [
    socialLinksInit(),
    videoLinksInit(t("videos"), "grid"),
    externalLinksInit(t("links"), "largeGrid"),
  ],
};

const shop: WebsiteTemplate = {
  id: "shop",
  nameKey: "template_shop",
  heroStyle: "style6",
  fontFamily: "Inter",
  defaultBrandColor: 0xff2563eb,
  suggestedColors: [0xff2563eb, 0xff16a34a, 0xffea580c, 0xff9333ea, 0xff0f766e],
  blockStyles: blockStyles({
    products: "shop",
    images: "grid",
    reviews: "cards",
    buttonTheme: "solid",
  }),
  buildBlocks: (t) => [
    productsInit(t("products"), "shop"),
    imagesInit("grid"),
    reviewsInit(t("reviews")),
  ],
};

const professional: WebsiteTemplate = {
  id: "professional",
  nameKey: "template_professional",
  heroStyle: "style4",
  fontFamily: "Lato",
  defaultBrandColor: 0xff1e3a5f,
  suggestedColors: [0xff1e3a5f, 0xff334155, 0xff0f766e, 0xff6d28d9, 0xff166534],
  blockStyles: blockStyles({
    externalLinks: "list",
    reviews: "testimonial",
    buttonTheme: "outline",
    images: "swiper",
  }),
  buildBlocks: (t) => [
    paragraphInit(t("about")),
    formInit(t("contact"), [
      { type: "text", data: { question: t("name"), required: true } },
      { type: "text", data: { question: t("email"), required: true } },
      { type: "paragraph", data: { question: t("message"), required: false } },
    ]),
    bookingInit(t("booking")),
    socialLinksInit(),
  ],
};

/** Mobile `WebsiteTemplateRegistry.all` — order matters. */
export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  restaurant,
  salon,
  creator,
  shop,
  professional,
];

/** Mobile `WebsiteTemplateRegistry.of(id)` — null when not found. */
export function websiteTemplateOf(id: string | null | undefined): WebsiteTemplate | null {
  for (const template of WEBSITE_TEMPLATES) {
    if (template.id === id) return template;
  }
  return null;
}
