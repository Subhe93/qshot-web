import { nanoid } from "nanoid";
import {
  Heading,
  Type,
  MousePointerClick,
  Minus,
  MoveVertical,
  Share2,
  type LucideIcon,
} from "lucide-react";
import type { Block, BlockType } from "@/lib/types/blocks";

export interface CatalogEntry {
  type: BlockType;
  labelKey: string; // key under builder.blocks.*
  Icon: LucideIcon;
  make: () => Block;
}

// Simple blocks supported in this first builder iteration.
export const BLOCK_CATALOG: CatalogEntry[] = [
  {
    type: "HeaderBlock",
    labelKey: "header",
    Icon: Heading,
    make: () => ({
      id: nanoid(),
      type: "HeaderBlock",
      value: "Heading",
      size: 20,
      align: "center",
    }),
  },
  {
    type: "ParagraphBlock",
    labelKey: "paragraph",
    Icon: Type,
    make: () => ({
      id: nanoid(),
      type: "ParagraphBlock",
      content: "Write something about yourself…",
    }),
  },
  {
    type: "ButtonBlock",
    labelKey: "button",
    Icon: MousePointerClick,
    make: () => ({
      id: nanoid(),
      type: "ButtonBlock",
      layout_type: "list",
      buttons: [{ id: nanoid(), title: "Button", url: "" }],
    }),
  },
  {
    type: "SocialLinksBlock",
    labelKey: "social",
    Icon: Share2,
    make: () => ({
      id: nanoid(),
      type: "SocialLinksBlock",
      layout_type: "list",
      links: [],
    }),
  },
  {
    type: "DividerBlock",
    labelKey: "divider",
    Icon: Minus,
    make: () => ({
      id: nanoid(),
      type: "DividerBlock",
      space: 1,
      color: "#E4E7ED",
    }),
  },
  {
    type: "SpacerBlock",
    labelKey: "spacer",
    Icon: MoveVertical,
    make: () => ({ id: nanoid(), type: "SpacerBlock", space: 24 }),
  },
];

export const catalogByType = Object.fromEntries(
  BLOCK_CATALOG.map((e) => [e.type, e]),
) as Record<string, CatalogEntry>;
