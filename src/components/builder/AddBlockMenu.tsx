"use client";

import { useTranslations } from "next-intl";
import { BLOCK_CATALOG } from "@/lib/builder/catalog";
import { useEditorStore } from "@/stores/editor-store";

export function AddBlockMenu() {
  const t = useTranslations("builder");
  const addBlock = useEditorStore((s) => s.addBlock);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t("addBlock")}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {BLOCK_CATALOG.map(({ type, labelKey, Icon, make }) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(make())}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-muted"
          >
            <Icon className="size-5 text-primary" />
            {t(`blocks.${labelKey}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
