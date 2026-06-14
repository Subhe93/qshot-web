"use client";

import { Plus } from "lucide-react";
import { argbToCss } from "@/lib/builder/color";

/**
 * Horizontal row of recently-used colors with an add button (and an optional
 * transparent swatch), mirroring the mobile saved-colors strip.
 */
export function SwatchRow({
  colors,
  showTransparent,
  onAdd,
  onSelect,
}: {
  colors: number[];
  showTransparent?: boolean;
  onAdd: () => void;
  onSelect: (argb: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={onAdd}
        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
        aria-label="add color"
      >
        <Plus className="size-4" />
      </button>
      {showTransparent && (
        <button
          type="button"
          onClick={() => onSelect(0x00000000)}
          className="size-7 shrink-0 rounded-full border border-border"
          style={{ background: "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px" }}
          aria-label="transparent"
        />
      )}
      {colors.map((c, i) => (
        <button
          key={`${c}-${i}`}
          type="button"
          onClick={() => onSelect(c)}
          className="size-7 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: argbToCss(c) }}
        />
      ))}
    </div>
  );
}
