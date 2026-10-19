"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  RefreshCw,
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
import {
  loadMusicTrack,
  refreshMusicTrack,
  toMusicLinksError,
  type MusicResolveResponse,
  type MusicResolvedPlatform,
} from "@/lib/api/music-links";
import {
  DEFAULT_VISIBLE_COUNT,
  isKnownMusicPlatform,
  musicPlatformName,
  newUuid,
} from "@/lib/music-links/platforms";
import { useMusicPlatforms } from "@/lib/music-links/use-music-links";
import type { MusicTrack, MusicTrackLink } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { MusicCover, MusicPlatformIcon } from "@/components/music/MusicPlatformIcon";
import {
  MusicErrorNote,
  errorState,
  type MusicErrorState,
  useSecondsLeft,
} from "./MusicErrorNote";
import { cooldownParts } from "./music-errors";

/**
 * The song card (docs/api-contract.en.md §7.2 / §7.4): editable title (required)
 * and artist, then the song's platforms — select / unselect, reorder (drag),
 * hide — with "Show more" for the platforms not shown yet.
 *
 *  - `add`:  rows come from one `resolve` answer. `default_visible` rows are
 *            pre-selected and shown; "Show more" reveals the rest of the SAME
 *            response, unselected (no extra request). `missing` platforms never
 *            get a row.
 *  - `edit`: rows are the saved `links`, in the saved order. "Show more" calls
 *            `GET tracks/:isrc` (→ `resolve {isrc}` on `not_found`) and offers
 *            the platforms not yet in `links`; "Refresh links" re-fetches them
 *            (`refresh_cooldown` disables the button until it unlocks).
 *
 * URLs are carried EXACTLY as the server returned them (§10.5).
 */

interface PlatformRow {
  platform: string;
  url: string;
  names?: { name_ar: string; name_en: string };
  selected: boolean;
  hidden: boolean;
  /** Shown before "Show more". */
  initial: boolean;
  /** The saved link this row came from (edit mode): id + passthrough keys. */
  link?: MusicTrackLink;
}

/** What the card hands back. `links` are complete, with fresh UUIDs for new ones. */
export interface SongCardResult {
  title: string;
  artist: string | null;
  cover_url: string | null;
  preview_url: string | null;
  links: MusicTrackLink[];
}

function rowsFromResolve(
  platforms: MusicResolvedPlatform[],
  defaultVisibleCount: number,
): PlatformRow[] {
  const known = platforms.filter((p) => isKnownMusicPlatform(p.platform));
  // `default_visible` marks the first N FOUND platforms (§6.4); fall back to
  // the first `default_visible_count` if a response carries no flags at all.
  const flagged = known.some((p) => p.default_visible);
  return known.map((p, i) => {
    const visible = flagged ? p.default_visible : i < defaultVisibleCount;
    return {
      platform: p.platform,
      url: p.url,
      names: { name_ar: p.name_ar, name_en: p.name_en },
      selected: visible,
      hidden: false,
      initial: visible,
    };
  });
}

function rowsFromTrack(track: MusicTrack): PlatformRow[] {
  return (track.links ?? [])
    .filter((l) => isKnownMusicPlatform(l.platform))
    .map((l) => ({
      platform: l.platform,
      url: l.url,
      selected: true,
      hidden: l.hidden === true,
      initial: true,
      link: l,
    }));
}

