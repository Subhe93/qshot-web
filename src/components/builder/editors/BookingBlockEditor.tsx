"use client";

import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  Type,
  MousePointerClick,
  FoldVertical,
  Copy,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import type { BookingBlock } from "@/lib/types/blocks";
import { GroupedCard, GroupedRow, ColorRow, ToggleSwitch } from "./sheet-kit";

/**
 * Booking block editor, mirroring the mobile `BookingSettingsSheet`
 * (lib/.../sheet/settings/booking_settings_sheet.dart).
 *
 * The mobile booking sheet has NO tab bar — it is a single flat "General"
 * panel:
 *   - an accent title field (the section title),
 *   - an accent button-label field (icon: hand pointing),
 *   - a grouped card with: Dropdown (foldable toggle), Duplicate, and
 *     Background color (swatch + enable toggle).
 */
export function BookingBlockEditor({ block }: { block: BookingBlock }) {
  const t = useTranslations("builder");
  const tws = useTranslations("builder.websiteSettings");
  const router = useRouter();
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const profileId = useEditorStore((s) => s.profileId);
  // Booking is configured per-website on its own page; the block just marks where
  // the booking widget renders on the published site (mobile parity). Wire the
  // block to that website's booking management so it's reachable from here.
  const realId = profileId && profileId !== "new" ? profileId : null;

  const setBlock = (patch: Partial<BookingBlock>) => updateBlock(block.id, patch);

  return (
    <div className="space-y-4">
      {/* Link to this website's booking management (services / providers /
          availability). */}
      <button
        type="button"
        disabled={!realId}
        onClick={() => realId && router.push(`/sites/${realId}/booking`)}
        className="flex w-full items-center gap-3 rounded-xl bg-surface px-3.5 py-3 text-start transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "#34c75920", color: "#34c759" }}
        >
          <CalendarDays className="size-5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {tws("manageBooking")}
        </span>
        <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
      </button>

      <AccentField
        Icon={Type}
        value={block.title ?? ""}
        placeholder={t("fields.title")}
        onChange={(v) => setBlock({ title: v })}
      />

      <AccentField
        Icon={MousePointerClick}
        value={block.button_label ?? t("bookingBlock.bookNow")}
        placeholder={t("bookingBlock.bookNow")}
        onChange={(v) => setBlock({ button_label: v })}
      />

      <GroupedCard>
        <GroupedRow
          Icon={FoldVertical}
          color="var(--primary)"
          title={t("bookingBlock.dropdown")}
          trailing={
            <ToggleSwitch
              checked={!!block.foldable}
              onChange={(v) => setBlock({ foldable: v })}
            />
          }
        />
        <ColorRow
          label={t("fields.background")}
          color={block.background_color ?? hexToArgbA("#000000")!}
          enabled={!!block.use_background_color}
          onColor={(c) => setBlock({ background_color: c })}
          onToggle={(v) => setBlock({ use_background_color: v })}
        />
        <GroupedRow
          Icon={Copy}
          color="#7c3aed"
          title={t("fields.duplicate")}
          onClick={() => addBlock({ ...block, id: nanoid() })}
        />
      </GroupedCard>
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
