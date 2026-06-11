"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { Block } from "@/lib/types/blocks";
import { BlockView } from "./preview/BlockView";
import { argbToCss } from "@/lib/builder/color";
import { cn } from "@/lib/utils";

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

  const bg =
    "useBackgroundColor" in block && block.useBackgroundColor
      ? argbToCss(block.backgroundColor)
      : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative rounded-lg",
        isDragging && "z-10 opacity-80",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full rounded-lg border-2 px-3 py-2 text-start transition-colors",
          selected
            ? "border-primary"
            : "border-transparent hover:border-border",
        )}
        style={{ backgroundColor: bg }}
      >
        <BlockView block={block} />
      </button>

      {/* Controls */}
      <div
        className={cn(
          "absolute -top-3 end-2 flex items-center gap-1 rounded-md border border-border bg-white px-1 py-0.5 shadow-sm transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical className="size-4" />
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-error"
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
