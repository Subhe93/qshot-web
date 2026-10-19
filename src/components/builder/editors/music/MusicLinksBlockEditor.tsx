"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ListMusic,
  LayoutGrid,
  Settings as SettingsIcon,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  Copy,
  ChevronsDownUp,
  Image as ImageIcon,
  Lock,
  Type,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
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
  MusicButtonStyle,
  MusicLinksBlock,
  MusicLinksLayoutType,
  MusicTrack,
} from "@/lib/types/blocks";
import {
  addSongState,
  useMusicEntitlements,
  usePageTrackCount,
} from "@/lib/music-links/use-music-links";
import { DEFAULT_VISIBLE_COUNT } from "@/lib/music-links/platforms";
import { useUpgradeDialog } from "@/components/plan/upgrade-dialog";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MusicCover } from "@/components/music/MusicPlatformIcon";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "../sheet-kit";
import { LayoutPicker } from "../LayoutPicker";
import { AddSongSheet } from "./AddSongSheet";
import { SongCard, type SongCardResult } from "./SongCard";

type Tab = "songs" | "layout" | "settings";

// The existing layout illustrations (public/layouts/), reused: cards → the card
// swiper (as the Reviews `cards` layout), list → list, grid → grid.
const LAYOUTS: { type: MusicLinksLayoutType; labelKey: string; svg: string }[] = [
  { type: "cards", labelKey: "layout.cards", svg: "layout_swiper_card.svg" },
  { type: "list", labelKey: "layout.list", svg: "layout_list.svg" },
  { type: "grid", labelKey: "layout.grid", svg: "layout_grid.svg" },
];

/**
 * Songs block editor (docs/api-contract.en.md §7), in the Products sheet
 * pattern: Songs (reorder / hide / delete / tap to edit, "Add song") · Layout
 * (list / grid / cards, Show cover, Button style) · Settings (title, dropdown,
 * duplicate, background).
 *
 * "Add song" obeys `GET music-links/entitlements` (fetched once per editor
 * open): hidden while the service is off or unreachable, an upgrade prompt
 * when the plan lacks the feature, and disabled once the PAGE — every Songs
 * block on it — holds `max_tracks_per_page` songs (§7.5). The server enforces
 * the same ceiling on save (§9.2).
 */
