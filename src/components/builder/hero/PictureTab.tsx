"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Circle, Square, RectangleHorizontal } from "lucide-react";
import { cdnUrl } from "@/lib/api/qrcodes";
import { uploadImage } from "@/lib/api/media";
import { ImageCropper } from "@/components/ui/image-cropper";
import { ColorPickerField } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import type { ImageShape, WebsiteSettings } from "@/lib/types/profile";
import {
  GroupedCard,
  GroupedRow,
  SectionLabel,
  ToggleSwitch,
} from "../editors/sheet-kit";
import { ImageUploader, Slider } from "./CoverTab";
import { AlignmentButtons } from "./HeaderTab";

const SHAPES = [
  { value: "circle" as ImageShape, Icon: Circle },
  { value: "square" as ImageShape, Icon: Square },
  { value: "rectangle" as ImageShape, Icon: RectangleHorizontal },
];

export function PictureTab({
  settings,
  update,
}: {
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
}) {
  const tc = useTranslations("common");
  const pic = settings.profile_picture ?? {};
  const setPic = (patch: Partial<typeof pic>) =>
    update({ profile_picture: { ...pic, ...patch } });

  const shape = pic.shape ?? "circle";
  const picAspect = shape === "rectangle" ? 16 / 9 : 1;

  // Changing the shape re-crops the existing image to the new aspect ratio
  // (mobile cropImageRect) before saving the shape — open the cropper for the
  // same reason. Cancelling the crop leaves the shape unchanged.
  const [cropShape, setCropShape] = useState<ImageShape | null>(null);

  function applyShape(value: ImageShape) {
    if (pic.image_url) {
      setCropShape(value); // open the cropper at the new aspect ratio
      return;
    }
    setPic({ shape: value });
  }

  return (
    <div className="space-y-5">
      {/* Image */}
      <div className="space-y-2">
        <SectionLabel>Image</SectionLabel>
        <ImageUploader
          path={pic.image_url}
          onUploaded={(p) => setPic({ image_url: p })}
          onDelete={() => setPic({ image_url: undefined })}
          aspect={picAspect}
          cropShape={shape === "circle" ? "round" : "rect"}
          rounded={shape === "circle" ? "rounded-full" : "rounded-2xl"}
        />
        <GroupedCard>
          <GroupedRow
            title="Hide picture"
            trailing={
              <ToggleSwitch
                checked={!!pic.hide}
                onChange={(v) => setPic({ hide: v })}
              />
            }
          />
        </GroupedCard>
      </div>

      {/* Shape */}
      <div className="space-y-2">
        <SectionLabel>Shape</SectionLabel>
        <div className="flex gap-1 rounded-xl bg-surface p-1">
          {SHAPES.map(({ value, Icon }) => {
            const active = (pic.shape ?? "circle") === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => applyShape(value)}
                aria-label={value}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-[10px] py-2 transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-foreground/45",
                )}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Alignment */}
      <div className="space-y-2">
        <SectionLabel>Alignment</SectionLabel>
        <AlignmentButtons
          value={pic.alignment ?? "center"}
          onChange={(v) => setPic({ alignment: v })}
        />
      </div>

      {/* Border */}
      <div className="space-y-2">
        <SectionLabel>Border width</SectionLabel>
        <Slider
          value={pic.border_width ?? 0}
          min={0}
          max={5}
          step={1}
          onChange={(v) => setPic({ border_width: v })}
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>Border color</SectionLabel>
        <GroupedCard>
          <GroupedRow
            customIcon={
              <ColorPickerField
                value={pic.border_color ?? 0xffffffff}
                onChange={(c) => setPic({ border_color: c })}
                compact
              />
            }
            title="Border color"
          />
        </GroupedCard>
      </div>

      {/* Re-crop the picture to the newly chosen shape's aspect ratio (mobile
          cropImageRect). Cancelling keeps the current shape. */}
      {cropShape !== null && pic.image_url && (
        <ImageCropper
          // Load through our same-origin proxy — the CDN has no CORS headers, so
          // a direct CDN <img> would taint the canvas and break toBlob() export.
          src={`/api/image-proxy?url=${encodeURIComponent(cdnUrl(pic.image_url))}`}
          title="Crop image"
          cancelLabel={tc("cancel")}
          confirmLabel="Done"
          aspect={cropShape === "rectangle" ? 16 / 9 : 1}
          cropShape={cropShape === "circle" ? "round" : "rect"}
          onCancel={() => setCropShape(null)}
          onCropped={async (blob) => {
            const file = new File([blob], "picture.jpg", { type: "image/jpeg" });
            const uploaded = await uploadImage(file);
            if (uploaded) setPic({ image_url: uploaded, shape: cropShape });
            else setPic({ shape: cropShape });
            setCropShape(null);
          }}
        />
      )}
    </div>
  );
}
