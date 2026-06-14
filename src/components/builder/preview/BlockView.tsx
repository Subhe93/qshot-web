import type {
  Block,
  ButtonBlock,
  DividerBlock,
  HeaderBlock,
  ParagraphBlock,
  SocialLinksBlock,
  SpacerBlock,
  ImagesBlock,
  ProductsBlock,
  ExternalLinksBlock,
  VideoLinksBlock,
  ReviewsBlock,
  SocialFeedBlock,
  FormBlock,
  LocationBlock,
  EmbedBlock,
  IntroductionVideoBlock,
  BookingBlock,
} from "@/lib/types/blocks";
import { argbToCss } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";
import { SocialLinksBlockView } from "./blocks/SocialLinksBlockView";
import { ButtonBlockView } from "./blocks/ButtonBlockView";
import { ImagesBlockView } from "./blocks/ImagesBlockView";
import { ProductsBlockView } from "./blocks/ProductsBlockView";
import { ExternalLinksBlockView } from "./blocks/ExternalLinksBlockView";
import { VideoLinksBlockView } from "./blocks/VideoLinksBlockView";
import { ReviewsBlockView } from "./blocks/ReviewsBlockView";
import { SocialFeedBlockView } from "./blocks/SocialFeedBlockView";
import { FormBlockView } from "./blocks/FormBlockView";
import { LocationBlockView } from "./blocks/LocationBlockView";
import { EmbedBlockView } from "./blocks/EmbedBlockView";
import { IntroductionVideoBlockView } from "./blocks/IntroductionVideoBlockView";
import { BookingBlockView } from "./blocks/BookingBlockView";
import { QuillView } from "./QuillView";

/** Read-only renderer for a single block — mirrors the Nuxt renderer. */
export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "HeaderModule": {
      const b = block as HeaderBlock;
      // The align picker shows fixed left/center/right icons (start→left,
      // center→center, end→right), so render PHYSICAL alignment — never the
      // logical `text-align: start/end`, which flips with `dir` and would
      // right-align an Arabic header the user aligned left. `dir` still drives
      // bidi shaping of the text itself.
      const align = b.align === "center" ? "center" : b.align === "end" ? "right" : "left";
      return (
        <p
          dir={dirOf(b.value)}
          // Mobile HeaderWidget uses FontWeight.bold (700); colour inherits the
          // website font colour (no hardcoded token).
          className="font-bold"
          style={{ fontSize: b.size, textAlign: align }}
        >
          {b.value}
        </p>
      );
    }
    case "ParagraphModule": {
      const b = block as ParagraphBlock;
      // Render the full Quill Delta (bold/italic/links/lists/headers/align) to
      // match the mobile QuillViewer, instead of flattening to plain text.
      return <QuillView content={b.content} />;
    }
    case "ButtonModule":
      return <ButtonBlockView block={block as ButtonBlock} />;
    case "social_links":
      return <SocialLinksBlockView block={block as SocialLinksBlock} />;
    case "DividerModule": {
      const b = block as DividerBlock;
      return (
        <hr
          // Mobile insets the line 8px each side (indent/endIndent: 8).
          style={{
            borderColor: argbToCss(b.color),
            borderTopWidth: b.space || 1,
            marginInlineStart: 8,
            marginInlineEnd: 8,
          }}
        />
      );
    }
    case "SpacerModule": {
      const b = block as SpacerBlock;
      // Mobile SpacerBlock default height is 50.
      return <div style={{ height: b.space ?? 50 }} />;
    }
    case "ImageModule":
      return <ImagesBlockView block={block as ImagesBlock} />;
    case "ProductsModule":
      return <ProductsBlockView block={block as ProductsBlock} />;
    case "ExternalLinksModule":
      return <ExternalLinksBlockView block={block as ExternalLinksBlock} />;
    case "VideoLinksModule":
      return <VideoLinksBlockView block={block as VideoLinksBlock} />;
    case "ReviewsModule":
      return <ReviewsBlockView block={block as ReviewsBlock} />;
    case "SocialFeedModule":
      return <SocialFeedBlockView block={block as SocialFeedBlock} />;
    case "FormModule":
      return <FormBlockView block={block as FormBlock} />;
    case "LocationModule":
      return <LocationBlockView block={block as LocationBlock} />;
    case "EmbedModule":
      return <EmbedBlockView block={block as EmbedBlock} />;
    case "IntroductionVideoModule":
      return <IntroductionVideoBlockView block={block as IntroductionVideoBlock} />;
    case "BookingModule":
      return <BookingBlockView block={block as BookingBlock} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {(block as Block).type}
        </div>
      );
  }
}
