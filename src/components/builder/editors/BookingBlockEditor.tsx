"use client";

import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import { Type, MousePointerClick, FoldVertical, Copy } from "lucide-react";
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
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);

  const setBlock = (patch: Partial<BookingBlock>) => updateBlock(block.id, patch);

  return (
    <div className="space-y-4">
      <AccentField
        Icon={Type}
        value={block.title ?? ""}
        placeholder={t("fields.title")}
        onChange={(v) => setBlock({ title: v })}
      />

      <AccentField
        Icon={MousePointerClick}
        value={block.button_label ?? "Book Now"}
        placeholder="Book Now"
        onChange={(v) => setBlock({ button_label: v })}
      />

      <GroupedCard>
        <GroupedRow
          Icon={FoldVertical}
          color="var(--primary)"
          title="Dropdown"
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
