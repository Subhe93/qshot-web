"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Lock } from "lucide-react";
import { BLOCK_CATALOG } from "@/lib/builder/catalog";
import { useEditorStore } from "@/stores/editor-store";
import { BrandIcon, BrandIconDefs } from "@/components/ui/brand-icon";
import { usePlan } from "@/lib/plan/use-plan";
import { PLAN_FEATURES } from "@/lib/plan/features";
import { useUpgradeDialog } from "@/components/plan/upgrade-dialog";
import type { Block, BlockType } from "@/lib/types/blocks";

/**
 * Plan-gated block types (mobile block_selector_sheet). NOTE: mobile's
 * form_widget reads add_social_feed for the lead form by mistake — the
 * selector itself uses add_lead_form, which is what we mirror (CONTRACT §9.1).
 */
const BLOCK_FEATURE: Partial<Record<BlockType, string>> = {
  SocialFeedModule: PLAN_FEATURES.addSocialFeed,
  FormModule: PLAN_FEATURES.addLeadForm,
  BookingModule: PLAN_FEATURES.addBooking,
};

/**
 * Add-block content, mirroring the mobile BlockSelectorSheet: "rich" blocks as
 * list rows with a description, and "basic" blocks as round brand-gradient icon
 * buttons. Rendered inside the BottomSheet.
 */
export function AddBlockMenu({ onAdded }: { onAdded?: () => void }) {
  const t = useTranslations("builder");
  const addBlock = useEditorStore((s) => s.addBlock);
  const plan = usePlan();
  const showUpgrade = useUpgradeDialog((s) => s.show);
  const rich = BLOCK_CATALOG.filter((e) => e.kind === "rich");
  const basic = BLOCK_CATALOG.filter((e) => e.kind === "basic");

  const blockAllowed = (type: BlockType) => {
    const code = BLOCK_FEATURE[type];
    return !code || plan.isAvailable(code);
  };
  const add = (type: BlockType, make: () => Block) => {
    if (!blockAllowed(type)) {
      showUpgrade();
      return;
    }
    addBlock(make());
    onAdded?.();
  };

  return (
    <div className="space-y-5">
      <BrandIconDefs />

      {/* Rich blocks — list rows with description */}
      <div className="space-y-2">
        {rich.map((e) => {
          const ok = blockAllowed(e.type);
          return (
            <button
              key={e.type}
              type="button"
              onClick={() => add(e.type, e.make)}
              className={`flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:border-primary/40 hover:bg-surface ${ok ? "" : "opacity-60"}`}
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
              {ok ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 rtl:rotate-180" />
              ) : (
                // Plan-locked (mobile parity): the row stays visible, the lock
                // explains itself, tapping opens the upgrade dialog.
                <span className="brand-gradient flex size-6 shrink-0 items-center justify-center rounded-full text-white">
                  <Lock className="size-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Basic blocks — round brand-gradient icon buttons, pinned to the bottom
          of the sheet (sticky) so the common blocks stay reachable while the rich
          list scrolls above. The upward shadow makes it read as a floating footer
          over scrollable content — hinting there's more above. */}
      <div className="sticky bottom-[-15px] z-10 -mx-4 -mb-4 border-t border-border bg-card px-4 pb-4 pt-3 shadow-[0_-10px_22px_-10px_rgba(0,0,0,0.22)]">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("basics")}
        </p>
        <div className="grid grid-cols-5 gap-1">
          {basic.map((e) => (
            <button
              key={e.type}
              type="button"
              onClick={() => add(e.type, e.make)}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-2 transition-colors hover:bg-surface"
            >
              <span className="flex size-11.5 items-center justify-center rounded-full bg-card shadow-[0_4px_16px_rgba(0,0,0,0.10)] ring-1 ring-border/60">
                <BrandIcon icon={e.icon} size={18} />
              </span>
              <span className="w-full truncate text-center text-[10px] font-medium text-foreground/70">
                {t(`blocks.${e.labelKey}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
