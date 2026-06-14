"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, ZoomIn } from "lucide-react";
import { getCroppedBlob } from "@/lib/builder/crop-image";

/**
 * Full-screen 1:1 image cropper modal, mirroring the mobile ImageCropper: a
 * draggable/zoomable square crop over the picked image, then exports a
 * compressed blob via onCropped.
 */
export function ImageCropper({
  src,
  title,
  cancelLabel,
  confirmLabel,
  onCancel,
  onCropped,
  aspect = 1,
  cropShape = "rect",
}: {
  src: string;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void | Promise<void>;
  aspect?: number;
  cropShape?: "rect" | "round";
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_a: Area, px: Area) => setArea(px), []);

  async function confirm() {
    if (!area || busy) return;
    setBusy(true);
    try {
      await onCropped(await getCroppedBlob(src, area));
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
        <div className="relative h-72 bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <ZoomIn className="size-4 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
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
