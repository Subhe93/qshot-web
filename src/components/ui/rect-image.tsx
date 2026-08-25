"use client";

import { useEffect, useRef, useState } from "react";
import {
  expandRectToAspect,
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
 * Geometry — kept identical to the Nuxt `components/RectImage.vue` so the
 * preview shows what visitors get (decision 2026-08-25):
 *  - The box is measured (ResizeObserver). When its aspect equals the crop's
 *    (the phone canvas, every gallery tile) the crop is painted exactly —
 *    pixel-identical to drawImageRect.
 *  - When the box has a different shape (the desktop preview's full-width
 *    hero cover) the crop is EXPANDED to the box's aspect, centred on the crop
 *    and clamped to the photo — the crop plus context, never a zoomed slice,
 *    never a stretch (`expandRectToAspect`).
 *  - The region sits on a stage with its own aspect that covers the box
 *    (container units) and the image is percentage-positioned on it.
 *
 * With no usable rect it degrades to plain `object-fit: cover`, which is exactly
 * how every image uploaded before the non-destructive crop landed must keep
 * rendering — those were cut for real and carry `rect: null`.
 *
 * While a rect exists and the natural size or the box is still unmeasured the
 * image stays invisible, then appears once in its final place — no wrong
 * geometry is ever painted. The natural size is read from both `load` and
 * `complete`-after-mount so cached and fresh loads take the same path.
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
  const [boxAspect, setBoxAspect] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  // Measure the box; re-derive only when its aspect actually changes.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const next = w > 0 && h > 0 ? w / h : null;
      setBoxAspect((prev) =>
        prev != null && next != null && Math.abs(prev - next) < 1e-3 ? prev : next,
      );
    };
    const handle = setTimeout(measure, 0);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => {
      clearTimeout(handle);
      observer?.disconnect();
    };
  }, []);

  const measured = nat && nat.src === src ? nat : null;
  const hasRect = isUsableRect(rect);
  const region =
    measured && boxAspect != null && isUsableRect(rect)
      ? expandRectToAspect(rect, measured.w, measured.h, boxAspect)
      : null;
  const paint = region && measured ? rectPaint(region, measured.w, measured.h) : null;
  // Rect present but not yet measurable: show nothing rather than a wrong paint.
  const pending = hasRect && !paint;

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

  const w = region ? rectWidth(region) : 0;
  const h = region ? rectHeight(region) : 0;

  return (
    <div
      ref={rootRef}
      className={className}
      // Size containment lets the stage measure the box in cqw/cqh. The box is
      // always sized from outside (aspect ratio / explicit size), never from
      // its content, so containment costs nothing.
      style={{ position: "relative", overflow: "hidden", containerType: "size" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          visibility: pending ? "hidden" : undefined,
        }}
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
    </div>
  );
}
