"use client";

import { useState } from "react";
import { isUsableRect, rectPaint, type RectTuple } from "@/lib/builder/image-rect";

/**
 * Paints the `rect` region of an image so it exactly fills this element — the
 * web equivalent of mobile's `RectImage`, which does
 * `canvas.drawImageRect(image, rect, Offset.zero & size)`.
 *
 * Like mobile, it STRETCHES the region onto the box rather than preserving the
 * region's own ratio: callers that want the crop's ratio give this element that
 * `aspect-ratio` themselves (mobile does the same with an `AspectRatio` wrapper
 * around the single-image case). Everywhere else the surrounding card already
 * has the ratio the crop was taken at, so there is nothing to distort.
 *
 * With no usable rect it degrades to plain `object-fit: cover`, which is exactly
 * how every image uploaded before the non-destructive crop landed must keep
 * rendering — those were cut for real and carry `rect: null`.
 *
 * Two things to know before using it:
 *  - The box positions itself `relative` via an INLINE style, so an `absolute`
 *    utility class on `className` will not win. To place it absolutely, wrap it
 *    in your own positioned div.
 *  - The no-rect path is `position: absolute; object-fit: cover`, so the box
 *    must have a height of its own (an aspect ratio or explicit size). Dropping
 *    it into an unsized container collapses legacy images to zero height.
 */
export function RectImage({
  src,
  rect,
  alt = "",
  className,
  loading,
}: {
  src: string;
  rect?: RectTuple | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  // Keyed by the src they were measured from: when `src` swaps (e.g. template
  // previews switching covers), stale naturals must not be combined with the
  // NEW image's rect — that painted the old geometry until the load event.
  const [nat, setNat] = useState<{ src: string; w: number; h: number } | null>(
    null,
  );
  const measured = nat && nat.src === src ? nat : null;
  const paint =
    measured && isUsableRect(rect)
      ? rectPaint(rect, measured.w, measured.h)
      : null;

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={(e) =>
          setNat({
            src,
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
        style={
          paint
            ? {
                position: "absolute",
                width: paint.width,
                height: paint.height,
                left: paint.left,
                top: paint.top,
                maxWidth: "none",
              }
            : {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }
        }
      />
    </div>
  );
}
