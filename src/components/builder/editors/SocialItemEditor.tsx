"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sticker } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { platformByName, isDynamicPlatform } from "@/lib/builder/social-platforms";
import { SelectIconSheet } from "./SelectIconSheet";
import type { SocialLinkItem } from "@/lib/types/blocks";

/**
 * Single social-link editor: the value/link field, an optional display name, and
 * (for the custom platform) an uploaded icon + famous-icons picker. The platform
 * is fixed when the link is created via the selector.
 */
export function SocialItemEditor({
  item,
  onChange,
  onClose,
}: {
  item: SocialLinkItem;
  onChange: (patch: Partial<SocialLinkItem>) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");
  const [iconsOpen, setIconsOpen] = useState(false);
  const platform = platformByName(item.type);
  const dynamic = isDynamicPlatform(item.type);

  return (
    <>
      <BottomSheet
        title={platform?.label ?? t("blocks.social")}
        subtitle={t("edit")}
        onClose={onClose}
      >
        <div className="space-y-4">
          {dynamic && (
            <div className="flex items-center gap-3">
              <ImageUploadField
                value={item.icon}
                onChange={(fileName) => onChange({ icon: fileName })}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {t("fields.icon")}
                </p>
                <button
                  type="button"
                  onClick={() => setIconsOpen(true)}
                  className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/[0.06] px-2.5 py-1.5 text-xs font-semibold text-primary"
                >
                  <Sticker className="size-4" />
                  {t("famousIcons")}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("fields.link")}
            </label>
            <Input
              dir="ltr"
              value={item.link ?? ""}
              placeholder={platform?.hint}
              onChange={(e) => onChange({ link: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("fields.displayName")}
            </label>
            <Input
              value={item.name ?? ""}
              onChange={(e) => onChange({ name: e.target.value || undefined })}
            />
          </div>
        </div>
      </BottomSheet>

      {iconsOpen && (
        <SelectIconSheet
          onPicked={(fileName) => onChange({ icon: fileName })}
          onClose={() => setIconsOpen(false)}
        />
      )}
    </>
  );
}
