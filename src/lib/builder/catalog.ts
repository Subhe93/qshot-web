import { nanoid } from "nanoid";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faHeading,
  faParagraph,
  faHandPointer,
  faLink,
  faGripLines,
  faArrowsUpDown,
  faImage,
  faBagShopping,
  faUpRightFromSquare,
  faVideo,
  faStar,
  faHashtag,
  faListCheck,
  faLocationDot,
  faCode,
  faCirclePlay,
  faCalendarCheck,
} from "@fortawesome/free-solid-svg-icons";
import type { Block, BlockType } from "@/lib/types/blocks";

export interface CatalogEntry {
  type: BlockType;
  labelKey: string; // key under builder.blocks.*
  icon: IconDefinition; // FontAwesome icon, matching the mobile app
  /** "rich" blocks show as a list row with a description; "basic" as a round button. */
  kind: "rich" | "basic";
  make: () => Block;
}

// Blocks supported in this builder iteration. Icons + rich/basic split mirror the
// mobile BlockSelectorSheet.
export const BLOCK_CATALOG: CatalogEntry[] = [
  {
    type: "social_links",
    labelKey: "social",
    icon: faLink,
    kind: "rich",
    make: () => ({
      id: nanoid(),
      type: "social_links",
      layout_type: "list",
      icon_type: "darkFilled",
      links: [],
    }),
  },
  {
    type: "HeaderModule",
    labelKey: "header",
    icon: faHeading,
    kind: "basic",
    make: () => ({
      id: nanoid(),
      type: "HeaderModule",
      value: "Heading",
      size: 20,
      align: "center",
    }),
  },
  {
    type: "ParagraphModule",
    labelKey: "paragraph",
    icon: faParagraph,
    kind: "basic",
    make: () => ({
      id: nanoid(),
      type: "ParagraphModule",
      content: JSON.stringify([
        { insert: "Write something about yourself…\n" },
      ]),
    }),
  },
  {
    type: "ButtonModule",
    labelKey: "button",
    icon: faHandPointer,
    kind: "basic",
    make: () => ({
      id: nanoid(),
      type: "ButtonModule",
      title: "",
      theme: "solid",
      layout_type: "list",
      buttons: [{ id: nanoid(), title: "Button", url: "" }],
    }),
  },
  {
    type: "DividerModule",
    labelKey: "divider",
    icon: faGripLines,
    kind: "basic",
    make: () => ({
      id: nanoid(),
      type: "DividerModule",
      space: 1,
      color: 0xffe4e7ed,
    }),
  },
  {
    type: "SpacerModule",
    labelKey: "spacer",
    icon: faArrowsUpDown,
    kind: "basic",
    make: () => ({ id: nanoid(), type: "SpacerModule", space: 24 }),
  },
  {
    type: "ImageModule",
    labelKey: "images",
    icon: faImage,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "ImageModule", layout_type: "swiper", items: [] }),
  },
  {
    type: "ProductsModule",
    labelKey: "products",
    icon: faBagShopping,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "ProductsModule", title: "", layout_type: "grid", items: [] }),
  },
  {
    type: "ExternalLinksModule",
    labelKey: "externalLinks",
    icon: faUpRightFromSquare,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "ExternalLinksModule", title: "", layout_type: "promo", links: [] }),
  },
  {
    type: "VideoLinksModule",
    labelKey: "videoLinks",
    icon: faVideo,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "VideoLinksModule", title: "", layout_type: "list", items: [] }),
  },
  {
    type: "ReviewsModule",
    labelKey: "reviews",
    icon: faStar,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "ReviewsModule", title: "", layout_type: "cards", reviews: [] }),
  },
  {
    type: "SocialFeedModule",
    labelKey: "socialFeed",
    icon: faHashtag,
    kind: "rich",
    // `info: {}` CRASHED the mobile app. `FeedDisplayCubit`'s constructor derefs
    // `block.info["username"]` (resp. `channel_id`) into a NON-NULLABLE String
    // parameter outside any try/catch, so a missing key throws a TypeError while
    // the widget is building — an error box, not a graceful "failed to load".
    // An empty string is safe: it degrades to the cubit's catchable retry state.
    // A block can be added and saved without ever opening the editor, so the
    // seed itself must be mobile-parseable. `layout_type: "list"` + `posts_count: 4`
    // mirror mobile `SocialFeedBlock.init` (grid was never its default).
    //
    // SEED PROVIDER — was `instagram` until 2026-08-05. Mobile commit 20941620
    // pulled Instagram out of the new-block selector (the `business_discovery`
    // path is being replaced by Business Login for Instagram), so it became the
    // one provider we do NOT offer; see INSTAGRAM_FEED_ENABLED in
    // builder/feature-flags.ts. The seed now uses the FIRST offered provider,
    // matching mobile's `_items` order (youtube, vimeo, facebook, tiktok).
    //
    // `youtube` is also the safest possible seed:
    //   • every shipped mobile build parses it (facebook/tiktok would trip the
    //     `FeedConfiguration.values[…]!` bang and fail the whole page);
    //   • its two dereferenced keys are written as EMPTY STRINGS, which the
    //     cubit turns into a retryable fetch error — missing keys are what
    //     throws;
    //   • unlike `vimeo`, an empty value is not fatal: `VimeoFeedConfiguration
    //     .extractId` force-unwraps its regex match on a blank link.
    // `settings: null` mirrors `YoutubeFeedConfiguration.additionalSettings`
    // (the base-class `null`) — only instagram / instagram_connected / facebook
    // carry a settings map ({show_profile_details: true}).
    make: () => ({
      id: nanoid(),
      type: "SocialFeedModule",
      title: "",
      configuration: "youtube",
      layout_type: "list",
      info: { link: "", channel_id: "" },
      settings: null,
      posts_count: 4,
    }),
  },
  {
    type: "FormModule",
    labelKey: "form",
    icon: faListCheck,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "FormModule", title: "", questions: [] }),
  },
  {
    type: "LocationModule",
    labelKey: "location",
    icon: faLocationDot,
    kind: "rich",
    // The server schema requires `value` to be a full Place (name, place_id,
    // vicinity, geometry.location.lat/lng) — an empty `{}` makes the whole
    // profile save fail before the user can pick anything. Seed a valid,
    // *empty* place; 0/0 is the "not picked yet" sentinel and the renderers
    // show the placeholder pin for it instead of a map of the Atlantic.
    make: () => ({
      id: nanoid(),
      type: "LocationModule",
      title: "",
      value: {
        name: "",
        place_id: "",
        vicinity: "",
        geometry: { location: { lat: 0, lng: 0 } },
      },
    }),
  },
  {
    type: "EmbedModule",
    labelKey: "embed",
    icon: faCode,
    kind: "rich",
    // `data.url` + `data.html` are required by the server schema, and the
    // deployed 2.0.0 validator additionally refuses the empty string — but the
    // mobile app never holds an empty Embed (its wizard fetches the oembed
    // BEFORE the block exists), so there is no blessed placeholder to seed.
    // The keys are therefore seeded empty (schema-shaped) and `findIncomplete-
    // Blocks` names the block at save time until the user fills it in; the
    // editor derives the html for custom/youtube/telegram automatically.
    make: () => ({
      id: nanoid(),
      type: "EmbedModule",
      configuration: "custom",
      data: { url: "", html: "" },
    }),
  },
  {
    type: "IntroductionVideoModule",
    labelKey: "introVideo",
    icon: faCirclePlay,
    kind: "rich",
    // Same deal: `thumbnail_url` is required and must be non-empty on save. The
    // editor fills it from the video frame (upload) or from the YouTube id
    // (pasted link); `findIncompleteBlocks` guards the rest.
    make: () => ({ id: nanoid(), type: "IntroductionVideoModule", url: "", thumbnail_url: "" }),
  },
  {
    type: "BookingModule",
    labelKey: "booking",
    icon: faCalendarCheck,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "BookingModule", title: "", button_label: "Book Now" }),
  },
];

export const catalogByType = Object.fromEntries(
  BLOCK_CATALOG.map((e) => [e.type, e]),
) as Record<string, CatalogEntry>;
