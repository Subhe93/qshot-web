"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowUpDown,
  LayoutGrid,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  Copy,
  ImagePlus,
} from "lucide-react";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "@/stores/editor-store";
import { cdnUrl } from "@/lib/api/qrcodes";
import { uploadImage } from "@/lib/api/media";
import { hexToArgbA } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import type {
  ImagesBlock,
  ImageItem,
  ImagesLayoutType,
} from "@/lib/types/blocks";
import { ImageUploader } from "@/components/builder/hero/CoverTab";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  type SheetTab,
} from "./sheet-kit";
import { LayoutPicker } from "./LayoutPicker";

type Tab = "sort" | "layout" | "settings";

/**
 * Layout metadata mirroring the mobile `ImagesBlockLayoutType` enum + the layout
 * picker labels in images_settings_sheet.dart. `aspect` is the per-card
 * cardAspectRatio used by the crop step; `null` for singleSizable.
 */
const LAYOUTS: ReadonlyArray<{
  type: ImagesLayoutType;
  label: string;
  aspect: number | null;
  svg: string;
}> = [
  { type: "cards", label: "Square Large 1:1", aspect: 1, svg: "layout_swiper_card_large.svg" },
  { type: "carousel", label: "Square Small 1:1", aspect: 1, svg: "image_layout_carousel.svg" },
  { type: "shorts", label: "Vertical 9:16", aspect: 9 / 16, svg: "image_layout_shorts.svg" },
  { type: "swiper", label: "Horizontal 16:9", aspect: 16 / 9, svg: "image_layout_swiper_16_9.svg" },
  {
    type: "singleSizable",
    label: "Single resizable image",
    aspect: null,
    svg: "image_layout_swiper_sizable.svg",
  },
];

/**
 * Image block editor, mirroring the mobile ImagesSettingsSheet:
 * Sort (add/reorder/hide/replace/delete images) / Layout (swipe picker of the
 * five layout types) / Settings (duplicate + background color).
 */
export function ImagesBlockEditor({ block }: { block: ImagesBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");

  const items = block.items ?? [];
  const setBlock = (patch: Partial<ImagesBlock>) => updateBlock(block.id, patch);
  const setItems = (next: ImageItem[]) => setBlock({ items: next });

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: t("tabs.sort"), Icon: ArrowUpDown },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <SortTab
          items={items}
          onAdd={(url) =>
            setItems([...items, { id: nanoid(), url, hidden: false }])
          }
          onReplace={(id, url) =>
            setItems(items.map((it) => (it.id === id ? { ...it, url } : it)))
          }
          onReorder={setItems}
          onToggleHide={(id, hidden) =>
            setItems(items.map((it) => (it.id === id ? { ...it, hidden } : it)))
          }
          onDelete={(id) => setItems(items.filter((it) => it.id !== id))}
        />
      )}

      {tab === "layout" && (
        <LayoutPicker
          options={LAYOUTS.map((l) => ({
            type: l.type,
            label: t(`imageLayouts.${l.type}`),
            svg: l.svg,
          }))}
          value={block.layout_type ?? "cards"}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "settings" && (
        <GroupedCard>
          <ColorRow
            label={t("fields.background")}
            color={block.background_color ?? hexToArgbA("#000000")!}
            enabled={!!block.use_background_color}
            onColor={(c) => setBlock({ background_color: c })}
            onToggle={(v) => setBlock({ use_background_color: v })}
          />
          <GroupedRow
            Icon={Copy}
            color="#7c3aed"
            title={t("fields.duplicate")}
            onClick={() => addBlock({ ...block, id: nanoid() })}
          />
        </GroupedCard>
      )}
    </div>
  );
}

// ---- Sort tab ----

function SortTab({
  items,
  onAdd,
  onReplace,
  onReorder,
  onToggleHide,
  onDelete,
}: {
  items: ImageItem[];
  onAdd: (url: string) => void;
  onReplace: (id: string, url: string) => void;
  onReorder: (next: ImageItem[]) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((it) => it.id === active.id);
    const to = items.findIndex((it) => it.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to));
  }

  return (
    <div className="space-y-2">
      {/* Add image (mobile: pickMultiImage → crop → upload). The web uploader
          crops + uploads a single image; appended to the list. */}
      <ImageUploader
        path={undefined}
        onUploaded={onAdd}
        onDelete={() => {}}
        aspect={16 / 9}
        rounded="rounded-xl"
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((it) => it.id!)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortRow
                key={item.id}
                item={item}
                onReplace={(url) => onReplace(item.id!, url)}
                onToggleHide={() => onToggleHide(item.id!, !item.hidden)}
                onDelete={() => onDelete(item.id!)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortRow({
  item,
  onReplace,
  onToggleHide,
  onDelete,
}: {
  item: ImageItem;
  onReplace: (url: string) => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id! });
  const [busy, setBusy] = useState(false);

  async function onPickReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      if (url) onReplace(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-14 items-center rounded-xl border border-primary/20 bg-surface",
        item.hidden && "opacity-50",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="flex h-full cursor-grab items-center px-2.5 text-primary active:cursor-grabbing"
        aria-label={t("fields.drag")}
      >
        <GripVertical className="size-5" />
      </span>

      {/* 16:9 thumbnail (mobile sort item), tap to replace */}
      <label
        className="relative me-2.5 flex h-10 w-[71px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg"
        style={{
          border: "1px solid rgba(0,0,0,0.38)",
          backgroundColor: "rgba(255,255,255,0.2)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cdnUrl(item.url)} alt="" className="size-full object-cover" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-semibold text-white">
            …
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onPickReplace} />
      </label>

      <label className="flex flex-1 cursor-pointer items-center text-sm font-medium text-muted-foreground">
        <ImagePlus className="me-1.5 size-4" />
        {t("fields.replace")}
        <input type="file" accept="image/*" className="hidden" onChange={onPickReplace} />
      </label>

      <button
        type="button"
        onClick={onToggleHide}
        aria-label={t("fields.toggleVisibility")}
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {item.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={tc("delete")}
        className="me-1.5 flex size-8 items-center justify-center text-error"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

