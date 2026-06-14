"use client";

import { useState } from "react";
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
  ChevronsUpDown,
  Copy,
  Star,
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
import type { ReviewsBlock, ReviewItem, ReviewsLayoutType } from "@/lib/types/blocks";
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

const LAYOUTS: { value: ReviewsLayoutType; label: string; svg: string }[] = [
  { value: "cards", label: "Cards", svg: "/layouts/layout_swiper_card.svg" },
  { value: "list", label: "List", svg: "/layouts/layout_list.svg" },
  { value: "testimonial", label: "Testimonial", svg: "/layouts/layout_swiper.svg" },
];

const AMBER = "#FFC107";

/**
 * Complete Reviews block editor, mirroring the mobile ReviewsSettingsSheet:
 * Sort / Layout / Settings tabs, with a nested per-review editor (avatar, name,
 * star rating, text, relative time). Edits apply live via updateBlock.
 */
export function ReviewsBlockEditor({ block }: { block: ReviewsBlock }) {
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reviews = block.reviews ?? [];
  const setBlock = (patch: Partial<ReviewsBlock>) => updateBlock(block.id, patch);
  const setReviews = (next: ReviewItem[]) => setBlock({ reviews: next });
  const patchReview = (id: string, patch: Partial<ReviewItem>) =>
    setReviews(reviews.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const editing = reviews.find((r) => r.id === editingId) ?? null;

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: "Sort", Icon: ArrowUpDown },
    { value: "layout", label: "Layout", Icon: LayoutGrid },
    { value: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <SortTab
          reviews={reviews}
          onReorder={setReviews}
          onAdd={() => {
            const item: ReviewItem = {
              id: nanoid(),
              reviewer_name: "",
              rating: 5,
              text: "",
            };
            setReviews([...reviews, item]);
            setEditingId(item.id!);
          }}
          onEdit={(id) => setEditingId(id)}
          onToggleHide={(id, hidden) => patchReview(id, { hidden })}
          onDelete={(id) => setReviews(reviews.filter((r) => r.id !== id))}
        />
      )}

      {tab === "layout" && (
        <LayoutTab
          value={block.layout_type ?? "cards"}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          block={block}
          setBlock={setBlock}
          onDuplicate={() => addBlock({ ...block, id: nanoid() })}
        />
      )}

      {editing && (
        <ReviewItemEditor
          item={editing}
          onChange={(patch) => patchReview(editing.id!, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ─── Sort tab ─────────────────────────────────────────────────────────────────

function SortTab({
  reviews,
  onReorder,
  onAdd,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  reviews: ReviewItem[];
  onReorder: (next: ReviewItem[]) => void;
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
    const from = reviews.findIndex((r) => r.id === active.id);
    const to = reviews.findIndex((r) => r.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(reviews, from, to));
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-4" />
        Add review manually
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={reviews.map((r) => r.id!)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {reviews.map((item) => (
              <SortableReviewRow
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

function SortableReviewRow({
  item,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  item: ReviewItem;
  onEdit: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id! });
  const photo = item.reviewer_photo_url ? cdnUrl(item.reviewer_photo_url) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-16 items-center rounded-xl border border-primary/20 bg-surface",
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
      <span className="me-2.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/10">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-full object-cover" />
        ) : (
          <Star className="size-4 text-foreground/40" />
        )}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="me-1 flex h-full min-w-0 flex-1 flex-col justify-center text-start"
      >
        <span className="truncate text-sm font-semibold text-foreground">
          {item.reviewer_name || "Review"}
        </span>
        <MiniStars rating={item.rating ?? 0} />
        {item.text ? (
          <span className="truncate text-xs text-foreground/50">{item.text}</span>
        ) : null}
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

function MiniStars({ rating }: { rating: number }) {
  return (
    <span className="flex" style={{ color: AMBER }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className="size-3"
          fill={rating >= i + 1 ? AMBER : "none"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

// ─── Layout tab ───────────────────────────────────────────────────────────────

function LayoutTab({
  value,
  onChange,
}: {
  value: ReviewsLayoutType;
  onChange: (v: ReviewsLayoutType) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {LAYOUTS.map((l) => (
          <LayoutCard
            key={l.value}
            selected={value === l.value}
            label={l.label}
            onClick={() => onChange(l.value)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={l.svg}
              alt=""
              className="h-full w-full object-contain"
            />
          </LayoutCard>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Swipe to choose a layout
      </p>
    </div>
  );
}

function LayoutCard({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2.5 rounded-2xl border bg-surface p-3 transition-colors",
        selected ? "border-primary" : "border-transparent hover:border-border",
      )}
    >
      {selected && (
        <span className="absolute end-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-white">
          <Check className="size-3" />
        </span>
      )}
      <span className="flex h-14 w-full items-center px-1">{children}</span>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </button>
  );
}

// ─── Settings (general) tab ─────────────────────────────────────────────────────

function SettingsTab({
  block,
  setBlock,
  onDuplicate,
}: {
  block: ReviewsBlock;
  setBlock: (patch: Partial<ReviewsBlock>) => void;
  onDuplicate: () => void;
}) {
  const showAddReview = !!block.show_add_review_button;
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Title</label>
        <Input
          value={block.title ?? ""}
          placeholder="Reviews"
          onChange={(e) => setBlock({ title: e.target.value })}
        />
      </div>

      {/* Click URL */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Click URL</label>
        <Input
          dir="ltr"
          value={block.click_url ?? ""}
          placeholder="https://maps.google.com/..."
          onChange={(e) =>
            setBlock({ click_url: e.target.value === "" ? null : e.target.value })
          }
        />
      </div>

      <GroupedCard>
        <GroupedRow
          Icon={ChevronsUpDown}
          color="#5b5bd6"
          title="Dropdown"
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
          title="Duplicate"
          onClick={onDuplicate}
        />
        <ColorRow
          label="Background color"
          color={block.background_color ?? hexToArgbA("#ffffff")!}
          enabled={!!block.use_background_color}
          onColor={(c) => setBlock({ background_color: c })}
          onToggle={(v) => setBlock({ use_background_color: v })}
        />
        <GroupedRow
          Icon={Star}
          color="#d97706"
          title="Add review button"
          trailing={
            <ToggleSwitch
              checked={showAddReview}
              onChange={(v) => setBlock({ show_add_review_button: v })}
            />
          }
        />
      </GroupedCard>

      {showAddReview && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Add review URL
          </label>
          <Input
            dir="ltr"
            value={block.add_review_url ?? ""}
            placeholder="https://search.google.com/local/writereview?placeid=..."
            onChange={(e) =>
              setBlock({
                add_review_url: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Per-review editor (mirrors mobile ReviewEditorSheet) ─────────────────────

function ReviewItemEditor({
  item,
  onChange,
  onClose,
}: {
  item: ReviewItem;
  onChange: (patch: Partial<ReviewItem>) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Reviews" subtitle="Rating" onClose={onClose}>
      <div className="space-y-4">
        {/* Centered avatar uploader (round crop) */}
        <div className="flex justify-center">
          <div className="w-full max-w-[260px]">
            <ImageUploader
              path={item.reviewer_photo_url}
              onUploaded={(p) => onChange({ reviewer_photo_url: p })}
              onDelete={() => onChange({ reviewer_photo_url: null })}
              aspect={1}
              cropShape="round"
              rounded="rounded-full"
            />
          </div>
        </div>

        {/* Reviewer name */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <Input
            value={item.reviewer_name ?? ""}
            dir={dir(item.reviewer_name)}
            onChange={(e) => onChange({ reviewer_name: e.target.value })}
          />
        </div>

        {/* Rating row */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-input bg-surface px-4 py-3">
          <Star className="size-5" style={{ color: AMBER }} fill={AMBER} strokeWidth={0} />
          <span className="flex-1 text-sm font-medium text-foreground">Rating</span>
          <RatingPicker
            value={item.rating ?? 0}
            onChange={(v) => onChange({ rating: v })}
          />
        </div>

        {/* Review text */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Text</label>
          <textarea
            value={item.text ?? ""}
            dir={dir(item.text)}
            rows={4}
            onChange={(e) => onChange({ text: e.target.value })}
            className="w-full resize-none rounded-xl border border-input bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        {/* Relative time */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Time ago</label>
          <Input
            value={item.relative_time_description ?? ""}
            dir={dir(item.relative_time_description)}
            placeholder="2 weeks ago"
            onChange={(e) => onChange({ relative_time_description: e.target.value })}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-base font-semibold text-white"
        >
          <Check className="size-5" />
          Done
        </button>
      </div>
    </BottomSheet>
  );
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex" style={{ color: AMBER }}>
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        return (
          <button
            key={i}
            type="button"
            aria-label={`${starValue} stars`}
            onClick={() => onChange(starValue)}
            className="px-0.5"
          >
            <Star
              className="size-7"
              fill={value >= starValue ? AMBER : "none"}
              strokeWidth={value >= starValue ? 0 : 1.5}
            />
          </button>
        );
      })}
    </div>
  );
}

// Local RTL helper for inputs (mirrors dirOf without importing the view util).
const RTL = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
function dir(text?: string | null): "rtl" | "ltr" {
  return text && RTL.test(text) ? "rtl" : "ltr";
}
