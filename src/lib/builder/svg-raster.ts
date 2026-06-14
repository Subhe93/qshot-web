/**
 * Rasterize a same-origin SVG URL to a PNG blob via canvas, mirroring the mobile
 * Utils.svgToPng used before uploading a "famous icon".
 */
export async function svgUrlToPngBlob(url: string, size = 128): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0, size, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("rasterize failed"))),
      "image/png",
    );
  });
}
