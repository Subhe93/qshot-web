"use client";

import { useEffect, useRef, useState } from "react";
import {
  isUsableRect,
  rectHeight,
  rectPaint,
  rectWidth,
  type RectTuple,
} from "@/lib/builder/image-rect";

/**
 * Paints the `rect` region of an image so it fills this element — the web
 * equivalent of mobile's `RectImage`, which does
 * `canvas.drawImageRect(image, rect, Offset.zero & size)`.
 *
 * Geometry (kept identical to the Nuxt `components/RectImage.vue`): the crop
 * is laid on a "stage" that has the crop's OWN aspect ratio and covers this
 * box (max of the two fits, centred — CSS container units, no resize
 * listener), and the image is positioned on the stage by percentages. When the
 * box already has the crop's aspect (mobile-width covers, every gallery tile)
 * the stage IS the box and this is pixel-identical to drawImageRect. When it
 * doesn't (the desktop preview's full-width hero cover) the crop covers the
 * box uniformly instead of being stretched to it — mobile never hands
 * drawImageRect a mismatched box, so "cover" is the faithful reading.
 *
 * With no usable rect it degrades to plain `object-fit: cover`, which is exactly
 * how every image uploaded before the non-destructive crop landed must keep
 * rendering — those were cut for real and carry `rect: null`.
 *
 * The natural size is read from both the `load` event and `complete` after
 * mount, so an already-cached image (which can finish before the listener is
 * live) paints the same geometry as a freshly downloaded one.
 *
 * Two things to know before using it:
 *  - The box positions itself `relative` via an INLINE style, so an `absolute`
 *    utility class on `className` will not win. To place it absolutely, wrap it
 *    in your own positioned div.
 *  - Both paths position the image absolutely, so the box must have a height of
 *    its own (an aspect ratio or explicit size). Dropping it into an unsized
 *    container collapses images to zero height.
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
  const imgRef = useRef<HTMLImageElement | null>(null);

  // A cached image may already be complete before `onLoad` can fire.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const measured = { src, w: img.naturalWidth, h: img.naturalHeight };
    // Deferred so the state update never runs synchronously in the effect.
    const handle = setTimeout(() => setNat(measured), 0);
    return () => clearTimeout(handle);
  }, [src]);

  const measured = nat && nat.src === src ? nat : null;
  const paint =
    measured && isUsableRect(rect)
      ? rectPaint(rect, measured.w, measured.h)
      : null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
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
  );

  const w = paint && isUsableRect(rect) ? rectWidth(rect) : 0;
  const h = paint && isUsableRect(rect) ? rectHeight(rect) : 0;

  return (
    <div
      className={className}
      // Size containment lets the stage measure the box in cqw/cqh. The box is
      // always sized from outside (aspect ratio / explicit size), never from
      // its content, so containment costs nothing.
      style={{ position: "relative", overflow: "hidden", containerType: "size" }}
    >
      {paint ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            overflow: "hidden",
            aspectRatio: `${w} / ${h}`,
            // max(fit-width, fit-height) = cover.
            width: `max(100cqw, calc(100cqh * ${w} / ${h}))`,
          }}
        >
          {img}
        </div>
      ) : (
        img
      )}
    </div>
  );
}
