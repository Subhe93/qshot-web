"use client";

import { useEffect, useRef, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Circle,
  Copy,
  ChevronsDownUp,
  Minus,
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
import { dirOf } from "@/lib/builder/text-direction";
import { cn } from "@/lib/utils";
import type { ProductsBlock, ProductItem, ProductsLayoutType } from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/builder/hero/CoverTab";

type Tab = "sort" | "layout" | "settings";

// Order matches the mobile ProductsSettingsSheet._buildLayout map / PageView.
// `svg` mirrors the mobile asset per layout_type (copied into public/layouts/).
const LAYOUTS: { type: ProductsLayoutType; label: string; svg: string }[] = [
  { type: "grid", label: "Grid", svg: "layout_grid.svg" },
  { type: "swiper", label: "Swiper", svg: "layout_swiper.svg" },
  { type: "swiper2", label: "Swiper 2", svg: "layout_swiper_r2.svg" },
  { type: "swiper3", label: "Large grid", svg: "layout_swiper_card.svg" },
  { type: "list", label: "List", svg: "layout_list.svg" },
  { type: "promo", label: "Promo", svg: "layout_swiper_card_large.svg" },
  { type: "shop", label: "Shop", svg: "layout_swiper_card.svg" },
  { type: "grid2", label: "Grid 2", svg: "layout_grid_align_center.svg" },
  { type: "banner", label: "Banner", svg: "layout_list.svg" },
];

/** Card layouts that expose show_arrow + circle_image (mirrors mobile cardLayout). */
const CARD_LAYOUTS: ProductsLayoutType[] = ["list", "swiper", "swiper2", "promo"];

/**
 * Products block editor, mirroring the mobile ProductsSettingsSheet:
 * Sort (reorder/add/hide/delete items) / Layout (swipeable layout picker) /
 * Settings (title, foldable, show arrow + circle image for card layouts,
 * duplicate, background color). A nested per-item editor handles image, url,
 * title, description, currency and price (+ discount).
 */
export function ProductsBlockEditor({ block }: { block: ProductsBlock }) {
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = block.items ?? [];
  const setBlock = (patch: Partial<ProductsBlock>) => updateBlock(block.id, patch);
  const setItems = (next: ProductItem[]) => setBlock({ items: next });
  const patchItem = (id: string, patch: Partial<ProductItem>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const editing = items.find((it) => it.id === editingId) ?? null;
  const layout = block.layout_type;
  const isCard = CARD_LAYOUTS.includes(layout);

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: "Sort", Icon: ArrowUpDown },
    { value: "layout", label: "Layout", Icon: LayoutGrid },
    { value: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  function addItem() {
    const item: ProductItem = { id: nanoid(), title: "Product", url: "", currency: "USD" };
    setItems([...items, item]);
    setEditingId(item.id!);
  }

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <SortTab
          items={items}
          onReorder={setItems}
          onAdd={addItem}
          onEdit={(id) => setEditingId(id)}
          onToggleHide={(id, hidden) => patchItem(id, { hidden })}
          onDelete={(id) => setItems(items.filter((it) => it.id !== id))}
        />
      )}

      {tab === "layout" && (
        <LayoutCarousel
          value={layout}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Title</label>
            <Input
              dir={dirOf(block.title)}
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
            {isCard && (
              <GroupedRow
                Icon={ArrowRight}
                color="#3f51b5"
                title="Show arrow"
                trailing={
                  <ToggleSwitch
                    checked={!!block.show_arrow}
                    onChange={(v) => setBlock({ show_arrow: v })}
                  />
                }
              />
            )}
            {isCard && (
              <GroupedRow
                Icon={Circle}
                color="#ec407a"
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
              color="#673ab7"
              title="Duplicate"
              onClick={() => addBlock({ ...block, id: nanoid() })}
            />
            <ColorRow
              label="Background color"
              color={block.background_color ?? hexToArgbA("#000000")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
          </GroupedCard>
        </div>
      )}

      {editing && (
        <ProductItemEditor
          item={editing}
          onChange={(patch) => patchItem(editing.id!, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ─── Sort tab ────────────────────────────────────────────────────────────────

function SortTab({
  items,
  onReorder,
  onAdd,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  items: ProductItem[];
  onReorder: (next: ProductItem[]) => void;
  onAdd: () => void;
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
    <div className="space-y-2">
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-4" />
        Add product
      </button>

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
    </div>
  );
}

function SortRow({
  item,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  item: ProductItem;
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
      <span className="me-2.5 size-9 shrink-0 overflow-hidden rounded-md bg-foreground/5">
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnUrl(item.thumbnail_url)} alt="" className="size-full object-cover" />
        ) : null}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="me-1 flex h-full flex-1 items-center truncate text-start text-sm font-semibold text-foreground"
      >
        {item.title || "Product"}
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

// ─── Layout carousel (mirrors mobile swipeable PageView) ─────────────────────

function LayoutCarousel({
  value,
  onChange,
}: {
  value: ProductsLayoutType;
  onChange: (v: ProductsLayoutType) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, LAYOUTS.findIndex((l) => l.type === value));

  useEffect(() => {
    const slide = scrollRef.current?.children[selectedIndex] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedIndex]);

  const go = (index: number) => {
    const i = Math.min(LAYOUTS.length - 1, Math.max(0, index));
    onChange(LAYOUTS[i].type);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <ArrowButton dir="prev" disabled={selectedIndex === 0} onClick={() => go(selectedIndex - 1)} />
        <div
          ref={scrollRef}
          className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
                <div className="flex h-32 w-full items-center justify-center rounded-xl bg-muted px-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/layouts/${l.svg}`}
                    alt=""
                    className="h-full w-full object-contain"
                  />
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

      <p className="text-center text-xs text-muted-foreground">Swipe through layouts</p>

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

// ─── Per-item editor ──────────────────────────────────────────────────────────

function ProductItemEditor({
  item,
  onChange,
  onClose,
}: {
  item: ProductItem;
  onChange: (patch: Partial<ProductItem>) => void;
  onClose: () => void;
}) {
  const hasDiscount = item.price_after_discount != null;

  return (
    <BottomSheet title="Product" subtitle="Edit" onClose={onClose}>
      <div className="space-y-4">
        {/* Image */}
        <ImageUploader
          path={item.thumbnail_url}
          aspect={1}
          cropShape="rect"
          rounded="rounded-xl"
          onUploaded={(p) => onChange({ thumbnail_url: p })}
          onDelete={() => onChange({ thumbnail_url: null })}
        />

        {/* URL */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">URL</label>
          <Input
            dir="ltr"
            value={item.url ?? ""}
            placeholder="https://…"
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </div>

        {/* Title (required) */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Title</label>
          <Input
            dir={dirOf(item.title)}
            value={item.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>

        {/* Description (optional) */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Description (optional)
          </label>
          <textarea
            dir={dirOf(item.description)}
            value={item.description ?? ""}
            rows={2}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Currency */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Currency</label>
          <Input
            value={item.currency ?? ""}
            placeholder="USD"
            onChange={(e) => onChange({ currency: e.target.value })}
          />
        </div>

        {/* Price (optional) + add discount */}
        <div>
          <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Price (optional)</span>
            {!hasDiscount && (
              <button
                type="button"
                onClick={() => onChange({ price_after_discount: "" })}
                className="inline-flex items-center gap-1 rounded-lg bg-foreground/[0.06] px-2 py-1 text-[11px] font-semibold text-foreground"
              >
                <Plus className="size-3" />
                Add discount
              </button>
            )}
          </label>
          <Input
            dir="ltr"
            inputMode="decimal"
            value={item.price ?? ""}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </div>

        {/* Discounted price (conditional) */}
        {hasDiscount && (
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Price after discount</span>
              <button
                type="button"
                onClick={() => onChange({ price_after_discount: null })}
                className="inline-flex items-center gap-1 rounded-lg bg-error/10 px-2 py-1 text-[11px] font-semibold text-error"
              >
                <Minus className="size-3" />
                Remove discount
              </button>
            </label>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={item.price_after_discount ?? ""}
              onChange={(e) => onChange({ price_after_discount: e.target.value })}
            />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