export function MusicLinksBlockEditor({ block }: { block: MusicLinksBlock }) {
  const t = useTranslations("builder");
  const tm = useTranslations("musicLinks");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const showUpgrade = useUpgradeDialog((s) => s.show);
  const entitlements = useMusicEntitlements();
  const pageCount = usePageTrackCount();
  const [tab, setTab] = useState<Tab>("songs");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const tracks = block.tracks ?? [];
  const setBlock = (patch: Partial<MusicLinksBlock>) => updateBlock(block.id, patch);
  const setTracks = (next: MusicTrack[]) => setBlock({ tracks: next });
  const editing = tracks.find((tr) => tr.id === editingId) ?? null;
  const state = addSongState(entitlements.data, pageCount);

  const tabs: SheetTab<Tab>[] = [
    { value: "songs", label: tm("tabs.songs"), Icon: ListMusic },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  function openAdd() {
    if (state.kind === "locked") {
      showUpgrade();
      return;
    }
    if (state.kind === "ok") setAdding(true);
  }

  /**
   * Duplicating copies the songs too, which ADDS them to the page: the same
   * gate as "Add song" applies (§3, §7.5) — otherwise the copy sails past the
   * per-page ceiling (or a missing entitlement) and only the save refuses it.
   * A block with no songs is always copied.
   */
  const [dupNote, setDupNote] = useState<string | null>(null);
  function duplicate() {
    const n = tracks.length;
    if (n > 0) {
      if (state.kind === "locked") {
        showUpgrade();
        return;
      }
      if (state.kind === "unavailable") {
        setDupNote(tm("unavailable"));
        return;
      }
      if (state.max != null && pageCount + n > state.max) {
        setDupNote(tm("limitReached", { count: state.max }));
        return;
      }
    }
    setDupNote(null);
    addBlock({ ...block, id: nanoid() });
  }

  function applyEdit(track: MusicTrack, result: SongCardResult) {
    setTracks(
      tracks.map((tr) =>
        tr.id === track.id
          ? {
              ...tr,
              title: result.title,
              artist: result.artist,
              cover_url: result.cover_url,
              preview_url: result.preview_url,
              links: result.links,
            }
          : tr,
      ),
    );
    setEditingId(null);
  }

  return (
    <div className="space-y-4" data-testid="music-editor">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "songs" && (
        <div className="space-y-2">
          {state.kind !== "unavailable" && (
            <button
              type="button"
              data-testid="add-song"
              onClick={openAdd}
              disabled={state.kind === "limit"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
            >
              {state.kind === "locked" ? <Lock className="size-4" /> : <Plus className="size-4" />}
              {tm("addSong")}
            </button>
          )}
          {state.kind === "limit" && (
            <p data-testid="song-limit" className="px-1 text-center text-xs text-muted-foreground">
              {tm("limitReached", { count: state.max })}
            </p>
          )}
          {state.kind === "ok" && state.max != null && (
            <p className="px-1 text-center text-[11px] text-muted-foreground">
              {tm("limitCounter", { count: pageCount, max: state.max })}
            </p>
          )}
          {state.kind === "unavailable" && !entitlements.isPending && (
            <p className="rounded-xl bg-surface px-3 py-2.5 text-center text-xs text-muted-foreground">
              {tm("unavailable")}
            </p>
          )}

          {tracks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{tm("empty")}</p>
          ) : (
            <TrackList
              tracks={tracks}
              onReorder={setTracks}
              onEdit={setEditingId}
              onToggleHide={(id) =>
                setTracks(tracks.map((tr) => (tr.id === id ? { ...tr, hidden: !tr.hidden } : tr)))
              }
              onDelete={(id) => setTracks(tracks.filter((tr) => tr.id !== id))}
            />
          )}
        </div>
      )}

      {tab === "layout" && (
        <div className="space-y-4">
          <LayoutPicker
            options={LAYOUTS.map((l) => ({ ...l, label: tm(l.labelKey) }))}
            value={block.layout_type ?? "cards"}
            onChange={(v) => setBlock({ layout_type: v })}
          />
          <GroupedCard>
            <GroupedRow
              Icon={ImageIcon}
              color="#ec407a"
              title={tm("showCover")}
              trailing={
                <ToggleSwitch
                  checked={block.show_cover !== false}
                  onChange={(v) => setBlock({ show_cover: v })}
                />
              }
            />
          </GroupedCard>
          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tm("buttonStyle")}
            </p>
            <ButtonStylePicker
              value={block.button_style ?? "iconText"}
              onChange={(v) => setBlock({ button_style: v })}
            />
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface px-3.5">
            <Type className="size-[18px] shrink-0 text-primary" />
            <input
              type="text"
              data-testid="music-block-title"
              value={block.title ?? ""}
              placeholder={t("fields.title")}
              onChange={(e) => setBlock({ title: e.target.value })}
              dir="auto"
              className="h-12 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground/35"
            />
          </div>
          <GroupedCard>
            <GroupedRow
              Icon={ChevronsDownUp}
              color="var(--primary)"
              title={tm("dropdown")}
              trailing={
                <ToggleSwitch
                  checked={!!block.foldable}
                  onChange={(v) => setBlock({ foldable: v })}
                />
              }
            />
            <GroupedRow
              Icon={Copy}
              color="#673ab7"
              title={t("fields.duplicate")}
              onClick={duplicate}
            />
            <ColorRow
              label={t("fields.background")}
              color={block.background_color ?? hexToArgbA("#000000")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
          </GroupedCard>
          {dupNote && (
            <p data-testid="music-duplicate-note" className="px-1 text-center text-xs text-muted-foreground">
              {dupNote}
            </p>
          )}
        </div>
      )}

      {adding && (
        <AddSongSheet
          defaultVisibleCount={entitlements.data?.default_visible_count ?? DEFAULT_VISIBLE_COUNT}
          onClose={() => setAdding(false)}
          onAdd={(track) => {
            // Re-read the block: the sheet may have been open across other edits.
            const live = useEditorStore
              .getState()
              .blocks.find((b) => b.id === block.id) as MusicLinksBlock | undefined;
            updateBlock(block.id, { tracks: [...(live?.tracks ?? tracks), track] });
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <BottomSheet
          title={tm("card.editHeading")}
          onClose={() => setEditingId(null)}
        >
          <SongCard
            key={editing.id}
            mode="edit"
            track={editing}
            onSubmit={(result) => applyEdit(editing, result)}
          />
        </BottomSheet>
      )}
    </div>
  );
}

// ─── Songs list ──────────────────────────────────────────────────────────────

function TrackList({
  tracks,
  onReorder,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  tracks: MusicTrack[];
  onReorder: (next: MusicTrack[]) => void;
  onEdit: (id: string) => void;
  onToggleHide: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = tracks.findIndex((tr) => tr.id === active.id);
    const to = tracks.findIndex((tr) => tr.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(tracks, from, to));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={tracks.map((tr) => tr.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2" data-testid="music-tracks">
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onEdit={() => onEdit(track.id)}
              onToggleHide={() => onToggleHide(track.id)}
              onDelete={() => onDelete(track.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function TrackRow({
  track,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  track: MusicTrack;
  onEdit: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const tm = useTranslations("musicLinks");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });
  const title = track.title || tm("untitled");
  return (
    <div
      ref={setNodeRef}
      data-testid="music-track"
      data-track-id={track.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-14 items-center rounded-xl border border-primary/20 bg-surface",
        track.hidden && "opacity-50",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        data-testid="music-track-drag"
        className="flex h-full cursor-grab touch-none items-center px-2.5 text-primary active:cursor-grabbing"
        aria-label={t("fields.drag")}
      >
        <GripVertical className="size-5" />
      </span>
      <MusicCover url={track.cover_url} className="me-2.5 size-9 shrink-0 rounded-md text-foreground" />
      <button
        type="button"
        onClick={onEdit}
        data-testid="music-track-edit"
        className="me-1 flex h-full min-w-0 flex-1 flex-col justify-center text-start"
      >
        <span dir={dirOf(title)} className="truncate text-sm font-semibold text-foreground">
          {title}
        </span>
        {track.artist && (
          <span dir={dirOf(track.artist)} className="truncate text-xs text-muted-foreground">
            {track.artist}
          </span>
        )}
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
        data-testid="music-track-hide"
        aria-label={t("fields.toggleVisibility")}
        aria-pressed={!!track.hidden}
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {track.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        data-testid="music-track-delete"
        aria-label={tc("delete")}
        className="me-1.5 flex size-8 items-center justify-center text-error"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// ─── Button style ────────────────────────────────────────────────────────────

function ButtonStylePicker({
  value,
  onChange,
}: {
  value: MusicButtonStyle;
  onChange: (v: MusicButtonStyle) => void;
}) {
  const tm = useTranslations("musicLinks");
  const options: { value: MusicButtonStyle; label: string }[] = [
    { value: "icon", label: tm("buttonIcon") },
    { value: "iconText", label: tm("buttonIconText") },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tm("buttonStyle")}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`button-style-${o.value}`}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors",
              selected ? "border-primary bg-primary/[0.04]" : "border-border hover:border-primary/40",
            )}
          >
            <span className="flex h-8 items-center gap-1.5">
              {o.value === "icon" ? (
                <>
                  <span className="size-7 rounded-full bg-foreground/15" />
                  <span className="size-7 rounded-full bg-foreground/15" />
                  <span className="size-7 rounded-full bg-foreground/15" />
                </>
              ) : (
                <>
                  <span className="flex h-7 items-center gap-1 rounded-full bg-foreground/15 px-2">
                    <span className="size-3.5 rounded-full bg-foreground/30" />
                    <span className="h-1.5 w-7 rounded bg-foreground/30" />
                  </span>
                  <span className="flex h-7 items-center gap-1 rounded-full bg-foreground/15 px-2">
                    <span className="size-3.5 rounded-full bg-foreground/30" />
                    <span className="h-1.5 w-5 rounded bg-foreground/30" />
                  </span>
                </>
              )}
            </span>
            <span className="text-xs font-semibold text-foreground">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
