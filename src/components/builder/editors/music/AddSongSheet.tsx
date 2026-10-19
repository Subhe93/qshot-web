"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Link2, Loader2, Search } from "lucide-react";
import {
  MusicLinksError,
  musicLinksKeys,
  resolveMusic,
  searchMusic,
  toMusicLinksError,
  type MusicResolveResponse,
  type MusicSearchCandidate,
} from "@/lib/api/music-links";
import type { MusicTrack } from "@/lib/types/blocks";
import { newUuid } from "@/lib/music-links/platforms";
import { dirOf } from "@/lib/builder/text-direction";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { useUpgradeDialog } from "@/components/plan/upgrade-dialog";
import { MusicCover } from "@/components/music/MusicPlatformIcon";
import {
  MusicErrorNote,
  errorState,
  type MusicErrorState,
  useSecondsLeft,
} from "./MusicErrorNote";
import { SongCard, type SongCardResult } from "./SongCard";

/** §10.3 — never search on every keystroke. */
export const SEARCH_DEBOUNCE_MS = 400;
export const SEARCH_MIN_CHARS = 2;
const SEARCH_MAX_CHARS = 120;
/** §9.1 `in_progress`: the same new song is being fetched — retry once. */
const IN_PROGRESS_RETRY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `resolve`, retried ONCE after ~2 s when another request is fetching it. */
async function resolveOnceMore(
  input: { link: string },
  alive: () => boolean,
): Promise<MusicResolveResponse | null> {
  try {
    return await resolveMusic(input);
  } catch (e) {
    const err = await toMusicLinksError(e);
    if (err.code !== "in_progress") throw err;
    await sleep(IN_PROGRESS_RETRY_MS);
    // The sheet was closed while waiting: no provider lookup nobody will see.
    if (!alive()) return null;
    return resolveMusic(input);
  }
}

/**
 * "Add song" (docs/api-contract.en.md §7.2, §7.3): search by name — debounced
 * 400 ms, ≥ 2 characters — or paste a song link; picking a candidate resolves
 * THAT one song (§10.4) with a loader on its row while every other tap is
 * blocked; the answer opens the song card, whose "Add" appends a Track with
 * fresh UUIDs.
 */
