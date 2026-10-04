"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  Type,
  Pointer,
  FoldVertical,
  Copy,
  CalendarDays,
  ChevronRight,
  Settings as SettingsIcon,
  LayoutGrid,
  ListChecks,
  DollarSign,
  Clock,
  Circle,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { useOpenBookingDashboard } from "@/lib/booking/use-open-booking-dashboard";
import type { BookingBlock, BookingLayoutType } from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";
import { LayoutPicker } from "./LayoutPicker";

type Tab = "general" | "layout" | "content";

// Order and SVGs match the mobile BookingSettingsSheet._buildLayout map:
// list → layoutList, grid → layoutGrid, swiper → layoutSwiper,
// promo → layoutSwiperCard (the existing illustrations, reused).
const LAYOUTS: { type: BookingLayoutType; labelKey: string; svg: string }[] = [
  { type: "list", labelKey: "layoutList", svg: "layout_list.svg" },
  { type: "grid", labelKey: "layoutGrid", svg: "layout_grid.svg" },
  { type: "swiper", labelKey: "layoutSwiper", svg: "layout_swiper.svg" },
  { type: "promo", labelKey: "layoutPromo", svg: "layout_swiper_card.svg" },
];

/** Mobile sheet accent (`accentColor => Color(0xFF4CAF50)`). */
const ACCENT = "#4CAF50";

/**
 * Booking block editor, mirroring the mobile `BookingSettingsSheet`
 * (lib/features/website/widget/sheet/settings/booking_settings_sheet.dart):
 *
 *  - General: title field, button-label field, a grouped card (Dropdown
 *    toggle, Duplicate, Background colour + switch), and a second card with
 *    Manage booking.
 *  - Layout: the four layout thumbnails (list / grid / swiper / promo).
 *  - Content: Show prices, Show durations, and Round images — the last one only
 *    while the layout is `list`.
 *
 * Every change goes straight to the store, so the canvas previews it live while
 * the sheet is open (the mobile `onPreview` callback). The header actions
 * (delete / hide / up / down / close) come from the SettingsPanel host, like
 * every other block sheet.
 */
export function BookingBlockEditor({ block }: { block: BookingBlock }) {
  const t = useTranslations("builder");
  const tb = useTranslations("builder.bookingBlock");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const profileId = useEditorStore((s) => s.profileId);
  const openDashboard = useOpenBookingDashboard();
  const [tab, setTab] = useState<Tab>("general");

  const realId = profileId && profileId !== "new" ? profileId : null;
  const layout: BookingLayoutType = block.layout_type ?? "list";
  const setBlock = (patch: Partial<BookingBlock>) => updateBlock(block.id, patch);

  const tabs: SheetTab<Tab>[] = [
    { value: "general", label: t("tabs.settings"), Icon: SettingsIcon },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "content", label: tb("content"), Icon: ListChecks },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "general" && (
        <div className="space-y-4">
          <AccentField
            Icon={Type}
            value={block.title ?? ""}
            placeholder={t("fields.title")}
            onChange={(v) => setBlock({ title: v })}
          />

          <AccentField
            Icon={Pointer}
            value={block.button_label ?? tb("bookNow")}
            placeholder={tb("bookNow")}
            onChange={(v) => setBlock({ button_label: v })}
          />

          <GroupedCard>
            <GroupedRow
              Icon={FoldVertical}
              color="var(--primary)"
              title={tb("dropdown")}
              trailing={
                <ToggleSwitch
                  checked={!!block.foldable}
                  onChange={(v) => setBlock({ foldable: v })}
                />
              }
            />
            <GroupedRow
              Icon={Copy}
              color="#673ab7"
              title={t("fields.duplicate")}
              onClick={() => addBlock({ ...block, id: nanoid() })}
              trailing={<ChevronRight className="size-3.5 text-foreground/30 rtl:rotate-180" />}
            />
            <ColorRow
              label={t("fields.background")}
              color={block.background_color ?? hexToArgbA("#000000")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
          </GroupedCard>

          {/* Manage booking — opens the site's booking dashboard in a NEW tab so
              the sheet and its unsaved edits stay exactly as they are (mobile
              pushes the dashboard over the sheet for the same reason). */}
          <GroupedCard>
            <GroupedRow
              Icon={CalendarDays}
              color={ACCENT}
              title={tb("manageBooking")}
              onClick={realId ? () => openDashboard(realId) : undefined}
              trailing={<ChevronRight className="size-3.5 text-foreground/30 rtl:rotate-180" />}
            />
          </GroupedCard>
        </div>
      )}

      {tab === "layout" && (
        <LayoutPicker
          options={LAYOUTS.map((l) => ({ ...l, label: tb(l.labelKey) }))}
          value={layout}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "content" && (
        <GroupedCard>
          <GroupedRow
            Icon={DollarSign}
            color="#4caf50"
            title={tb("showPrice")}
            trailing={
              <ToggleSwitch
                checked={block.show_price !== false}
                onChange={(v) => setBlock({ show_price: v })}
              />
            }
          />
          <GroupedRow
            Icon={Clock}
            color="#448aff"
            title={tb("showDuration")}
            trailing={
              <ToggleSwitch
                checked={block.show_duration !== false}
                onChange={(v) => setBlock({ show_duration: v })}
              />
            }
          />
          {layout === "list" && (
            <GroupedRow
              Icon={Circle}
              color="#e91e63"
              title={tb("roundImages")}
              trailing={
                <ToggleSwitch
                  checked={block.circle_image === true}
                  onChange={(v) => setBlock({ circle_image: v })}
                />
              }
            />
          )}
        </GroupedCard>
      )}
    </div>
  );
}

// ---- Accent text field (mirrors mobile buildAccentTitleField) ----

function AccentField({
  Icon,
  value,
  placeholder,
  onChange,
}: {
  Icon: typeof Type;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface px-3.5">
      <Icon className="size-[18px] shrink-0 text-primary" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
        className="h-12 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground/35"
      />
    </div>
  );
}
