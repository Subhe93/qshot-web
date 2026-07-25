/** Pixel crop area from react-easy-crop. */
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
