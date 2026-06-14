"use client";

import { useTranslations } from "next-intl";
import { MoveVertical } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import type { SpacerBlock } from "@/lib/types/blocks";
import { GroupedCard, GroupedRow, ColorRow } from "./sheet-kit";

/**
 * Spacer block editor, mirroring the mobile SpacerSettingsSheet:
 * a height slider (JSON key `space`) and a background-color toggle.
 */
export function SpacerBlockEditor({ block }: { block: SpacerBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const setBlock = (patch: Partial<SpacerBlock>) => updateBlock(block.id, patch);

  const height = block.space ?? 10;

  return (
    <div className="space-y-4">
      <GroupedCard>
        <GroupedRow
          Icon={MoveVertical}
          color="var(--primary)"
          title={t("fields.height")}
          trailing={
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={300}
                step={1}
                value={height}
                onChange={(e) => setBlock({ space: Number(e.target.value) })}
                className="w-32 accent-primary"
                aria-label={t("fields.height")}
              />
              <span className="w-9 text-end text-xs tabular-nums text-muted-foreground">
                {Math.round(height)}
              </span>
            </div>
          }
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
