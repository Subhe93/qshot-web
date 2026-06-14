"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BRAND_ICON_SETS, brandIconUrl } from "@/lib/builder/brand-icons";
import { svgUrlToPngBlob } from "@/lib/builder/svg-raster";
import { uploadImage } from "@/lib/api/media";

const ICONS = BRAND_ICON_SETS.flatMap((set) =>
  set.files.map((file) => ({ key: `${set.dir}/${file}`, url: brandIconUrl(set.dir, file) })),
);

/**
 * "Famous icons" picker, mirroring the mobile SelectIconSheet: a grid of bundled
 * brand SVGs. Selecting one rasterizes it to PNG and uploads it (like the mobile
 * svgToPng + upload), returning the stored file_name.
 */
export function SelectIconSheet({
  onPicked,
  onClose,
}: {
  onPicked: (fileName: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function pick(icon: { key: string; url: string }) {
    if (busyKey) return;
    setBusyKey(icon.key);
    try {
      const blob = await svgUrlToPngBlob(icon.url);
      const file = new File([blob], "icon.png", { type: "image/png" });
      const name = await uploadImage(file);
      if (name) {
        onPicked(name);
        onClose();
      }
    } catch {
      // ignore — leave the sheet open so the user can retry
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <BottomSheet title={t("famousIcons")} onClose={onClose}>
      <div className="grid grid-cols-5 gap-3">
        {ICONS.map((icon) => (
          <button
            key={icon.key}
            type="button"
            onClick={() => pick(icon)}
            disabled={!!busyKey}
            className="relative flex aspect-square items-center justify-center rounded-xl border border-border bg-card p-2 shadow-sm transition-colors hover:border-primary/40 disabled:opacity-60"
          >
            {busyKey === icon.key ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon.url} alt="" className="size-full object-contain" />
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
