"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowUpDown,
  LayoutGrid,
  Settings as SettingsIcon,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  ChevronRight as ChevronForward,
  ChevronsDownUp,
  Play,
  Copy,
  ImageOff,
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
import { hexToArgbA } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";
import { cn } from "@/lib/utils";
import type {
  VideoLinkItem,
  VideoLinksBlock,
  VideoLinksLayoutType,
} from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";
import { LayoutPicker } from "./LayoutPicker";
import { BottomSheet } from "@/components/ui/bottom-sheet";

type Tab = "sort" | "layout" | "settings";

// Mirrors VideoUtils.regex / getYoutubeThumbnail in the mobile app.
const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|watch\?list=|c\/[^/]+\/v\/|user\/[^/]+\/v\/)?([A-Za-z0-9_-]{11})(?:.+)?$/;

function youtubeThumbnail(url: string | undefined): string | null {
  if (!url) return null;
  const id = YT_REGEX.exec(url)?.[1];
  return id ? `https://img.youtube.com/vi/${id}/0.jpg` : null;
}

const LAYOUTS: { type: VideoLinksLayoutType; label: string; svg: string }[] = [
  { type: "list", label: "List", svg: "/layouts/video_layout_list.svg" },
  { type: "swiper", label: "Swiper", svg: "/layouts/video_layout_swiper.svg" },
  { type: "grid", label: "Grid", svg: "/layouts/video_layout_grid.svg" },
];

/**
 * VideoLinks block editor, mirroring the mobile VideoLinksSettingsSheet:
 * Sort / Layout / Settings tabs, with a nested per-item URL editor.
 */
export function VideoLinksBlockEditor({ block }: { block: VideoLinksBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = block.items ?? [];
  const setBlock = (patch: Partial<VideoLinksBlock>) =>
    updateBlock(block.id, patch);
  const setItems = (next: VideoLinkItem[]) => setBlock({ items: next });
  const patchItem = (id: string, patch: Partial<VideoLinkItem>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const editing = items.find((it) => it.id === editingId) ?? null;

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: t("tabs.sort"), Icon: ArrowUpDown },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              const item: VideoLinkItem = { id: nanoid(), url: "", hidden: false };
              setItems([...items, item]);
              setEditingId(item.id!);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <Plus className="size-4" />
            {t("fields.addLink")}
          </button>
          <SortList
            items={items}
            onReorder={setItems}
            onEdit={(id) => setEditingId(id)}
            onToggleHide={(id, hidden) => patchItem(id, { hidden })}
            onDelete={(id) => setItems(items.filter((it) => it.id !== id))}
          />
        </div>
      )}

      {tab === "layout" && (
        <LayoutPicker
          options={LAYOUTS.map((l) => ({
            type: l.type,
            label: l.label,
            svg: l.svg.replace("/layouts/", ""),
          }))}
          value={block.layout_type ?? "list"}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("fields.title")}
            </label>
            <input
              type="text"
              dir={dirOf(block.title)}
              value={block.title ?? ""}
              onChange={(e) => setBlock({ title: e.target.value })}
              placeholder={t("fields.title")}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
            />
          </div>

          <GroupedCard>
            {/* mobile order: dropdown (foldable), duplicate, background color */}
            <GroupedRow
              Icon={ChevronsDownUp}
              color="var(--primary)"
              title={t("dropdown")}
              trailing={
                <ToggleSwitch
                  checked={!!block.foldable}
                  onChange={(v) => setBlock({ foldable: v })}
                />
              }
            />
            <GroupedRow
              Icon={Copy}
              color="#7c3aed"
              title={t("fields.duplicate")}
              onClick={() => addBlock({ ...block, id: nanoid() })}
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
      )}

      {editing && (
        <VideoItemEditor
          item={editing}
          title={t("fields.link")}
          onChange={(patch) => patchItem(editing.id!, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ---- Sort list ----

function SortList({
  items,
  onReorder,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  items: VideoLinkItem[];
  onReorder: (next: VideoLinkItem[]) => void;
  onEdit: (id: string) => void;
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((it) => it.id!)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortRow
              key={item.id}
              item={item}
              onEdit={() => onEdit(item.id!)}
              onToggleHide={() => onToggleHide(item.id!, !item.hidden)}
              onDelete={() => onDelete(item.id!)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortRow({
  item,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  item: VideoLinkItem;
  onEdit: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id! });
  const thumb = youtubeThumbnail(item.url);

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
        aria-label="Drag"
      >
        <GripVertical className="size-5" />
      </span>
      {/* 16:9 thumbnail, height 40, rounded 8, dark border. */}
      <button
        type="button"
        onClick={onEdit}
        className="me-2 flex h-10 items-center"
        aria-label="Edit"
      >
        <span
          className="relative block h-10 overflow-hidden rounded-lg"
          style={{ width: 40 * (16 / 9), border: "1px solid rgba(0,0,0,0.22)", backgroundColor: "rgba(255,255,255,0.15)" }}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-foreground/30">
              <ImageOff className="size-4" />
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="flex h-full flex-1 items-center text-muted-foreground hover:text-foreground"
      >
        <ChevronForward className="size-3.5 rtl:rotate-180" />
      </button>
      <button
        type="button"
        onClick={onToggleHide}
        aria-label="Toggle visibility"
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {item.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="me-1.5 flex size-8 items-center justify-center text-error"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// ---- Per-item URL editor (mirrors VideoLinkEditorSheet) ----

function VideoItemEditor({
  item,
  title,
  onChange,
  onClose,
}: {
  item: VideoLinkItem;
  title: string;
  onChange: (patch: Partial<VideoLinkItem>) => void;
  onClose: () => void;
}) {
  const url = item.url ?? "";
  const thumb = youtubeThumbnail(url);
  const invalid = url.trim().length > 0 && !YT_REGEX.test(url.trim());

  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="space-y-4">
        {/* Preview of the resolved thumbnail. */}
        <div
          className="relative aspect-video w-full overflow-hidden rounded-lg"
          style={{ border: "1px solid rgba(0,0,0,0.22)", backgroundColor: "rgba(255,255,255,0.1)" }}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-foreground/25">
              <ImageOff className="size-7" />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-white/20">
              <Play className="size-5 fill-white text-white" />
            </span>
          </span>
        </div>

        <input
          type="url"
          dir="ltr"
          value={url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://youtube.com/..."
          className={cn(
            "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none",
            invalid ? "border-error focus:border-error" : "border-border focus:border-primary",
          )}
        />
        {invalid && (
          <p className="px-1 text-xs text-error">Invalid YouTube link</p>
        )}
      </div>
    </BottomSheet>
  );
}
