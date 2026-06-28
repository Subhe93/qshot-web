"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutGrid,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Hash,
  UserCircle,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import type {
  SocialFeedBlock,
  FeedConfiguration,
  SocialFeedLayoutType,
} from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";
import { LayoutPicker } from "./LayoutPicker";

type Tab = "layout" | "general";

// Provider metadata mirrors the three mobile FeedConfiguration subclasses
// (YoutubeFeedConfiguration / VimeoFeedConfiguration / InstagramFeedConfiguration).
const PROVIDERS: Record<
  FeedConfiguration,
  { label: string; hint: string; color: string }
> = {
  youtube: { label: "YouTube Videos", hint: "youtube.com/@channel", color: "#FF0000" },
  vimeo: { label: "Vimeo Showcase", hint: "vimeo.com/channel", color: "#1AB7EA" },
  instagram: { label: "Instagram Page Feed", hint: "instagram.com/username", color: "#DD2A7B" },
};

// Mobile: layout picker only shown for YouTube / Vimeo (layoutOptions != null).
const HAS_LAYOUT: Record<FeedConfiguration, boolean> = {
  youtube: true,
  vimeo: true,
  instagram: false,
};

// Mobile layout order in the PageView: swiper, list, grid (enum order).
// `svg` mirrors the mobile asset mapped per SocialFeedLayoutType in
// social_feed_settings_sheet.dart (Assets.svg.videoLayout*), copied into
// web-app/public/layouts/.
const LAYOUTS: { type: SocialFeedLayoutType; label: string; svg: string }[] = [
  { type: "swiper", label: "Swiper", svg: "video_layout_swiper.svg" },
  { type: "list", label: "List", svg: "video_layout_list.svg" },
  { type: "grid", label: "Grid", svg: "video_layout_grid.svg" },
];

/**
 * SocialFeed block editor, mirroring the mobile `SocialFeedSettingsSheet`:
 * a Layout tab (only for YouTube/Vimeo) and a General/Settings tab carrying the
 * accent title, posts-count stepper (min 2, max 20), show-profile toggle
 * (Instagram only), duplicate and background colour. It additionally exposes the
 * provider selector + provider `info.link` field that the mobile gathers through
 * the dedicated feed-input screens.
 */
export function SocialFeedBlockEditor({ block }: { block: SocialFeedBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);

  const configuration: FeedConfiguration = block.configuration ?? "youtube";
  const hasLayout = HAS_LAYOUT[configuration];

  const [tab, setTab] = useState<Tab>(hasLayout ? "layout" : "general");

  const setBlock = (patch: Partial<SocialFeedBlock>) => updateBlock(block.id, patch);

  const info = block.info ?? {};
  // Mobile fetches YouTube via info.channel_id and Instagram via info.username;
  // read any of them so a mobile-created block shows its value here.
  const link =
    (info["link"] as string | undefined) ??
    (info["channel_id"] as string | undefined) ??
    (info["username"] as string | undefined) ??
    "";
  const postsCount = block.posts_count ?? 4;
  const settings = block.settings ?? null;
  const showProfile =
    (settings?.["show_profile_details"] as boolean | undefined) ?? true;

  function setConfiguration(next: FeedConfiguration) {
    // Instagram carries a settings map with show_profile_details (mobile
    // additionalSettings); the RSS providers carry none.
    const nextSettings =
      next === "instagram"
        ? { ...(settings ?? {}), show_profile_details: showProfile ?? true }
        : null;
    setBlock({ configuration: next, settings: nextSettings });
    setTab(HAS_LAYOUT[next] ? "layout" : "general");
  }

  function setLink(value: string) {
    // Write the provider-specific key mobile reads (channel_id / username), plus
    // `link` for the web's own reads.
    const next: Record<string, unknown> = { ...info, link: value };
    if (configuration === "youtube") next.channel_id = value;
    if (configuration === "instagram") next.username = value;
    setBlock({ info: next });
  }

  function setPostsCount(value: number) {
    setBlock({ posts_count: Math.min(20, Math.max(2, value)) });
  }

  const tabs: SheetTab<Tab>[] = [
    ...(hasLayout
      ? [{ value: "layout" as const, label: t("tabs.layout"), Icon: LayoutGrid }]
      : []),
    { value: "general", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      {/* Provider selector — mirrors FeedConfiguration.all */}
      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(Object.keys(PROVIDERS) as FeedConfiguration[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setConfiguration(p)}
            className={cn(
              "flex-1 rounded-[10px] py-2 text-[13px] font-semibold capitalize transition-colors",
              configuration === p ? "bg-card text-foreground shadow-sm" : "text-foreground/45",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {tabs.length > 1 && <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />}

      {tab === "layout" && hasLayout && (
        <LayoutPicker
          options={LAYOUTS}
          value={block.layout_type ?? "swiper"}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "general" && (
        <div className="space-y-4">
          {/* Accent title field */}
          <div>
            <label className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground">
              {t("fields.title")}
            </label>
            <input
              type="text"
              value={block.title ?? ""}
              onChange={(e) => setBlock({ title: e.target.value })}
              placeholder={PROVIDERS[configuration].label}
              dir="auto"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Provider link field (gathered via feed-input screens on mobile) */}
          <GroupedCard>
            <GroupedRow
              Icon={LinkIcon}
              color={PROVIDERS[configuration].color}
              title={PROVIDERS[configuration].label}
              trailing={
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder={PROVIDERS[configuration].hint}
                  dir="ltr"
                  className="w-44 rounded-lg bg-foreground/[0.04] px-2 py-1.5 text-end text-[13px] text-foreground outline-none placeholder:text-foreground/30 focus:bg-foreground/[0.07]"
                />
              }
            />
          </GroupedCard>

          <GroupedCard>
            {/* Number of feed posts — min 2, max 20 (mobile NumberPickerBottomSheet) */}
            <GroupedRow
              Icon={Hash}
              color="#a855f7"
              title={t("socialFeed.numberOfPosts")}
              trailing={
                <Stepper value={postsCount} min={2} max={20} onChange={setPostsCount} />
              }
            />

            {/* Show profile overview — Instagram only (settings map present) */}
            {configuration === "instagram" && settings && (
              <GroupedRow
                Icon={UserCircle}
                color="#DD2A7B"
                title={t("socialFeed.showProfileOverview")}
                trailing={
                  <ToggleSwitch
                    checked={showProfile}
                    onChange={(v) =>
                      setBlock({ settings: { ...settings, show_profile_details: v } })
                    }
                  />
                }
              />
            )}

            {/* Duplicate */}
            <GroupedRow
              Icon={Copy}
              color="#7c3aed"
              title={t("fields.duplicate")}
              onClick={() => addBlock({ ...block, id: crypto.randomUUID() })}
            />

            {/* Background color */}
            <ColorRow
              label={t("fields.background")}
              color={block.background_color ?? hexToArgbA("#000000")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
          </GroupedCard>
        </div>
      )}
    </div>
  );
}

// ─── Number stepper (mobile NumberPickerBottomSheet, min 2 / max 20) ──────────

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslations("builder");
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={t("socialFeed.decrease")}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground disabled:opacity-30"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
      </button>
      <span className="min-w-7 rounded-lg bg-primary/20 px-2.5 py-1 text-center text-sm font-semibold text-primary">
        {value}
      </span>
      <button
        type="button"
        aria-label={t("socialFeed.increase")}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground disabled:opacity-30"
      >
        <ChevronRight className="size-4 rtl:rotate-180" />
      </button>
    </div>
  );
}

