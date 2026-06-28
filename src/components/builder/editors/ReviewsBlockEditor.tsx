"use client";

import { useEffect, useState } from "react";
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
  ChevronsUpDown,
  Copy,
  Star,
  Lock,
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
import { LayoutPicker } from "./LayoutPicker";
import { GoogleReviewsImportSheet } from "./GoogleReviewsImportSheet";
import type { GooglePlaceDetails } from "@/lib/api/google-places";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/** Small Google "G" mark for the fetch button. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.8 38 46.5 31.8 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.5 28.3a14.5 14.5 0 0 1 0-8.6l-7.9-6.1a24 24 0 0 0 0 20.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.3-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.4 0-11.7-3.7-13.5-8.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function cooldownLabel(remainingMs: number): string {
  const days = Math.floor(remainingMs / 86_400_000);
  const hours = Math.floor(remainingMs / 3_600_000) % 24;
  return days > 0 ? `${days}d` : `${hours}h`;
}

type Tab = "sort" | "layout" | "settings";

const LAYOUTS: { value: ReviewsLayoutType; labelKey: string; svg: string }[] = [
  { value: "cards", labelKey: "reviews.layoutCards", svg: "/layouts/layout_swiper_card.svg" },
  { value: "list", labelKey: "reviews.layoutList", svg: "/layouts/layout_list.svg" },
  { value: "testimonial", labelKey: "reviews.layoutTestimonial", svg: "/layouts/layout_swiper.svg" },
];

const AMBER = "#FFC107";

/**
 * Complete Reviews block editor, mirroring the mobile ReviewsSettingsSheet:
 * Sort / Layout / Settings tabs, with a nested per-review editor (avatar, name,
 * star rating, text, relative time). Edits apply live via updateBlock.
 */
