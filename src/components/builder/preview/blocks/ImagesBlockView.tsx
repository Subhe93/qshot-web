"use client";

import { useEffect, useState } from "react";
import type { ImagesBlock, ImageItem } from "@/lib/types/blocks";
import { cdnUrl } from "@/lib/api/qrcodes";

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
            width={40}
            height={40}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            opacity={0.6}
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
    const item = items[0]!;
    const aspect = rectAspect(item.rect);
    return (
      <div className="px-4">
        <div
          className="overflow-hidden rounded-lg"
          style={aspect != null ? { aspectRatio: String(aspect) } : undefined}
        >
          <RectImg item={item} className="size-full" />
        </div>
      </div>
    );
  }

  switch (layout) {
    case "singleSizable":
      // Renders only the first item, free height (no aspect constraint).
      return (
        <div className="px-6 py-[5px]">
          <div className="overflow-hidden rounded-lg">
            <RectImg item={items[0]!} className="w-full" />
          </div>
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
              <RectImg item={item} className="size-full" />
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
      <RectImg item={item} className="size-full" />
    </div>
  );
}

/**
 * Image honouring the optional crop `rect` ([left, top, right, bottom] in source
 * pixels — mobile draws `image, rect → destRect` via canvas.drawImageRect). When
 * a rect is present we use it as a background sized so the cropped region fills
 * the box; otherwise a plain cover <img>.
 */
function RectImg({ item, className }: { item: ImageItem; className?: string }) {
  const url = cdnUrl(item.url);
  const rect = item.rect;
  const hasRect = !!(rect && isValidRect(rect));
  // The mobile rect is an ABSOLUTE source-pixel sub-rectangle (drawImageRect),
  // so we need the image's natural size to map it to a CSS background crop.
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!hasRect) return;
    let active = true;
    const img = new window.Image();
    img.onload = () => {
      if (active) setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => {
      active = false;
    };
  }, [url, hasRect]);

  if (hasRect && nat && rect) {
    const [left, top, right, bottom] = rect;
    const cropW = right - left;
    const cropH = bottom - top;
    // Scale the source so the crop window fills the element, then offset to the
    // crop origin (as a % of the leftover space).
    const bgW = cropW > 0 ? (nat.w / cropW) * 100 : 100;
    const bgH = cropH > 0 ? (nat.h / cropH) * 100 : 100;
    const posX = nat.w - cropW > 0 ? (left / (nat.w - cropW)) * 100 : 0;
    const posY = nat.h - cropH > 0 ? (top / (nat.h - cropH)) * 100 : 0;
    return (
      <div
        className={className}
        role="img"
        style={{
          backgroundImage: `url(${url})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${bgW}% ${bgH}%`,
          backgroundPosition: `${posX}% ${posY}%`,
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${className ?? ""} object-cover`} />
  );
}

// rect values may be either normalized (0..1) or absolute pixels. We treat them
// as a ratio: aspect = width / height regardless of absolute scale.
function rectAspect(
  rect?: [number, number, number, number] | null,
): number | null {
  if (!rect || !isValidRect(rect)) return null;
  const w = rect[2] - rect[0];
  const h = rect[3] - rect[1];
  return h > 0 ? w / h : null;
}

function isValidRect(rect: [number, number, number, number]): boolean {
  return rect.length === 4 && rect[2] > rect[0] && rect[3] > rect[1];
}
