"use client";

import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { BLOCK_CATALOG } from "@/lib/builder/catalog";
import { useEditorStore } from "@/stores/editor-store";
import { BrandIcon, BrandIconDefs } from "@/components/ui/brand-icon";
import type { Block } from "@/lib/types/blocks";

/**
 * Add-block content, mirroring the mobile BlockSelectorSheet: "rich" blocks as
 * list rows with a description, and "basic" blocks as round brand-gradient icon
 * buttons. Rendered inside the BottomSheet.
 */
export function AddBlockMenu({ onAdded }: { onAdded?: () => void }) {
  const t = useTranslations("builder");
  const addBlock = useEditorStore((s) => s.addBlock);
  const rich = BLOCK_CATALOG.filter((e) => e.kind === "rich");
  const basic = BLOCK_CATALOG.filter((e) => e.kind === "basic");

  const add = (make: () => Block) => {
    addBlock(make());
    onAdded?.();
  };

  return (
    <div className="space-y-5">
      <BrandIconDefs />

      {/* Rich blocks — list rows with description */}
      <div className="space-y-2">
        {rich.map((e) => (
          <button
            key={e.type}
            type="button"
            onClick={() => add(e.make)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:border-primary/40 hover:bg-surface"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface">
              <BrandIcon icon={e.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">
                {t(`blocks.${e.labelKey}`)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {t(`blockDesc.${e.labelKey}`)}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 rtl:rotate-180" />
          </button>
        ))}
      </div>

      {/* Basic blocks — round brand-gradient icon buttons, pinned to the bottom
          of the sheet (sticky) so the common blocks stay reachable while the rich
          list scrolls above. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border bg-card px-4 pb-4 pt-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("basics")}
        </p>
        <div className="flex flex-wrap gap-1">
          {basic.map((e) => (
            <button
              key={e.type}
              type="button"
              onClick={() => add(e.make)}
              className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 rounded-xl py-2 transition-colors hover:bg-surface"
            >
              <span className="flex size-[52px] items-center justify-center rounded-full bg-card shadow-[0_4px_16px_rgba(0,0,0,0.10)] ring-1 ring-border/60">
                <BrandIcon icon={e.icon} size={18} />
              </span>
              <span className="text-[11px] font-medium text-foreground/70">
                {t(`blocks.${e.labelKey}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