export function SongCard(
  props:
    | {
        mode: "add";
        resolved: MusicResolveResponse;
        defaultVisibleCount?: number;
        onSubmit: (result: SongCardResult) => void;
      }
    | {
        mode: "edit";
        track: MusicTrack;
        onSubmit: (result: SongCardResult) => void;
      },
) {
  const t = useTranslations("musicLinks");
  const locale = useLocale();
  const platformsQuery = useMusicPlatforms(props.mode === "edit");

  const isrc = props.mode === "add" ? props.resolved.track.isrc : props.track.isrc;
  const [title, setTitle] = useState(() =>
    props.mode === "add" ? props.resolved.track.title : props.track.title ?? "",
  );
  const [artist, setArtist] = useState(() =>
    (props.mode === "add" ? props.resolved.track.artist : props.track.artist) ?? "",
  );
  const [cover, setCover] = useState<string | null>(() =>
    (props.mode === "add" ? props.resolved.track.cover_url : props.track.cover_url) ?? null,
  );
  const [preview, setPreview] = useState<string | null>(() =>
    (props.mode === "add" ? props.resolved.track.preview_url : props.track.preview_url) ?? null,
  );
  const [rows, setRows] = useState<PlatformRow[]>(() =>
    props.mode === "add"
      ? rowsFromResolve(props.resolved.platforms, props.defaultVisibleCount ?? DEFAULT_VISIBLE_COUNT)
      : rowsFromTrack(props.track),
  );
  // Links whose platform this build does not know: never shown, never dropped.
  const preserved = useMemo(
    () =>
      props.mode === "edit"
        ? (props.track.links ?? []).filter((l) => !isKnownMusicPlatform(l.platform))
        : [],
    // The card is keyed by the track it edits; its links are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [showMore, setShowMore] = useState(false);
  // Edit mode: "Show more" needs the server's full platform list once.
  const [moreLoaded, setMoreLoaded] = useState(props.mode === "add");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [error, setError] = useState<MusicErrorState | null>(null);
  const [cooldown, setCooldown] = useState<MusicErrorState | null>(null);
  const [touched, setTouched] = useState(false);
  const cooldownLeft = useSecondsLeft(cooldown);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const apiNames = useMemo(() => {
    const map = new Map<string, { name_ar: string; name_en: string }>();
    for (const p of platformsQuery.data?.platforms ?? []) map.set(p.id, p);
    return map;
  }, [platformsQuery.data]);
  const nameOf = (r: PlatformRow) =>
    musicPlatformName(r.platform, locale, r.names ?? apiNames.get(r.platform));

  const shown = rows.filter((r) => showMore || r.initial || r.selected);
  const hasMore = !moreLoaded || rows.some((r) => !r.initial && !r.selected);
  const selectedCount = rows.filter((r) => r.selected).length;
  const titleOk = title.trim().length > 0;
  const canSubmit = titleOk && selectedCount > 0;

  /** Merge a server answer into the rows: new platforms arrive unselected,
   *  known ones keep the user's choice and take the server's (new) URL. */
  function merge(data: MusicResolveResponse, takeUrls: boolean) {
    setRows((prev) => {
      const next = prev.map((r) => {
        const p = data.platforms.find((x) => x.platform === r.platform);
        if (!p) return r;
        return {
          ...r,
          names: { name_ar: p.name_ar, name_en: p.name_en },
          url: takeUrls ? p.url : r.url,
        };
      });
      for (const p of data.platforms) {
        if (!isKnownMusicPlatform(p.platform)) continue;
        if (next.some((r) => r.platform === p.platform)) continue;
        next.push({
          platform: p.platform,
          url: p.url,
          names: { name_ar: p.name_ar, name_en: p.name_en },
          selected: false,
          hidden: false,
          initial: false,
        });
      }
      return next;
    });
  }

  async function toggleMore() {
    if (showMore) {
      setShowMore(false);
      return;
    }
    if (moreLoaded) {
      setShowMore(true);
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      merge(await loadMusicTrack(isrc), false);
      setMoreLoaded(true);
      setShowMore(true);
    } catch (e) {
      setError(errorState(await toMusicLinksError(e)));
    } finally {
      setLoadingMore(false);
    }
  }

  async function refresh() {
    if (refreshing || cooldownLeft > 0) return;
    setRefreshing(true);
    setError(null);
    setRefreshed(false);
    try {
      const data = await refreshMusicTrack(isrc);
      merge(data, true);
      if (data.track.cover_url) setCover(data.track.cover_url);
      if (data.track.preview_url) setPreview(data.track.preview_url);
      setMoreLoaded(true);
      setShowMore(true);
      setRefreshed(true);
    } catch (e) {
      const err = await toMusicLinksError(e);
      if (err.code === "refresh_cooldown") setCooldown(errorState(err));
      else setError(errorState(err));
    } finally {
      setRefreshing(false);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.platform === active.id);
    const to = rows.findIndex((r) => r.platform === over.id);
    if (from !== -1 && to !== -1) setRows(arrayMove(rows, from, to));
  }

  const patchRow = (platform: string, patch: Partial<PlatformRow>) =>
    setRows((prev) => prev.map((r) => (r.platform === platform ? { ...r, ...patch } : r)));

  function submit() {
    setTouched(true);
    if (!canSubmit) return;
    const links: MusicTrackLink[] = rows
      .filter((r) => r.selected)
      .map((r) => ({
        ...(r.link ?? {}),
        id: r.link?.id ?? newUuid(),
        platform: r.platform,
        url: r.url,
        hidden: r.hidden,
      }));
    props.onSubmit({
      title: title.trim(),
      artist: artist.trim() ? artist.trim() : null,
      cover_url: cover,
      preview_url: preview,
      links: [...links, ...preserved],
    });
  }

  const cd = cooldownParts(cooldownLeft);

  return (
    <div className="space-y-4" data-testid="song-card">
      <div className="flex items-start gap-3">
        <MusicCover url={cover} className="size-16 shrink-0 rounded-xl text-foreground" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("card.title")}</label>
            <Input
              data-testid="song-title"
              dir={dirOf(title)}
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={touched && !titleOk}
            />
            {touched && !titleOk && (
              <p className="mt-1 text-[11px] text-error">{t("card.titleRequired")}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("card.artist")}</label>
            <Input
              data-testid="song-artist"
              dir={dirOf(artist)}
              value={artist}
              maxLength={200}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("card.platforms")}
        </p>
        <p className="mb-2 px-1 text-xs text-muted-foreground">{t("card.platformsHint")}</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((r) => r.platform)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5" data-testid="platform-rows">
              {shown.map((r) => (
                <PlatformRowView
                  key={r.platform}
                  row={r}
                  name={nameOf(r)}
                  onToggleSelect={() =>
                    patchRow(r.platform, { selected: !r.selected, hidden: r.selected ? false : r.hidden })
                  }
                  onToggleHide={() => patchRow(r.platform, { hidden: !r.hidden })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {shown.length === 0 && (
          <p className="rounded-xl bg-surface px-3 py-3 text-center text-xs text-muted-foreground">
            {t("card.noPlatforms")}
          </p>
        )}
        {(hasMore || showMore) && (
          <button
            type="button"
            data-testid="show-more"
            onClick={() => void toggleMore()}
            disabled={loadingMore}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 className="size-4 animate-spin" />
            ) : showMore ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
            {showMore ? t("card.showLess") : t("card.showMore")}
          </button>
        )}
        {showMore && moreLoaded && !rows.some((r) => !r.initial) && (
          <p className="px-1 text-center text-xs text-muted-foreground">{t("card.noMore")}</p>
        )}
      </div>

      {props.mode === "edit" && (
        <div className="space-y-1.5">
          <button
            type="button"
            data-testid="refresh-links"
            onClick={() => void refresh()}
            disabled={refreshing || cooldownLeft > 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("card.refresh")}
          </button>
          {cooldownLeft > 0 && (
            <p data-testid="refresh-cooldown" className="text-center text-xs text-muted-foreground">
              {t("card.refreshAvailableIn", { time: t(`time.${cd.unit}`, { n: cd.n }) })}
            </p>
          )}
          {refreshed && (
            <p className="text-center text-xs text-muted-foreground">{t("card.refreshed")}</p>
          )}
        </div>
      )}

      {error && <MusicErrorNote state={error} />}

      {touched && selectedCount === 0 && (
        <p className="text-center text-xs text-error">{t("card.choosePlatform")}</p>
      )}

      <button
        type="button"
        data-testid="song-submit"
        onClick={submit}
        disabled={touched && !canSubmit}
        className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {props.mode === "add" ? t("card.add") : t("card.save")}
      </button>
    </div>
  );
}

function PlatformRowView({
  row,
  name,
  onToggleSelect,
  onToggleHide,
}: {
  row: PlatformRow;
  name: string;
  onToggleSelect: () => void;
  onToggleHide: () => void;
}) {
  const t = useTranslations("musicLinks.card");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.platform,
  });
  return (
    <div
      ref={setNodeRef}
      data-testid="platform-row"
      data-platform={row.platform}
      data-selected={row.selected}
      data-hidden={row.hidden}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-12 items-center rounded-xl border bg-surface",
        row.selected ? "border-primary/25" : "border-transparent",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        data-testid="platform-drag"
        className="flex h-full cursor-grab touch-none items-center px-2 text-primary active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </span>
      <button
        type="button"
        role="checkbox"
        aria-checked={row.selected}
        aria-label={t("select", { name })}
        onClick={onToggleSelect}
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 text-start"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            row.selected ? "border-primary bg-primary text-white" : "border-foreground/25",
          )}
        >
          {row.selected && <Check className="size-3" strokeWidth={3} />}
        </span>
        <MusicPlatformIcon id={row.platform} size={26} className="rounded-md" />
        <span
          className={cn(
            "truncate text-sm font-medium",
            row.selected && !row.hidden ? "text-foreground" : "text-foreground/50",
          )}
        >
          {name}
        </span>
      </button>
      {row.selected && (
        <button
          type="button"
          onClick={onToggleHide}
          aria-label={t("hide", { name })}
          aria-pressed={row.hidden}
          data-testid="platform-hide"
          className="me-1.5 flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {row.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
    </div>
  );
}
