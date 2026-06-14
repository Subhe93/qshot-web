"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowUpDown,
  LayoutGrid,
  Settings as SettingsIcon,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  Check,
  Copy,
  ArrowRight,
  Circle,
  ChevronsDownUp,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
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
import { hexToArgbA } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import type {
  ExternalLinksBlock,
  ExternalLinkItem,
  ExternalLinksLayoutType,
} from "@/lib/types/blocks";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/builder/hero/CoverTab";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";

type Tab = "sort" | "layout" | "settings";

// The six layout variants, in mobile enum order, each mapped to the real
// mobile layout-illustration SVG (copied into public/layouts/), matching the
// mobile ExternalLinksSettingsSheet layout picker exactly.
const LAYOUTS: {
  type: ExternalLinksLayoutType;
  label: string;
  svg: string;
}[] = [
  { type: "largeGrid", label: "Large grid", svg: "layout_swiper_card.svg" },
  { type: "list", label: "List", svg: "layout_list.svg" },
  { type: "swiper", label: "Swiper", svg: "layout_swiper.svg" },
  { type: "swiper2", label: "Swiper 2", svg: "layout_swiper_r2.svg" },
  { type: "grid", label: "Grid", svg: "layout_grid.svg" },
  { type: "promo", label: "Promo", svg: "layout_swiper_card_large.svg" },
];

/**
 * Complete External-links block editor, mirroring the mobile
 * ExternalLinksSettingsSheet: Sort / Layout / Settings tabs, plus a per-item
 * editor sheet (image + url + title + description). Edits apply live.
 */
