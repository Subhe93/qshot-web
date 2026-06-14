"use client";

import { useTranslations } from "next-intl";
import { Minus } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { ColorPickerField } from "@/components/ui/color-picker";
import type { DividerBlock } from "@/lib/types/blocks";
import { GroupedCard, GroupedRow, ColorRow } from "./sheet-kit";

/**
 * Divider block editor, mirroring the mobile DividerSettingsSheet:
 * line thickness slider (JSON key `space`), line color, and a
 * background-color toggle.
 */
export function DividerBlockEditor({ block }: { block: DividerBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const setBlock = (patch: Partial<DividerBlock>) => updateBlock(block.id, patch);

  const thickness = block.space ?? 1;

  return (
    <div className="space-y-4">
      <GroupedCard>
        <GroupedRow
          Icon={Minus}
          color="var(--primary)"
          title={t("fields.thickness")}
          trailing={
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.5}
                max={20}
                step={0.5}
                value={thickness}
                onChange={(e) => setBlock({ space: Number(e.target.value) })}
                className="w-32 accent-primary"
                aria-label={t("fields.thickness")}
              />
              <span className="w-8 text-end text-xs tabular-nums text-muted-foreground">
                {thickness}
              </span>
            </div>
          }
        />
        <GroupedRow
          customIcon={
            <ColorPickerField
              value={block.color ?? hexToArgbA("#000000")!}
              onChange={(c) => setBlock({ color: c })}
              showAlpha={false}
              compact
            />
          }
          title={t("fields.color")}
        />
        <ColorRow
          label={t("fields.background")}
          color={block.background_color ?? hexToArgbA("#ffffff")!}
          enabled={!!block.use_background_color}
          onColor={(c) => setBlock({ background_color: c })}
          onToggle={(v) => setBlock({ use_background_color: v })}
        />
      </GroupedCard>
    </div>
  );
}
