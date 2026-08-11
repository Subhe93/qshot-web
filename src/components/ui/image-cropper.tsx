"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Loader2 } from "lucide-react";
import { getCroppedBlob } from "@/lib/builder/crop-image";
import {
  rectFromPercentCrop,
  rectToArea,
  type RectTuple,
} from "@/lib/builder/image-rect";

/**
 * Crop modal mirroring the mobile `CustomImageCropper`: the whole picked image
 * is shown with a draggable, resizable crop box over it — no zoom slider, since
 * mobile's `crop_image` has none either.
 *
 * `aspect` is deliberately OPTIONAL. Leaving it out gives a free-form box, which
 * is what mobile does wherever `CropController(aspectRatio: null)` is used (an
 * unset cover size, the header logo, replacing a gallery image, the
 * `singleSizable` layout). The old cropper forced a ratio in all of those places,
 * which is how a square photo came back as a 16:9 strip.
 *
 * Exactly one result callback must be given:
 *   - `onCroppedRect` — the mobile-parity path. Hands back the crop rectangle in
 *     the image's own pixels; the caller uploads the FULL image and stores the
 *     rect beside it, so the crop stays reversible.
 *   - `onCropped` — the destructive path, for the fields mobile also cuts for
 *     real (`openSingleImageEditor`: logo, product, review, link, button icon).
 *     Hands back a blob of just the cropped region.
 */
export function ImageCropper({
  src,
  title,
  cancelLabel,
  confirmLabel,
  onCancel,
  onCropped,
  onCroppedRect,
  aspect,
  cropShape = "rect",
}: {
  src: string;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onCropped?: (blob: Blob) => void | Promise<void>;
  onCroppedRect?: (rect: RectTuple) => void | Promise<void>;
  /** Locked ratio, or omitted for a free-form crop. */
  aspect?: number;
  cropShape?: "rect" | "round";
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<PercentCrop | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  // Start with the biggest box that fits: the whole image when free, else the
  // largest centred `aspect` rectangle — the same starting state as mobile.
  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(
        aspect
          ? centerCrop(
              makeAspectCrop({ unit: "%", width: 100 }, aspect, width, height),
              width,
              height,
            )
          : { unit: "%", x: 0, y: 0, width: 100, height: 100 },
      );
    },
    [aspect],
  );

  async function confirm() {
    const image = imgRef.current;
    if (!crop || !image || busy) return;
    if (crop.width <= 0 || crop.height <= 0) return;
    setBusy(true);
    try {
      const rect = rectFromPercentCrop(
        crop,
        image.naturalWidth,
        image.naturalHeight,
      );
      if (onCroppedRect) await onCroppedRect(rect);
      else if (onCropped) await onCropped(await getCroppedBlob(src, rectToArea(rect)));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="px-5 pb-3 pt-4 text-center text-base font-bold text-foreground">
          {title}
        </div>
        <div className="flex max-h-[60vh] items-center justify-center overflow-hidden bg-black">
          <ReactCrop
            crop={crop}
            onChange={(_px, percent) => setCrop(percent)}
            aspect={aspect}
            circularCrop={cropShape === "round"}
            keepSelection
            ruleOfThirds
            minWidth={16}
            minHeight={16}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onImageLoad}
              className="max-h-[60vh] w-auto select-none"
            />
          </ReactCrop>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-foreground/30 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="brand-gradient flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(68,136,255,0.35)] hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