export function ReviewsBlockEditor({ block }: { block: ReviewsBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const reviews = block.reviews ?? [];
  const setBlock = (patch: Partial<ReviewsBlock>) => updateBlock(block.id, patch);
  const setReviews = (next: ReviewItem[]) => setBlock({ reviews: next });
  const patchReview = (id: string, patch: Partial<ReviewItem>) =>
    setReviews(reviews.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const editing = reviews.find((r) => r.id === editingId) ?? null;

  // ── Google fetch cooldown (mobile: 5 days since last fetch) ──
  // `now` is read off the render path (deferred in an effect) to keep render
  // pure; defaults to allowing a fetch until measured (server enforces anyway).
  const lastFetched = block.google_last_fetched_at ?? null;
  const [remainingMs, setRemainingMs] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setRemainingMs(
        lastFetched ? Math.max(0, FIVE_DAYS_MS - (Date.now() - lastFetched)) : 0,
      );
    }, 0);
    return () => clearTimeout(t);
  }, [lastFetched]);
  const canFetch = remainingMs === 0;

  // Merge fetched Google reviews into the block (port of computeDiff +
  // applyGoogleFetch from reviews_settings_cubit.dart).
  function importGoogleReviews(details: GooglePlaceDetails) {
    const placeId = details.place_id;
    const placeUrl = details.url ?? "";
    const next = [...reviews];
    for (const rv of details.reviews ?? []) {
      const key = `${rv.author_name ?? ""}_${rv.time ?? ""}`;
      const idx = next.findIndex((r) => r.google_review_key === key);
      const candidate: ReviewItem = {
        id: idx !== -1 ? next[idx].id : nanoid(),
        reviewer_name: rv.author_name ?? "",
        reviewer_photo_url: rv.profile_photo_url ?? null,
        rating: typeof rv.rating === "number" ? rv.rating : 5,
        text: rv.text ?? "",
        relative_time_description: rv.relative_time_description ?? "",
        hidden: idx !== -1 ? next[idx].hidden : false,
        locked: true,
        google_review_key: key,
      };
      if (idx === -1) next.push(candidate);
      else next[idx] = candidate;
    }

    const isFirstFetch = !block.google_place_id && !lastFetched;
    const patch: Partial<ReviewsBlock> = {
      reviews: next,
      google_place_id: placeId,
      google_place_url: placeUrl,
      google_last_fetched_at: Date.now(),
    };
    if (isFirstFetch) {
      if (!block.click_url) patch.click_url = placeUrl || null;
      if (!block.add_review_url) {
        patch.add_review_url = `https://search.google.com/local/writereview?placeid=${placeId}`;
        patch.show_add_review_button = true;
      }
    }
    setBlock(patch);
  }

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
          canFetch={canFetch}
          cooldown={remainingMs}
          onFetchGoogle={() => setImporting(true)}
        />
      )}

      {tab === "layout" && (
        <LayoutPicker
          options={LAYOUTS.map((l) => ({
            type: l.value,
            label: t(l.labelKey),
            svg: l.svg.replace("/layouts/", ""),
          }))}
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

      {importing && (
        <GoogleReviewsImportSheet
          onImport={importGoogleReviews}
          onClose={() => setImporting(false)}
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
  canFetch,
  cooldown,
  onFetchGoogle,
}: {
  reviews: ReviewItem[];
  onReorder: (next: ReviewItem[]) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
  canFetch: boolean;
  cooldown: number;
  onFetchGoogle: () => void;
}) {
  const t = useTranslations("builder");
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
      {/* Fetch from Google (5-day cooldown, mirroring the mobile button). */}
      {canFetch ? (
        <button
          type="button"
          onClick={onFetchGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <GoogleG className="size-4" />
          {t("reviews.fetchFromGoogle")}
        </button>
      ) : (
        <button
          type="button"
          disabled
          title={t("reviews.availableAgainIn", { time: cooldownLabel(cooldown) })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold text-foreground/35"
        >
          <Lock className="size-3.5" />
          {t("reviews.fetchFromGoogle")}
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium">
            {cooldownLabel(cooldown)}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-4" />
        {t("reviews.addReviewManually")}
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
  const t = useTranslations("builder");
  const tc = useTranslations("common");
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
        aria-label={t("fields.drag")}
      >
        <GripVertical className="size-5" />
      </span>
      <span className="me-2.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/10">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
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
          {item.reviewer_name || t("reviews.defaultName")}
        </span>
        <MiniStars rating={item.rating ?? 0} />
        {item.text ? (
          <span className="truncate text-xs text-foreground/50">{item.text}</span>
        ) : null}
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
  const t = useTranslations("builder");
  const showAddReview = !!block.show_add_review_button;
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("fields.title")}</label>
        <Input
          value={block.title ?? ""}
          placeholder={t("reviews.titlePlaceholder")}
          onChange={(e) => setBlock({ title: e.target.value })}
        />
      </div>

      {/* Click URL */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("reviews.clickUrl")}</label>
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
          title={t("reviews.dropdown")}
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
          onClick={onDuplicate}
        />
        <ColorRow
          label={t("fields.background")}
          color={block.background_color ?? hexToArgbA("#ffffff")!}
          enabled={!!block.use_background_color}
          onColor={(c) => setBlock({ background_color: c })}
          onToggle={(v) => setBlock({ use_background_color: v })}
        />
        <GroupedRow
          Icon={Star}
          color="#d97706"
          title={t("reviews.addReviewButton")}
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
            {t("reviews.addReviewUrl")}
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
  const t = useTranslations("builder");
  return (
    <BottomSheet title={t("reviews.sheetTitle")} subtitle={t("reviews.sheetSubtitle")} onClose={onClose}>
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
          <label className="mb-1 block text-xs text-muted-foreground">{t("fields.name")}</label>
          <Input
            value={item.reviewer_name ?? ""}
            dir={dir(item.reviewer_name)}
            onChange={(e) => onChange({ reviewer_name: e.target.value })}
          />
        </div>

        {/* Rating row */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-input bg-surface px-4 py-3">
          <Star className="size-5" style={{ color: AMBER }} fill={AMBER} strokeWidth={0} />
          <span className="flex-1 text-sm font-medium text-foreground">{t("reviews.rating")}</span>
          <RatingPicker
            value={item.rating ?? 0}
            onChange={(v) => onChange({ rating: v })}
          />
        </div>

        {/* Review text */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("fields.text")}</label>
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
          <label className="mb-1 block text-xs text-muted-foreground">{t("reviews.timeAgo")}</label>
          <Input
            value={item.relative_time_description ?? ""}
            dir={dir(item.relative_time_description)}
            placeholder={t("reviews.timeAgoPlaceholder")}
            onChange={(e) => onChange({ relative_time_description: e.target.value })}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-base font-semibold text-white"
        >
          <Check className="size-5" />
          {t("reviews.done")}
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
  const t = useTranslations("builder");
  return (
    <div className="flex" style={{ color: AMBER }}>
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        return (
          <button
            key={i}
            type="button"
            aria-label={t("reviews.starsCount", { count: starValue })}
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
