"use client";

import type { ImagesBlock, ImageItem } from "@/lib/types/blocks";
import { cdnUrl } from "@/lib/api/qrcodes";
import { rectAspect } from "@/lib/builder/image-rect";
import { RectImage } from "@/components/ui/rect-image";

/**
 * Read-only preview of an ImageModule, mirroring the mobile `ImagesWidget`
 * (lib/features/website/widget/editor/images_widget.dart). Every layout_type is
 * laid out exactly as the Flutter widget:
 *
 *  - empty            → h16 padded, 16:9, rounded-8, foreground@10% with an icon
 *  - single item      → h16 padded, rounded-8, cover; aspect = rect w/h if rect set
 *  - cards / carousel → AspectRatio(cards 1.1, carousel 2) horizontal scroll Row,
 *                       spacing 10, padding h20 v5; each card bordered black38 +
 *                       white@20% fill, rounded-8, 1:1 (cardAspectRatio 1080/1080)
 *  - swiper           → AspectRatio 1.9, slides 90% viewport, 16:9 cards
 *                       (cardAspectRatio 1920/1080), bordered + rounded-8
 *  - shorts           → horizontal scroll, padding h20 v5; each width 200,
 *                       rounded-10, margin h5, 9:16 (cardAspectRatio 1080/1920)
 *  - list             → vertical column, padding h16 v5; each full-width 16:9
 *                       (cardAspectRatio 1920/1080), rounded-8, v5 gaps
 *  - grid             → 2-column grid, padding h16 v5; each cell 1:1
 *                       (cardAspectRatio 1080/1080), 10px gaps, rounded-8
 *  - singleSizable    → h24 v5 padded, rounded-8, cover, first item only
 *
 * Hidden items are filtered out (`!getHidden()`). The block is wrapped with the
 * shared vertical padding + a translucent bottom divider.
 */
export function ImagesBlockView({ block }: { block: ImagesBlock }) {
  const items = (block.items ?? []).filter((it) => !it.hidden);
  const layout = block.layout_type ?? "cards";

  return (
    <div className="py-2">
      <div className="h-[5px]" />
      {renderContent(items, layout)}
      <div className="h-[5px]" />
      {/* Divider(indent 8, endIndent 8) at foreground@20% */}
      <div className="px-5">
        <div
          className="mx-2 h-px"
          style={{ backgroundColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
        />
      </div>
    </div>
  );
}

function renderContent(items: ImageItem[], layout: ImagesBlock["layout_type"]) {
  // ── Empty state ──
  if (items.length === 0) {
    return (
      <div className="px-4">
        <div
          className="flex aspect-video items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)" }}
        >
          <svg
            width={56}
            height={56}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      </div>
    );
  }

  // ── Single item: same in every layout (mobile special-cases length == 1) ──
  if (items.length === 1) {
    return (
      <div className="px-4">
        <LoneImage item={items[0]!} />
      </div>
    );
  }

  switch (layout) {
    case "singleSizable":
      // First item only, sized like the lone-image case (mobile: no fixed card
      // ratio here, the picture decides its own height).
      return (
        <div className="px-6 py-[5px]">
          <LoneImage item={items[0]!} />
        </div>
      );

    case "cards":
    case "carousel": {
      const wrapAspect = layout === "cards" ? 1.1 : 2;
      return (
        <div style={{ aspectRatio: String(wrapAspect) }}>
          <div className="flex h-full items-start gap-2.5 overflow-x-auto px-5 py-[5px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, i) => (
              <div key={item.id ?? i} className="h-full">
                <Card item={item} aspect={1} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "swiper":
      // AspectRatio 1.9 viewport; each slide 90% width with a 16:9 card.
      return (
        <div style={{ aspectRatio: "1.9" }}>
          <div className="flex h-full snap-x snap-mandatory items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, i) => (
              <div
                key={item.id ?? i}
                className="flex h-full w-[90%] shrink-0 snap-center items-center justify-center px-[5px]"
              >
                <Card item={item} aspect={16 / 9} />
              </div>
            ))}
          </div>
        </div>
      );

    case "shorts":
      return (
        <div className="flex gap-2.5 overflow-x-auto px-5 py-[5px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (
            <div
              key={item.id ?? i}
              className="w-[200px] shrink-0 overflow-hidden rounded-[10px]"
              style={{ aspectRatio: String(9 / 16) }}
            >
              <RectImage src={cdnUrl(item.url)} rect={item.rect} className="size-full" />
            </div>
          ))}
        </div>
      );

    case "list":
      // Vertical column of full-width 16:9 images (cardAspectRatio 1920/1080).
      return (
        <div className="flex flex-col px-4 py-[5px]">
          {items.map((item, i) => (
            <div key={item.id ?? i} className="py-[5px]">
              <div
                className="overflow-hidden rounded-lg"
                style={{ aspectRatio: String(16 / 9) }}
              >
                <RectImage src={cdnUrl(item.url)} rect={item.rect} className="size-full" />
              </div>
            </div>
          ))}
        </div>
      );

    case "grid":
      // 2-column grid, 1:1 cells (cardAspectRatio 1080/1080), 10px gaps.
      return (
        <div className="grid grid-cols-2 gap-2.5 px-4 py-[5px]">
          {items.map((item, i) => (
            <div
              key={item.id ?? i}
              className="overflow-hidden rounded-lg"
              style={{ aspectRatio: "1" }}
            >
              <RectImage src={cdnUrl(item.url)} rect={item.rect} className="size-full" />
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}

/** Bordered (black38) + white@20% fill, rounded-8 card holding a fixed-aspect image. */
function Card({ item, aspect }: { item: ImageItem; aspect: number }) {
  return (
    <div
      className="h-full overflow-hidden rounded-lg"
      style={{
        aspectRatio: String(aspect),
        border: "1px solid rgba(0,0,0,0.38)",
        backgroundColor: "rgba(255,255,255,0.2)",
      }}
    >
      <RectImage src={cdnUrl(item.url)} rect={item.rect} className="size-full" />
    </div>
  );
}

/**
 * A lone picture (`items.length == 1`, and the `singleSizable` layout) is the one
 * place mobile does NOT impose a card ratio: `ImagesWidget` wraps it in
 * `AspectRatio(rect.width / rect.height)`, so the box takes the CROP's own shape
 * and the whole crop shows without letterboxing.
 *
 * Items uploaded before non-destructive cropping have no rect to take a shape
 * from — those were physically cut, so the file itself already is the crop and
 * it keeps flowing at its natural height exactly as before.
 */
function LoneImage({ item }: { item: ImageItem }) {
  const aspect = rectAspect(item.rect);
  if (aspect == null) {
    return (
      <div className="overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cdnUrl(item.url)} alt="" className="w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg" style={{ aspectRatio: String(aspect) }}>
      <RectImage src={cdnUrl(item.url)} rect={item.rect} className="size-full" />
    </div>
  );
}
