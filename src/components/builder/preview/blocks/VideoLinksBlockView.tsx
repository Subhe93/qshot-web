"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoLinkItem, VideoLinksBlock } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";
import { Foldable } from "../Foldable";

/**
 * Read-only preview for VideoLinksBlock ("VideoLinksModule"), faithful to the
 * Flutter `VideosWidget`. Renders the three layout_type variants (list / swiper
 * / grid) with the mobile `VideoCard`: 16:9 thumbnail, dark border, centered
 * play circle and an optional title overlay.
 *
 * Like the mobile `VideoCard`, when an item has no explicit title we lazily
 * fetch the YouTube video title via the public oEmbed endpoint and show it as a
 * bottom scrim overlay. Failures (network / non-YouTube URL) are swallowed.
 */

// Mirrors VideoUtils.regex / getYoutubeVideoId / getYoutubeThumbnail.
const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|watch\?list=|c\/[^/]+\/v\/|user\/[^/]+\/v\/)?([A-Za-z0-9_-]{11})(?:.+)?$/;

function youtubeThumbnail(url: string | undefined): string | null {
  if (!url) return null;
  const m = YT_REGEX.exec(url);
  const id = m?.[1];
  return id ? `https://img.youtube.com/vi/${id}/0.jpg` : null;
}

/** Centered SVG play glyph used inside the play circle (Assets.svg.iconPlay). */
function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={30}
      height={30}
      fill="white"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/**
 * Module-level cache of resolved oEmbed titles, keyed by video URL. Shared
 * across all cards so a given URL is only fetched once per session.
 */
const titleCache = new Map<string, string>();

/**
 * Lazily resolve the YouTube oEmbed title for a URL. Returns the cached title
 * synchronously when known; otherwise fetches and updates state. Fails silently
 * (returns undefined) for non-YouTube URLs or network errors.
 */
function useYoutubeTitle(url: string | undefined, enabled: boolean): string | undefined {
  // `resolved` only tracks titles fetched at runtime; cached values are read
  // directly during render so we never call setState synchronously in an effect.
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !url) return;
    if (titleCache.has(url)) return; // already known — read from cache in render
    if (!youtubeThumbnail(url)) return; // not a recognizable YouTube URL

    let cancelled = false;
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      url,
    )}&format=json`;
    fetch(endpoint)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { title?: string } | null) => {
        const t = data?.title;
        if (!t) return;
        titleCache.set(url, t);
        if (!cancelled && mounted.current) {
          setResolved((prev) => ({ ...prev, [url]: t }));
        }
      })
      .catch(() => {
        /* fail silently — no overlay */
      });

    return () => {
      cancelled = true;
    };
  }, [url, enabled]);

  if (!url) return undefined;
  return titleCache.get(url) ?? resolved[url];
}

/**
 * The mobile VideoCard: an AspectRatio(16/9) container with a 1px black38
 * border, rounded 8px, thumbnail (cover) and a 60x60 translucent play circle.
 * The title sits at the bottom over a gradient scrim, white & semi-bold. When
 * the item has no title we fetch the YouTube title via oEmbed (mobile parity).
 */
function VideoCard({ item }: { item: VideoLinkItem }) {
  const thumb = youtubeThumbnail(item.url);
  const explicit = item.title?.trim() || "";
  const fetched = useYoutubeTitle(item.url, !explicit);
  const title = explicit || fetched || "";
  return (
    // Padding(vertical: 5) around each card.
    <div className="py-[5px]">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-lg"
        style={{
          border: "1px solid rgba(0,0,0,0.22)",
          backgroundColor: "rgba(255,255,255,0.2)",
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-foreground/30">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="currentColor" aria-hidden="true">
              <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" />
            </svg>
          </div>
        )}

        {/* Centered play circle: 60x60, white @20% alpha. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex size-[60px] items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <PlayIcon />
          </div>
        </div>

        {/* Title overlay: gradient scrim + white text, 1-2 lines at the bottom. */}
        {title && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-3 pt-8">
            <span
              dir={dirOf(title)}
              className="line-clamp-2 text-sm font-semibold leading-snug text-white"
            >
              {title}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function VideoLinksBlockView({ block }: { block: VideoLinksBlock }) {
  const items = (block.items ?? []).filter((it) => !it.hidden);
  const title = block.title?.trim() ?? "";
  const layout = block.layout_type ?? "list";

  const body =
    items.length === 0 ? (
      <p className="px-6 py-4 text-center text-xs text-muted-foreground/60">
        No videos yet
      </p>
    ) : layout === "list" ? (
      // List: full-width cards, horizontal padding 24.
      <div className="flex flex-col px-6">
        {items.map((item, i) => (
          <VideoCard key={item.id ?? i} item={item} />
        ))}
      </div>
    ) : layout === "swiper" ? (
      // Swiper: AspectRatio (16/9)*1.1, viewportFraction 0.9, no loop.
      <div className="w-full" style={{ aspectRatio: (16 / 9) * 1.1 }}>
        <div className="flex h-full snap-x snap-mandatory gap-0 overflow-x-auto px-[5%] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (
            <div
              key={item.id ?? i}
              className="flex h-full w-[90%] shrink-0 snap-center items-center justify-center"
            >
              <div className="w-full">
                <VideoCard item={item} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      // Grid: horizontally scrolling row of fixed-height (148) 16:9 cards.
      <div className="flex items-start gap-0 overflow-x-auto px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <div
            key={item.id ?? i}
            className="h-[148px] shrink-0 px-1"
            // The card has 10px vertical padding inside the 148px row, so the
            // visible 16:9 thumbnail is (148 - 10) tall — size width to match
            // (mobile AspectRatio inside SizedBox(height: 148)).
            style={{ width: (148 - 10) * (16 / 9) }}
          >
            <VideoCard item={item} />
          </div>
        ))}
      </div>
    );

  return (
    <div className="py-2">
      <Foldable
        foldable={block.foldable}
        header={
          title ? (
            <>
              <h2
                dir={dirOf(title)}
                className="px-6 text-xl font-bold text-foreground"
              >
                {title}
              </h2>
              <div className="h-[5px]" />
            </>
          ) : null
        }
      >
        {body}
        {/* Divider(indent 8, endIndent 8) at foreground@20% (mobile parity). */}
        <div className="h-[5px]" />
        <div className="px-5">
          <div
            className="mx-2 h-px"
            style={{ backgroundColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
          />
        </div>
      </Foldable>
    </div>
  );
}
