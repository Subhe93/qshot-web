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
 * Draw the cropped region onto a canvas and export a compressed JPEG blob,
 * mirroring the mobile crop (1:1) + compress step. Output is capped to `maxSize`.
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
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("crop failed"))),
      "image/jpeg",
      0.85,
    );
  });
}
