"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { cdnUrl } from "@/lib/api/qrcodes";
import { uploadImage } from "@/lib/api/media";
import { ImageCropper } from "@/components/ui/image-cropper";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { heroStyleFlags } from "@/lib/builder/hero-defaults";
import { cn } from "@/lib/utils";
import { ColorPickerField } from "@/components/ui/color-picker";
import type { CoverPhotoSize, WebsiteSettings } from "@/lib/types/profile";

// Cover sizes that overlay-limit the hero content (mobile CoverPhotoSize.limitedContent).
const LIMITED_SIZES: CoverPhotoSize[] = ["horizontal", "square"];
import {
  GroupedCard,
  GroupedRow,
  SectionLabel,
  ToggleSwitch,
} from "../editors/sheet-kit";

const SIZES: { value: CoverPhotoSize; label: string }[] = [
  { value: "horizontal", label: "16:9" },
  { value: "square", label: "1:1" },
  { value: "poster", label: "4:5" },
  { value: "vertical", label: "9:16" },
];

const SIZE_ASPECT: Record<CoverPhotoSize, number> = {
  horizontal: 16 / 9,
  square: 1,
  poster: 4 / 5,
  vertical: 9 / 16,
};

export function CoverTab({
  settings,
  update,
}: {
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const cover = settings.cover_photo ?? {};
  const setCover = (patch: Partial<typeof cover>) =>
    update({ cover_photo: { ...cover, ...patch } });

  // Mirror the mobile `putCoverImage`: a colored overlay sits over the cover at
  // `transparency` alpha, so an extreme value (e.g. style6 defaults to 1, fully
  // opaque) would completely hide a newly-added image. When setting an image and
  // the current transparency is extreme (<0.1 or >0.9), reset it to 0.1 so the
  // image is actually visible.
  const setCoverImage = (image_url?: string, extra?: Partial<typeof cover>) => {
    if (!image_url) {
      setCover({ image_url: undefined, ...extra });
      return;
    }
    const tNow = cover.transparency ?? 0;
    const patch: Partial<typeof cover> = { image_url, ...extra };
    if (tNow < 0.1 || tNow > 0.9) patch.transparency = 0.1;
    setCover(patch);
  };

  const flags = heroStyleFlags(settings.style ?? "style2");
  const cardColor = settings.card_style?.color ?? 0xffffffff;

  // Picking a limited cover size (16:9 / 1:1) hides the hero title/text/buttons —
  // warn first (mobile showContentLimitDialog), only if the style has content.
  const [pendingSize, setPendingSize] = useState<CoverPhotoSize | null>(null);
  // After (optional) confirmation, the mobile re-crops the existing cover image
  // to the new aspect ratio (cropImageRect) before saving the size — we open the
  // cropper for the same reason. Cancelling the crop leaves the size unchanged.
  const [cropSize, setCropSize] = useState<CoverPhotoSize | null>(null);
  const hasContent =
    flags.hasTitle || flags.hasText || flags.hasButton1 || flags.hasButton2;

  function applySize(v: CoverPhotoSize) {
    if (cover.image_url) {
      setCropSize(v); // open the cropper at the new aspect ratio
      return;
    }
    setCover({ size: v });
  }
  function chooseSize(v: CoverPhotoSize) {
    if (LIMITED_SIZES.includes(v) && hasContent) {
      setPendingSize(v);
      return;
    }
    applySize(v);
  }

  return (
    <div className="space-y-5">
      {/* Image */}
      <div className="space-y-2">
        <SectionLabel>Image</SectionLabel>
        <ImageUploader
          path={cover.image_url}
          onUploaded={(p) => setCoverImage(p)}
          onDelete={() => setCover({ image_url: undefined })}
          aspect={SIZE_ASPECT[cover.size ?? "horizontal"]}
        />
        <GroupedCard>
          <GroupedRow
            Icon={ImageIcon}
            title="Hide cover"
            trailing={
              <ToggleSwitch
                checked={!!cover.hide}
                onChange={(v) => setCover({ hide: v })}
              />
            }
          />
        </GroupedCard>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <SectionLabel>Size</SectionLabel>
        <Segmented
          options={SIZES}
          value={cover.size ?? "horizontal"}
          onChange={chooseSize}
        />
      </div>

      {/* Transparency */}
      <div className="space-y-2">
        <SectionLabel>Transparency</SectionLabel>
        <Slider
          value={cover.transparency ?? 0}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => setCover({ transparency: v })}
        />
      </div>

      {/* Overlay + fade + card */}
      <div className="space-y-2">
        <SectionLabel>Overlay</SectionLabel>
        <GroupedCard>
          <GroupedRow
            customIcon={
              <ColorPickerField
                value={cover.color ?? 0xff000000}
                onChange={(c) => setCover({ color: c })}
                compact
              />
            }
            title="Overlay color"
          />
          <GroupedRow
            title="Fade"
            trailing={
              <ToggleSwitch
                checked={!!cover.fade}
                onChange={(v) => setCover({ fade: v })}
              />
            }
          />
          {flags.hasCard && (
            <GroupedRow
              customIcon={
                <ColorPickerField
                  value={cardColor}
                  onChange={(c) =>
                    update({ card_style: { ...settings.card_style, color: c } })
                  }
                  compact
                />
              }
              title="Card color"
            />
          )}
        </GroupedCard>
      </div>

      {/* Limited cover size warning (mobile showContentLimitDialog). */}
      <ConfirmDialog
        open={pendingSize !== null}
        type="warning"
        title={t("careful")}
        message={t("coverSizeWarning")}
        confirmText={t("confirm")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          const v = pendingSize;
          setPendingSize(null);
          if (v) applySize(v);
        }}
        onCancel={() => setPendingSize(null)}
      />

      {/* Re-crop the cover image to the newly chosen aspect ratio (mobile
          cropImageRect). Cancelling keeps the current size. */}
      {cropSize !== null && cover.image_url && (
        <ImageCropper
          // Load through our same-origin proxy — the CDN has no CORS headers, so
          // a direct CDN <img> would taint the canvas and break toBlob() export.
          src={`/api/image-proxy?url=${encodeURIComponent(cdnUrl(cover.image_url))}`}
          title="Crop image"
          cancelLabel={tc("cancel")}
          confirmLabel="Done"
          aspect={SIZE_ASPECT[cropSize]}
          onCancel={() => setCropSize(null)}
          onCropped={async (blob) => {
            const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
            const uploaded = await uploadImage(file);
            if (uploaded) setCoverImage(uploaded, { size: cropSize });
            else setCover({ size: cropSize });
            setCropSize(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Shared local controls ----

export function ImageUploader({
  path,
  onUploaded,
  onDelete,
  rounded = "rounded-2xl",
  aspect = 1,
  cropShape = "rect",
}: {
  path?: string | null;
  onUploaded: (path: string) => void;
  onDelete: () => void;
  rounded?: string;
  /** Crop aspect ratio (width/height). Cover passes its size ratio; logo/picture 1. */
  aspect?: number;
  cropShape?: "rect" | "round";
}) {
  const t = useTranslations("builder");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Crop + compress before uploading (mirrors the mobile flow; the backend
    // rejects raw/oversized files). getCroppedBlob exports a small JPEG.
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function onCropped(blob: Blob) {
    setBusy(true);
    try {
      const file = new File([blob], "icon.jpg", { type: "image/jpeg" });
      const uploaded = await uploadImage(file);
      if (uploaded) onUploaded(uploaded);
    } finally {
      setBusy(false);
      closeCropper();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden border border-input bg-muted",
          rounded,
        )}
      >
        {path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnUrl(path)} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="size-5 animate-spin text-white" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex-1 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        {path ? t("fields.changeImage") : t("fields.uploadImage")}
      </button>
      {path && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("fields.deleteImage")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-error hover:bg-error/10"
        >
          <Trash2 className="size-4" />
        </button>
      )}

      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          title="Crop image"
          cancelLabel="Cancel"
          confirmLabel="Done"
          aspect={aspect}
          cropShape={cropShape}
          onCancel={closeCropper}
          onCropped={onCropped}
        />
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-[10px] py-2 text-[13px] font-semibold transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-foreground/45",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-foreground/15 accent-primary"
      />
      <span className="w-10 text-end text-xs font-medium tabular-nums text-muted-foreground">
        {value.toFixed(step < 1 ? 2 : 0)}
      </span>
    </div>
  );
}
