"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoLinkItem, VideoLinksBlock } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";
import { Foldable } from "../Foldable";
import { useDesktopPreview, DESKTOP_BLOCK_TITLE } from "../desktop-preview";

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
 * outside outline, rounded 8px, thumbnail (cover) and a 60x60 translucent play
 * circle. The title sits at the bottom (16px insets, soft shadow). When the
 * item has no title we fetch the YouTube title via oEmbed (mobile parity).
 */
function VideoCard({ item }: { item: VideoLinkItem }) {
  const thumb = youtubeThumbnail(item.url);
  const explicit = item.title?.trim() || "";
  const fetched = useYoutubeTitle(item.url, !explicit);
  const title = explicit || fetched || "";
  return (
    // Unified spacing identity (owner's request 2026-09-17): shared edge inset,
    // 8px gaps at phone width — matches the Nuxt renderer. The card is
    // margin-less (rhythm lives on the parents); chrome = videosLayout/Grid.vue:
    // radius 8, 1px OUTSIDE black-38 outline (strokeAlignOutside → box-shadow),
    // white-20 backing.
    <div
      className="relative aspect-video w-full overflow-hidden rounded-lg"
      style={{
        boxShadow: "0 0 0 1px rgba(0,0,0,0.38)",
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

      {/* Title overlay = Nuxt VideoPlayer/Inline.vue .video-title (one style
          at every width): bottom 16px insets, white 14px/600, 2-line clamp,
          soft shadow instead of a background strip. */}
      {title && (
        <div className="absolute inset-x-4 bottom-4">
          <span
            dir={dirOf(title)}
            className="line-clamp-2 text-sm font-semibold leading-[1.3] text-white"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.54)" }}
          >
            {title}
          </span>
        </div>
      )}
    </div>
  );
}

export function VideoLinksBlockView({ block }: { block: VideoLinksBlock }) {
  const desktop = useDesktopPreview();
  const items = (block.items ?? []).filter((it) => !it.hidden);
  const title = block.title?.trim() ?? "";
  const layout = block.layout_type ?? "list";
  // Unified spacing identity (owner's request 2026-09-17): 8px item gaps at
  // phone width, 16px in the desktop pane — Nuxt gap-2 lg:gap-4 / spaceBetween
  // 8/16 on every unified strip and stack.
  const gap = desktop ? "gap-4" : "gap-2";

  const body =
    items.length === 0 ? (
      <p className="px-6 py-4 text-center text-xs text-muted-foreground/60">
        No videos yet
      </p>
    ) : layout === "list" ? (
      // Unified spacing identity (owner's request 2026-09-17): shared edge
      // inset, 8px gaps at phone width / 16px in the desktop pane — matches
      // the Nuxt renderer (videosLayout/List.vue: full-width margin-less cards).
      <div className={`flex flex-col ${gap}`}>
        {items.map((item, i) => (
          <VideoCard key={item.id ?? i} item={item} />
        ))}
      </div>
    ) : layout === "swiper" ? (
      // Swiper: AspectRatio (16/9)*1.1, leading-edge start, 8px/16px slide gap
      // (Nuxt videosLayout/Swiper.vue: slidesPerView 1.1, spaceBetween 8/16).
      <div className="w-full" style={{ aspectRatio: (16 / 9) * 1.1 }}>
        <div className={`flex h-full snap-x snap-mandatory ${gap} overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {items.map((item, i) => (
            <div
              key={item.id ?? i}
              className="flex h-full w-[90%] shrink-0 snap-start items-center justify-center"
            >
              <div className="w-full">
                <VideoCard item={item} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      // Grid: a FREE horizontally-scrolling strip of 138px-tall 16:9 cards
      // (width ≈245px), 8px/16px column gap, leading-edge start, 5px vertical
      // card margin (Nuxt videosLayout/Grid.vue).
      <div className={`flex items-start ${gap} overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {items.map((item, i) => (
          <div
            key={item.id ?? i}
            className="shrink-0 py-[5px]"
            style={{ width: 138 * (16 / 9) }}
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
              {/* Desktop = Nuxt shared module title (text-2xl / 400 / no pad). */}
              <h2
                dir={dirOf(title)}
                className={
                  desktop
                    ? `${DESKTOP_BLOCK_TITLE} text-foreground`
                    : "px-6 text-xl font-bold text-foreground"
                }
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
