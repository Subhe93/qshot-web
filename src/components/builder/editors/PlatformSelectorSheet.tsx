"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
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
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  // When searching, flatten across all categories and match label or value/key.
  const filtered = useMemo(() => {
    if (!q) return [];
    return SOCIAL_PLATFORMS.filter(
      (p) =>
        p.label.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
    );
  }, [q]);

  const renderRow = (p: SocialPlatform) => (
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
  );

  return (
    <BottomSheet title={t("fields.addLink")} onClose={onClose} bodyClassName="p-0">
      <div className="flex max-h-[70vh] flex-col">
        {/* Search header (pinned) */}
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tc("search")}
              className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Results */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {q ? (
            filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {tc("noResults")}
              </p>
            ) : (
              <GroupedCard>{filtered.map(renderRow)}</GroupedCard>
            )
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map((cat) => (
                <div key={cat}>
                  <SectionLabel>{t(`socialCat.${cat}`)}</SectionLabel>
                  <GroupedCard>
                    {SOCIAL_PLATFORMS.filter((p) => p.category === cat).map(
                      renderRow,
                    )}
                  </GroupedCard>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