export function ExternalLinksBlockEditor({ block }: { block: ExternalLinksBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");
  const [editingId, setEditingId] = useState<string | null>(null);

  const links = block.links ?? [];
  const setBlock = (patch: Partial<ExternalLinksBlock>) => updateBlock(block.id, patch);
  const setLinks = (next: ExternalLinkItem[]) => setBlock({ links: next });
  const patchLink = (id: string, patch: Partial<ExternalLinkItem>) =>
    setLinks(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const editing = links.find((l) => l.id === editingId) ?? null;

  // show_arrow / circle_image only apply to the card-style layouts.
  const layout = block.layout_type ?? "list";
  const cardLayout =
    layout === "list" ||
    layout === "swiper" ||
    layout === "swiper2" ||
    layout === "promo";

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: t("tabs.sort"), Icon: ArrowUpDown },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  function addLink() {
    const item: ExternalLinkItem = { id: nanoid(), title: "", url: "", description: "" };
    setLinks([...links, item]);
    setEditingId(item.id!);
  }

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <SortTab
          links={links}
          onReorder={setLinks}
          onAdd={addLink}
          onEdit={(id) => setEditingId(id)}
          onToggleHide={(id, hidden) => patchLink(id, { hidden })}
          onDelete={(id) => setLinks(links.filter((l) => l.id !== id))}
          addLabel={t("fields.addLink")}
          fallbackLabel="Link"
        />
      )}

      {tab === "layout" && (
        <LayoutTab
          value={layout}
          onChange={(v) => setBlock({ layout_type: v })}
          hint={t("swipeLayouts")}
        />
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("fields.title")}
            </label>
            <Input
              value={block.title ?? ""}
              onChange={(e) => setBlock({ title: e.target.value })}
            />
          </div>

          <GroupedCard>
            <GroupedRow
              Icon={ChevronsDownUp}
              color="var(--primary)"
              title="Dropdown"
              trailing={
                <ToggleSwitch
                  checked={!!block.foldable}
                  onChange={(v) => setBlock({ foldable: v })}
                />
              }
            />
            {cardLayout && (
              <GroupedRow
                Icon={ArrowRight}
                color="#5b5bd6"
                title={t("fields.showArrow")}
                trailing={
                  <ToggleSwitch
                    checked={!!block.show_arrow}
                    onChange={(v) => setBlock({ show_arrow: v })}
                  />
                }
              />
            )}
            {cardLayout && (
              <GroupedRow
                Icon={Circle}
                color="#ec4899"
                title="Circle image"
                trailing={
                  <ToggleSwitch
                    checked={!!block.circle_image}
                    onChange={(v) => setBlock({ circle_image: v })}
                  />
                }
              />
            )}
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
        <ExternalLinkItemEditor
          item={editing}
          onChange={(patch) => patchLink(editing.id!, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ---- Sort tab ----

function SortTab({
  links,
  onReorder,
  onAdd,
  onEdit,
  onToggleHide,
  onDelete,
  addLabel,
  fallbackLabel,
}: {
  links: ExternalLinkItem[];
  onReorder: (next: ExternalLinkItem[]) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
  addLabel: string;
  fallbackLabel: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = links.findIndex((l) => l.id === active.id);
    const to = links.findIndex((l) => l.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(links, from, to));
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-4" />
        {addLabel}
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={links.map((l) => l.id!)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {links.map((item) => (
              <SortRow
                key={item.id}
                item={item}
                fallbackLabel={fallbackLabel}
                onEdit={() => onEdit(item.id!)}
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
  fallbackLabel,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  item: ExternalLinkItem;
  fallbackLabel: string;
  onEdit: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id! });

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
      <span className="me-2.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/5">
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnUrl(item.thumbnail_url)} alt="" className="size-full object-cover" />
        ) : (
          <LinkIcon className="size-4 text-foreground/30" />
        )}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="me-1 flex h-full flex-1 items-center truncate text-start text-sm font-semibold text-foreground"
      >
        {item.title || fallbackLabel}
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" />
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

// ---- Layout tab (mirrors the mobile swipeable PageView of layout cards) ----

function LayoutTab({
  value,
  onChange,
  hint,
}: {
  value: ExternalLinksLayoutType;
  onChange: (v: ExternalLinksLayoutType) => void;
  hint: string;
}) {
  const selectedIndex = Math.max(0, LAYOUTS.findIndex((l) => l.type === value));
  const go = (i: number) => {
    const clamped = Math.min(LAYOUTS.length - 1, Math.max(0, i));
    onChange(LAYOUTS[clamped].type);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <ArrowButton dir="prev" disabled={selectedIndex === 0} onClick={() => go(selectedIndex - 1)} />
        <div className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LAYOUTS.map((l) => {
            const selected = l.type === value;
            return (
              <button
                key={l.type}
                type="button"
                onClick={() => onChange(l.type)}
                className={cn(
                  "relative flex w-full shrink-0 snap-center flex-col items-center gap-3 rounded-2xl border p-3 transition-colors",
                  selected ? "border-primary bg-primary/[0.04]" : "border-transparent",
                )}
              >
                {selected && (
                  <span className="absolute end-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex h-32 w-full items-center justify-center rounded-xl bg-muted">
                  <div className="flex h-24 w-full items-center justify-center px-4 drop-shadow-[0_4px_18px_rgba(0,0,0,0.15)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/layouts/${l.svg}`}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">{l.label}</span>
              </button>
            );
          })}
        </div>
        <ArrowButton
          dir="next"
          disabled={selectedIndex === LAYOUTS.length - 1}
          onClick={() => go(selectedIndex + 1)}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">{hint}</p>

      <div className="flex justify-center gap-1.5">
        {LAYOUTS.map((l, i) => (
          <button
            key={l.type}
            type="button"
            aria-label={l.label}
            onClick={() => onChange(l.type)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selectedIndex ? "w-3.5 bg-primary" : "w-1.5 bg-primary/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity hover:bg-muted disabled:opacity-30"
    >
      {dir === "prev" ? (
        <ChevronLeft className="size-5 rtl:rotate-180" />
      ) : (
        <ChevronRight className="size-5 rtl:rotate-180" />
      )}
    </button>
  );
}

// ---- Per-item editor sheet (image + url + title + description) ----

function ExternalLinkItemEditor({
  item,
  onChange,
  onClose,
}: {
  item: ExternalLinkItem;
  onChange: (patch: Partial<ExternalLinkItem>) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");

  return (
    <BottomSheet
      title="External link"
      subtitle={t("fields.url")}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Image picker — centered, square, rounded 12 (mobile 90x90). */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-[90px]">
            <ImageUploader
              path={item.thumbnail_url ?? undefined}
              onUploaded={(p) => onChange({ thumbnail_url: p })}
              onDelete={() => onChange({ thumbnail_url: undefined })}
              aspect={1}
              cropShape="rect"
              rounded="rounded-xl"
            />
          </div>
        </div>

        {/* URL */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {t("fields.url")}
          </label>
          <Input
            dir="ltr"
            value={item.url ?? ""}
            placeholder="https://…"
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </div>

        {/* Title — required in mobile */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {t("fields.title")}
          </label>
          <Input
            value={item.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>

        {/* Description — optional */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Description
          </label>
          <Input
            value={item.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
