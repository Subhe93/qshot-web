"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/stores/editor-store";
import { Hero } from "./preview/Hero";
import { SortableBlock } from "./SortableBlock";

export function BuilderCanvas() {
  const t = useTranslations("builder");
  const blocks = useEditorStore((s) => s.blocks);
  const settings = useEditorStore((s) => s.settings);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const moveBlock = useEditorStore((s) => s.moveBlock);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    if (from !== -1 && to !== -1) moveBlock(from, to);
  }

  return (
    <div className="flex justify-center py-6">
      {/* Phone frame */}
      <div
        className="w-[390px] overflow-hidden rounded-[2rem] border-8 border-black bg-white shadow-xl"
        onClick={() => select(null)}
      >
        <div className="max-h-[78vh] overflow-y-auto">
          <Hero settings={settings} />

          <div
            className="flex flex-col gap-2 px-4 pb-10 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((b) => (
                  <SortableBlock
                    key={b.id}
                    block={b}
                    selected={selectedId === b.id}
                    onSelect={() => select(b.id)}
                    onDelete={() => removeBlock(b.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {blocks.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("emptyCanvas")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
