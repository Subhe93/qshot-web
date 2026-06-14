"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  SOCIAL_PLATFORMS,
  type PlatformCategory,
  type SocialPlatform,
} from "@/lib/builder/social-platforms";
import { brandIconUrl } from "@/lib/builder/brand-icons";
import { GroupedCard, GroupedRow, SectionLabel } from "./sheet-kit";

const CATEGORIES: PlatformCategory[] = ["popular", "social", "contact"];

/**
 * Platform picker for adding a social link, mirroring the mobile
 * SocialLinksSelectorSheet (Popular / Social / Contact sections with brand icons).
 */
export function PlatformSelectorSheet({
  onPick,
  onClose,
}: {
  onPick: (platform: SocialPlatform) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");

  return (
    <BottomSheet title={t("fields.addLink")} onClose={onClose}>
      <div className="space-y-4">
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <SectionLabel>{t(`socialCat.${cat}`)}</SectionLabel>
            <GroupedCard>
              {SOCIAL_PLATFORMS.filter((p) => p.category === cat).map((p) => (
                <GroupedRow
                  key={p.name}
                  title={p.label}
                  onClick={() => onPick(p)}
                  customIcon={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brandIconUrl("colored", p.file)}
                      alt=""
                      className="size-[30px] shrink-0 rounded-md"
                    />
                  }
                  trailing={
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Plus className="size-3.5" />
                    </span>
                  }
                />
              ))}
            </GroupedCard>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