export function AddSongSheet({
  defaultVisibleCount,
  onAdd,
  onClose,
}: {
  defaultVisibleCount: number;
  onAdd: (track: MusicTrack) => void;
  onClose: () => void;
}) {
  const t = useTranslations("musicLinks");
  const showUpgrade = useUpgradeDialog((s) => s.show);

  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [paste, setPaste] = useState("");
  /** The link being resolved (a candidate's, or the pasted one). */
  const [resolving, setResolving] = useState<string | null>(null);
  const resolvingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [error, setError] = useState<MusicErrorState | null>(null);
  const [resolved, setResolved] = useState<MusicResolveResponse | null>(null);

  const term = input.trim().slice(0, SEARCH_MAX_CHARS);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(term.length >= SEARCH_MIN_CHARS ? term : ""), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [term]);
  // What the list shows: nothing until the user has typed enough.
  const active = term.length >= SEARCH_MIN_CHARS ? debounced : "";

  const search = useQuery({
    queryKey: musicLinksKeys.search(active),
    queryFn: ({ signal }) => searchMusic(active, undefined, signal),
    enabled: active.length >= SEARCH_MIN_CHARS && resolved == null,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  // `searchMusic` only ever throws MusicLinksError; the countdown of a
  // `rate_limited` answer starts when that error landed.
  const searchError: MusicErrorState | null =
    search.isError && search.error instanceof MusicLinksError
      ? { error: search.error, at: search.errorUpdatedAt }
      : null;
  const searchLocked = useSecondsLeft(searchError) > 0;
  const resolveLocked = useSecondsLeft(error) > 0;

  async function resolve(link: string) {
    // Taps are blocked while a resolve runs (§6.4: up to ~5 s, never twice).
    if (resolvingRef.current || resolveLocked) return;
    resolvingRef.current = true;
    setResolving(link);
    setLastLink(link);
    setError(null);
    try {
      const data = await resolveOnceMore({ link }, () => mountedRef.current);
      if (data) setResolved(data);
    } catch (e) {
      const err = await toMusicLinksError(e);
      if (err.code === "feature_not_in_plan") showUpgrade();
      setError(errorState(err));
    } finally {
      resolvingRef.current = false;
      setResolving(null);
    }
  }

  function add(result: SongCardResult) {
    if (!resolved) return;
    onAdd({
      id: newUuid(),
      isrc: resolved.track.isrc,
      title: result.title,
      artist: result.artist,
      cover_url: result.cover_url,
      preview_url: result.preview_url,
      hidden: false,
      links: result.links,
    });
  }

  const candidates = search.data?.candidates ?? [];
  const busy = resolving != null;

  return (
    <BottomSheet
      title={resolved ? t("card.heading") : t("search.title")}
      onClose={onClose}
    >
      {resolved ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setResolved(null)}
            className="-ms-1 inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
            {t("card.back")}
          </button>
          <SongCard
            mode="add"
            resolved={resolved}
            defaultVisibleCount={defaultVisibleCount}
            onSubmit={add}
          />
        </div>
      ) : (
        <div className="space-y-4" aria-busy={busy}>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="music-search"
              autoFocus
              dir={dirOf(input)}
              value={input}
              maxLength={SEARCH_MAX_CHARS}
              placeholder={t("search.placeholder")}
              onChange={(e) => setInput(e.target.value)}
              className="ps-9"
            />
          </div>

          {term.length > 0 && term.length < SEARCH_MIN_CHARS && (
            <p className="px-1 text-xs text-muted-foreground">{t("search.hint")}</p>
          )}

          {searchError && (
            <MusicErrorNote
              state={searchError}
              onRetry={searchLocked ? undefined : () => void search.refetch()}
            />
          )}

          {active && search.isFetching && candidates.length === 0 && (
            <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("search.searching")}
            </p>
          )}

          {active && search.isSuccess && candidates.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">{t("search.noResults")}</p>
          )}

          {candidates.length > 0 && (
            <ul className="space-y-1.5" data-testid="music-candidates">
              {candidates.map((c, i) => (
                <CandidateRow
                  key={`${c.link}-${i}`}
                  candidate={c}
                  loading={resolving === c.link}
                  disabled={busy || resolveLocked}
                  onPick={() => void resolve(c.link)}
                />
              ))}
            </ul>
          )}

          {error && (
            <MusicErrorNote
              state={error}
              onRetry={lastLink ? () => void resolve(lastLink) : undefined}
            />
          )}

          {/* §7.3 — resolve a pasted song link directly. */}
          <form
            className="space-y-1.5 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const link = paste.trim();
              if (link) void resolve(link);
            }}
          >
            <label className="block px-1 text-xs text-muted-foreground">{t("paste.label")}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="music-paste"
                  dir="ltr"
                  inputMode="url"
                  value={paste}
                  placeholder={t("paste.placeholder")}
                  onChange={(e) => setPaste(e.target.value)}
                  className="ps-9"
                />
              </div>
              <button
                type="submit"
                data-testid="music-paste-find"
                disabled={!paste.trim() || busy || resolveLocked}
                className="inline-flex min-w-20 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {resolving != null && resolving === paste.trim() ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t("paste.find")
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </BottomSheet>
  );
}

function CandidateRow({
  candidate,
  loading,
  disabled,
  onPick,
}: {
  candidate: MusicSearchCandidate;
  loading: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const t = useTranslations("musicLinks");
  const artist = candidate.artist ?? candidate.artists.join(", ");
  return (
    <li>
      <button
        type="button"
        data-testid="music-candidate"
        data-loading={loading}
        onClick={onPick}
        disabled={disabled}
        aria-busy={loading}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl bg-surface p-2 text-start transition-colors hover:bg-foreground/[0.06]",
          disabled && !loading && "opacity-50",
          disabled && "cursor-not-allowed",
        )}
      >
        <MusicCover url={candidate.cover_url} className="size-12 shrink-0 rounded-lg text-foreground" />
        <span className="min-w-0 flex-1">
          <span dir={dirOf(candidate.title)} className="block truncate text-sm font-semibold text-foreground">
            {candidate.title}
          </span>
          {artist && (
            <span dir={dirOf(artist)} className="block truncate text-xs text-muted-foreground">
              {artist}
            </span>
          )}
        </span>
        {loading && (
          <span className="flex shrink-0 items-center gap-1.5 pe-1 text-xs font-medium text-primary">
            <Loader2 className="size-4 animate-spin" />
            <span className="hidden sm:inline">{t("resolving")}</span>
          </span>
        )}
      </button>
    </li>
  );
}
