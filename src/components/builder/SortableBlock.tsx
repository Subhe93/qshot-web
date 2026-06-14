"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { Block } from "@/lib/types/blocks";
import { BlockView } from "./preview/BlockView";
import { argbToCss } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Editable block on the canvas. Mirrors the mobile EditorArea: a blue dashed
 * outline (faint by default, full + marching when selected), tap to edit,
 * drag handle to reorder.
 */
export function SortableBlock({
  block,
  selected,
  onSelect,
  onDelete,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bg =
    "use_background_color" in block && block.use_background_color
      ? argbToCss(block.background_color)
      : undefined;
  // Mobile EditorArea dims hidden blocks in the editor (and removes them in
  // preview — see PreviewBlock).
  const hidden = block.hide === true;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-10 opacity-80")}
    >
      {/* A div (not a button): blocks like Button/Form render their own
          <button>/<a>, and a button inside a button is invalid HTML (hydration
          error). Tap-to-select stays via role=button; the inner content is
          non-interactive in the editor (pointer-events-none) so taps select. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "block w-full cursor-pointer rounded-[5px] px-2 py-1.5 text-start",
          hidden && "opacity-40",
        )}
        style={{ backgroundColor: bg }}
      >
        <div className="pointer-events-none">
          <BlockView block={block} />
        </div>
      </div>

      {/* Dashed editing outline (SVG so we can match the 12/2 dash + marching) */}
      <svg
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        <rect
          x="0.75"
          y="0.75"
          width="calc(100% - 1.5px)"
          height="calc(100% - 1.5px)"
          rx="5"
          fill="none"
          stroke="#4488ff"
          strokeOpacity={selected ? 1 : 0.25}
          strokeWidth="1.5"
          strokeDasharray="12 2"
          className={selected ? "builder-dash-selected" : undefined}
        />
      </svg>

      {/* Hover/selected controls */}
      <div
        className={cn(
          "absolute -top-3 end-2 z-10 flex items-center gap-1 rounded-md border border-border bg-white px-1 py-0.5 shadow-sm transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <span
          {...attributes}
          {...listeners}
          // Explicit colour: the preview scope re-points text-muted-foreground to
          // the website font colour, which would make this editing-chrome icon
          // disappear (e.g. white-on-white).
          className="cursor-grab p-1 text-black/50 active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical className="size-4" />
        </span>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="p-1 text-error"
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Delete needs confirmation (mobile showDeleteBlockDialog). */}
      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={tc("delete")}
        message={t("deleteBlockConfirm")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
