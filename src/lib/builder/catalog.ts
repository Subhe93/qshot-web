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
    make: () => ({ id: nanoid(), type: "ExternalLinksModule", title: "", layout_type: "list", links: [] }),
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
    make: () => ({ id: nanoid(), type: "SocialFeedModule", title: "", configuration: "instagram", layout_type: "grid", info: {} }),
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
    make: () => ({ id: nanoid(), type: "LocationModule", title: "", value: {} }),
  },
  {
    type: "EmbedModule",
    labelKey: "embed",
    icon: faCode,
    kind: "rich",
    make: () => ({ id: nanoid(), type: "EmbedModule", configuration: "custom", data: {} }),
  },
  {
    type: "IntroductionVideoModule",
    labelKey: "introVideo",
    icon: faCirclePlay,
    kind: "rich",
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
