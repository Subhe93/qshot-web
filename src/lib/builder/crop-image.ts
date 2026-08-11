import { uploadScale } from "./image-rect";

/** Pixel crop area: the origin plus extent of a region of an image. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draw the cropped region onto a canvas and export a compressed blob, mirroring
 * the mobile crop (1:1) + compress step. Output is capped to `maxSize`.
 *
 * JPEG has no alpha channel, so a transparent source (a PNG/WebP/SVG logo with a
 * cut-out background, or a crop that extends past the image edges) would be
 * flattened onto the canvas's default black — the "black background" bug. So we
 * inspect the drawn pixels: if any are non-opaque we export a lossless PNG that
 * preserves the transparency; fully-opaque crops stay as the smaller JPEG.
 */
export async function getCroppedBlob(
  src: string,
  crop: CropArea,
  maxSize = 512,
): Promise<Blob> {
  const image = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const transparent = hasTransparentPixels(ctx, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("crop failed"))),
      transparent ? "image/png" : "image/jpeg",
      transparent ? undefined : 0.85,
    );
  });
}

/** True if any pixel in the canvas is non-opaque (alpha < 255). Falls back to
 * `false` if the canvas is cross-origin-tainted (getImageData would throw — in
 * which case toBlob would fail too, so JPEG vs PNG is moot). */
function hasTransparentPixels(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Downscale a picked file the way mobile's `Utils.compressImage` does — scale to
 * just cover 1280x720, never up — WITHOUT cutting anything out of it.
 *
 * This is the upload half of the non-destructive crop: the whole picture goes to
 * the CDN and the crop travels beside it as a rect, so re-cropping later still
 * has every pixel to work with. Keeping the same 1280x720 rule as mobile matters
 * because the stored rect is in the coordinate space of the uploaded image; a
 * different resize rule would make rects from the two clients incomparable.
 *
 * PNG (and anything else with alpha) stays PNG so transparent logos don't get
 * flattened onto black, matching the `isPng` branch in `Utils.compressImage`.
 */
export async function resizeForUpload(
  src: string,
  baseName: string,
  sourceType?: string,
): Promise<File> {
  const image = await loadImage(src);
  const natW = image.naturalWidth;
  const natH = image.naturalHeight;
  const scale = uploadScale(natW, natH);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(natW * scale));
  canvas.height = Math.max(1, Math.round(natH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const png =
    (sourceType?.toLowerCase().includes("png") ?? false) ||
    hasTransparentPixels(ctx, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("resize failed"))),
      png ? "image/png" : "image/jpeg",
      png ? undefined : 0.85,
    );
  });
  return croppedUploadFile(blob, baseName);
}

/**
 * Wrap a cropped blob in an upload File, tagging it with the blob's real format
 * (getCroppedBlob emits PNG for transparent crops, else JPEG) so the name,
 * extension and MIME type stay consistent for the upload.
 */
export function croppedUploadFile(blob: Blob, baseName: string): File {
  const png = blob.type === "image/png";
  return new File([blob], `${baseName}.${png ? "png" : "jpg"}`, {
    type: blob.type || "image/jpeg",
  });
}
