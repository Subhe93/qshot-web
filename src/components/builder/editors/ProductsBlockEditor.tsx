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
import { LayoutPicker } from "./LayoutPicker";

type Tab = "sort" | "layout" | "settings";

// Order matches the mobile ProductsSettingsSheet._buildLayout map / PageView.
// `svg` mirrors the mobile asset per layout_type (copied into public/layouts/).
const LAYOUTS: { type: ProductsLayoutType; labelKey: string; svg: string }[] = [
  { type: "grid", labelKey: "layoutGrid", svg: "layout_grid.svg" },
  { type: "swiper", labelKey: "products.layoutSwiper", svg: "layout_swiper.svg" },
  { type: "swiper2", labelKey: "products.layoutSwiper2", svg: "layout_swiper_r2.svg" },
  { type: "swiper3", labelKey: "products.layoutLargeGrid", svg: "layout_swiper_card.svg" },
  { type: "list", labelKey: "layoutList", svg: "layout_list.svg" },
  { type: "promo", labelKey: "products.layoutPromo", svg: "layout_swiper_card_large.svg" },
  { type: "shop", labelKey: "products.layoutShop", svg: "layout_swiper_card.svg" },
  { type: "grid2", labelKey: "products.layoutGrid2", svg: "layout_grid_align_center.svg" },
  { type: "banner", labelKey: "products.layoutBanner", svg: "layout_list.svg" },
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
  const t = useTranslations("builder");
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
    { value: "sort", label: t("tabs.sort"), Icon: ArrowUpDown },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  function addItem() {
    const item: ProductItem = {
      id: nanoid(),
      title: t("products.defaultTitle"),
      url: "",
      currency: "USD",
    };
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
        <LayoutPicker
          options={LAYOUTS.map((l) => ({ ...l, label: t(l.labelKey) }))}
          value={layout}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("fields.title")}
            </label>
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
              title={t("products.dropdown")}
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
                title={t("fields.showArrow")}
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
                title={t("products.circleImage")}
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
              title={t("fields.duplicate")}
              onClick={() => addBlock({ ...block, id: nanoid() })}
            />
            <ColorRow
              label={t("products.backgroundColor")}
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
  const t = useTranslations("builder");
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
        {t("products.addProduct")}
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
  const t = useTranslations("builder");
  const tc = useTranslations("common");
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
        aria-label={t("fields.drag")}
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
        {item.title || t("products.defaultTitle")}
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={tc("edit")}
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>
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
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const hasDiscount = item.price_after_discount != null;

  return (
    <BottomSheet title={t("products.defaultTitle")} subtitle={tc("edit")} onClose={onClose}>
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
          <label className="mb-1 block text-xs text-muted-foreground">{t("fields.url")}</label>
          <Input
            dir="ltr"
            value={item.url ?? ""}
            placeholder="https://…"
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </div>

        {/* Title (required) */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("fields.title")}</label>
          <Input
            dir={dirOf(item.title)}
            value={item.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>

        {/* Description (optional) */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {t("products.descriptionOptional")}
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
          <label className="mb-1 block text-xs text-muted-foreground">
            {t("products.currency")}
          </label>
          <Input
            value={item.currency ?? ""}
            placeholder="USD"
            onChange={(e) => onChange({ currency: e.target.value })}
          />
        </div>

        {/* Price (optional) + add discount */}
        <div>
          <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("products.priceOptional")}</span>
            {!hasDiscount && (
              <button
                type="button"
                onClick={() => onChange({ price_after_discount: "" })}
                className="inline-flex items-center gap-1 rounded-lg bg-foreground/[0.06] px-2 py-1 text-[11px] font-semibold text-foreground"
              >
                <Plus className="size-3" />
                {t("products.addDiscount")}
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
              <span>{t("products.priceAfterDiscount")}</span>
              <button
                type="button"
                onClick={() => onChange({ price_after_discount: null })}
                className="inline-flex items-center gap-1 rounded-lg bg-error/10 px-2 py-1 text-[11px] font-semibold text-error"
              >
                <Minus className="size-3" />
                {t("products.removeDiscount")}
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
