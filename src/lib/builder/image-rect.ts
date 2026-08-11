/**
 * Crop rectangles, modelled exactly the way the mobile builder models them.
 *
 * Mobile never cuts pixels. `openSingleCustomImageEditor` compresses the picked
 * file, shows a crop box, and returns `CropResult = (Rect, XFile)` — the WHOLE
 * image plus a rectangle describing the visible region. Every renderer applies
 * that rectangle at paint time (`RectImage` -> `canvas.drawImageRect(image,
 * rect, dst)`), so cropping stays reversible: changing a cover's size re-crops
 * the ORIGINAL rather than re-cutting an already-cut image.
 *
 * The web builder used to bake the crop into the pixels and throw the rest away,
 * which is why a square photo came back as a 16:9 strip and why each size change
 * quietly ate more of the picture. These helpers are the shared vocabulary for
 * doing it the mobile way instead.
 *
 * Serialization is `[left, top, right, bottom]` in the pixel space of the
 * UPLOADED image — matching Dart's `RectJson.toJson() => [left, top, right,
 * bottom]`. It is emphatically not `[x, y, width, height]`; the two only agree
 * when the crop starts at the origin.
 */
import type { RectTuple } from "@/lib/types/profile";

export type { RectTuple };

export const rectWidth = (r: RectTuple): number => r[2] - r[0];
export const rectHeight = (r: RectTuple): number => r[3] - r[1];

/**
 * A rect is only usable if it has positive extent. Anything else (all zeros from
 * a bad import, a 3-element array from hand-edited JSON, NaN) is treated as
 * "no crop" so the caller falls back to plain `object-fit: cover`.
 */
export function isUsableRect(r: unknown): r is RectTuple {
  return (
    Array.isArray(r) &&
    r.length === 4 &&
    r.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    (r as RectTuple)[2] > (r as RectTuple)[0] &&
    (r as RectTuple)[3] > (r as RectTuple)[1]
  );
}

/** Aspect ratio of the cropped region, or null when there is no usable rect. */
export function rectAspect(r: unknown): number | null {
  return isUsableRect(r) ? rectWidth(r) / rectHeight(r) : null;
}

/**
 * Mobile's `Utils.compressImage` runs the picked file through
 * `FlutterImageCompress.compressWithList(minWidth: 1280, minHeight: 720)`, which
 * scales the image DOWN until it just covers 1280x720, never up. The stored rect
 * lives in the coordinate space of that resized image, so the web upload has to
 * resize by the same rule or rects from the two clients would not be comparable.
 */
export const UPLOAD_MIN_WIDTH = 1280;
export const UPLOAD_MIN_HEIGHT = 720;

/** Scale factor mobile's compress step would apply to a `w x h` image (<= 1). */
export function uploadScale(w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) return 1;
  return Math.min(1, Math.max(UPLOAD_MIN_WIDTH / w, UPLOAD_MIN_HEIGHT / h));
}

/**
 * Geometry for painting `rect` of a `natW x natH` image so the cropped region
 * exactly fills its container — the CSS equivalent of Flutter's
 * `canvas.drawImageRect(image, rect, Offset.zero & size)`.
 *
 * The container is given `aspectRatio` and clips; the image is absolutely
 * positioned inside it with these percentages. Percentages resolve against the
 * container box, so no pixel measurements are needed once the natural size is
 * known — the whole thing survives resizes without a listener.
 */
export interface RectPaint {
  /** `aspect-ratio` for the clipping container. */
  aspectRatio: number;
  /** `width` / `height` / `left` / `top` for the image, as CSS percentages. */
  width: string;
  height: string;
  left: string;
  top: string;
}

export function rectPaint(
  rect: RectTuple,
  natW: number,
  natH: number,
): RectPaint | null {
  if (!isUsableRect(rect) || !(natW > 0) || !(natH > 0)) return null;
  const w = rectWidth(rect);
  const h = rectHeight(rect);
  return {
    aspectRatio: w / h,
    width: `${(natW / w) * 100}%`,
    height: `${(natH / h) * 100}%`,
    left: `${(-rect[0] / w) * 100}%`,
    top: `${(-rect[1] / h) * 100}%`,
  };
}

/**
 * Turn a percentage crop (the unit react-image-crop keeps its state in, and the
 * only one that survives the preview being resized) into a pixel rect in the
 * natural coordinate space of the image — which is what mobile stores.
 */
export function rectFromPercentCrop(
  crop: { x: number; y: number; width: number; height: number },
  natW: number,
  natH: number,
): RectTuple {
  return roundRect(
    [
      (crop.x / 100) * natW,
      (crop.y / 100) * natH,
      ((crop.x + crop.width) / 100) * natW,
      ((crop.y + crop.height) / 100) * natH,
    ],
    natW,
    natH,
  );
}

/** `[l,t,r,b]` -> the `{x,y,width,height}` shape the canvas helpers expect. */
export function rectToArea(rect: RectTuple): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: rect[0],
    y: rect[1],
    width: rectWidth(rect),
    height: rectHeight(rect),
  };
}

/** Round a rect to whole pixels, keeping it inside `natW x natH`. */
export function roundRect(
  rect: RectTuple,
  natW: number,
  natH: number,
): RectTuple {
  const left = Math.max(0, Math.round(rect[0]));
  const top = Math.max(0, Math.round(rect[1]));
  const right = Math.min(natW, Math.round(rect[2]));
  const bottom = Math.min(natH, Math.round(rect[3]));
  return [left, top, Math.max(left + 1, right), Math.max(top + 1, bottom)];
}
