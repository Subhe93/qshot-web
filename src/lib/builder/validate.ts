/**
 * Pre-save guard against payloads the SERVER will reject.
 *
 * The backend validates every profile save against `website-json-schema.json`
 * and refuses the whole document on a violation — which surfaces to the user as
 * an opaque "something went wrong". This catches the one class of violation the
 * parse layer cannot fix by construction and names the offending block instead.
 *
 * Everything else (required keys, enums, coordinate types/ranges) is guaranteed
 * upstream: `catalog.ts` seeds schema-valid blocks, `serialization.ts` fills the
 * required defaults, and the editors are typed against the contract's unions.
 *
 * See docs/web-app-study/AUDIT-json-schema-compliance.md.
 */

import type { Block, BlockType } from "@/lib/types/blocks";

/** The 17 `type` discriminators the server's `oneOf` accepts. */
export const KNOWN_BLOCK_TYPES: readonly BlockType[] = [
  "social_links",
  "ExternalLinksModule",
  "VideoLinksModule",
  "ProductsModule",
  "ImageModule",
  "ReviewsModule",
  "HeaderModule",
  "ParagraphModule",
  "SpacerModule",
  "DividerModule",
  "ButtonModule",
  "SocialFeedModule",
  "FormModule",
  "LocationModule",
  "EmbedModule",
  "IntroductionVideoModule",
  "BookingModule",
];

const KNOWN = new Set<string>(KNOWN_BLOCK_TYPES);

export interface BlockIssue {
  /** 0-based position in `info.modules`. */
  index: number;
  type: string;
}

/**
 * Unknown block types, in document order.
 *
 * We deliberately keep unknown blocks verbatim while editing (mobile's parser
 * replaces them with an empty Spacer, silently destroying the content), so an
 * unsupported block CAN reach the save path — e.g. a block type the mobile app
 * shipped before this builder learned it. The server rejects those, so report
 * them rather than firing a request that is guaranteed to fail.
 */
export function findUnknownBlocks(blocks: Block[]): BlockIssue[] {
  const issues: BlockIssue[] = [];
  blocks.forEach((b, index) => {
    const type = (b as { type?: unknown }).type;
    if (typeof type !== "string" || !KNOWN.has(type)) {
      issues.push({ index, type: typeof type === "string" && type ? type : "—" });
    }
  });
  return issues;
}
