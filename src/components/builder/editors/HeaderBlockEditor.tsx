"use client";

import { useTranslations } from "next-intl";
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CaseSensitive,
  ALargeSmall,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import type { HeaderBlock, ImageAlignment } from "@/lib/types/blocks";
import { GroupedCard, GroupedRow, ColorRow } from "./sheet-kit";

/**
 * Header (text heading) block editor, mirroring the mobile HeaderSettingsSheet:
 * an accent-strip title field (JSON key `value`), then a grouped card with an
 * alignment picker (`align`: ImageAlignment start/center/end), a font-size
 * slider (`size`, 10–30) and a background-color toggle.
 */
export function HeaderBlockEditor({ block }: { block: HeaderBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const setBlock = (patch: Partial<HeaderBlock>) => updateBlock(block.id, patch);

  const size = block.size ?? 22;

  return (
    <div className="space-y-4">
      {/* ── Title field with accent strip (mobile buildAccentTitleField) ── */}
      <div className="flex items-center overflow-hidden rounded-2xl bg-surface ring-1 ring-foreground/[0.08]">
        <span className="h-[50px] w-1 shrink-0 bg-primary" />
        <Type className="mx-3 size-[18px] shrink-0 text-primary/70" />
        <input
          value={block.value ?? ""}
          maxLength={30}
          onChange={(e) => setBlock({ value: e.target.value })}
          placeholder={t("fields.text")}
          className="h-[50px] flex-1 bg-transparent pe-4 text-sm font-medium text-foreground outline-none placeholder:text-foreground/40"
        />
      </div>

      {/* ── Grouped options card ── */}
      <GroupedCard>
        <GroupedRow
          Icon={CaseSensitive}
          color="var(--primary)"
          title={t("fields.align")}
          trailing={
            <AlignmentPicker
              value={block.align}
              onChange={(v) => setBlock({ align: v })}
            />
          }
        />
        <GroupedRow
          Icon={ALargeSmall}
          color="#14b8a6"
          title={t("fields.size")}
          trailing={
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={30}
                step={0.5}
                value={size}
                onChange={(e) => setBlock({ size: Number(e.target.value) })}
                className="w-28 accent-primary"
                aria-label={t("fields.size")}
              />
              <span className="w-8 text-end text-xs tabular-nums text-muted-foreground">
                {size.toFixed(1)}
              </span>
            </div>
          }
        />
        <ColorRow
          label={t("fields.background")}
          color={block.background_color ?? hexToArgbA("#000000")!}
          enabled={!!block.use_background_color}
          onColor={(c) => setBlock({ background_color: c })}
          onToggle={(v) => setBlock({ use_background_color: v })}
        />
      </GroupedCard>
    </div>
  );
}

// ---- Alignment picker (mirrors the mobile AlignmentPicker) ----

const ALIGN_OPTIONS: { value: ImageAlignment; Icon: typeof AlignLeft }[] = [
  { value: "start", Icon: AlignLeft },
  { value: "center", Icon: AlignCenter },
  { value: "end", Icon: AlignRight },
];

function AlignmentPicker({
  value,
  onChange,
}: {
  value: ImageAlignment;
  onChange: (value: ImageAlignment) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {ALIGN_OPTIONS.map(({ value: v, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-label={v}
            aria-pressed={active}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border transition-colors",
              active
                ? "border-primary bg-primary/20 text-foreground"
                : "border-transparent bg-foreground/[0.06] text-foreground/70",
            )}
          >
            <Icon className="size-[18px]" />
          </button>
        );
      })}
    </div>
  );
}
