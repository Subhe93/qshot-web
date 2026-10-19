"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Music } from "lucide-react";
import type { MusicLinksBlock } from "@/lib/types/blocks";
import { musicPlatformName } from "@/lib/music-links/platforms";
import {
  readMusicRenderBlock,
  type MusicRenderLink,
  type MusicRenderTrack,
} from "@/lib/music-links/render";
import { dirOf } from "@/lib/builder/text-direction";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";
import { MusicPlatformIcon } from "@/components/music/MusicPlatformIcon";
import { Foldable } from "../Foldable";
import { useDesktopPreview, DESKTOP_BLOCK_TITLE } from "../desktop-preview";

/**
 * Preview of a `MusicLinksModule` ("Songs", docs/api-contract.en.md §8),
 * rendered from the page JSON ONLY — never a `music-links/*` call (§10.2).
 *
 * A 1:1 port of the Nuxt public renderer (components/MusicLinksModule/** in
 * the Nuxt repo) so the owner sees what visitors see — same structure, sizes,
 * radii and `color-mix(currentColor …)` surfaces:
 *  - `cards` — one card per song (12px radius, 12px padding): 72px cover +
 *              title / artist, then wrapping pills (36px, icon 22) or icon
 *              buttons (40px, icon 30). One column at every width;
 *  - `list`  — rows (10px padding): 56px cover, title / artist on one line,
 *              then ONE horizontally scrolling row of compact buttons
 *              (pills 32px / icon 20, or icon buttons 34px / icon 26);
 *  - `grid`  — 2 columns: full-width square cover, title / artist, then
 *              compact icon-only buttons (button_style ignored, as on Nuxt).
 * A cover with a `preview_url` carries the play glyph (centred 28px disc on
 * covers ≤ 64px, a 32px corner disc otherwise; a 36px standalone disc when
 * covers are off). Static here — the builder plays no audio.
 *
 * Skipping rules = the Nuxt reader (lib/music-links/render.ts): hidden songs /
 * links, unknown platforms, non-https URLs, and songs left with neither a
 * button nor a preview clip. Platform names: English — the Nuxt page shows the
 * Arabic names only to a visitor who switched the page to Arabic, never by
 * default, and never by the owner's dashboard language.
 *
 * Taps: edit mode — the canvas wrapper is `pointer-events-none`, so a tap opens
 * the settings sheet; preview mode — each button opens its URL in a new tab.
 *
 * Empty: a placeholder "Add your songs" in edit mode, nothing in preview (the
 * published page drops the whole block, title included).
 *
 * Spacing identity: items `gap-2` phone / `gap-4` desktop; the 20px edge inset
 * comes from the canvas + block wrapper — never from this view. Every colour is
 * the page font colour (`currentColor`), except the play disc drawn on a cover.
 */

/** `color-mix(in srgb, currentColor p%, transparent)` — the Nuxt surfaces. */
function mix(percent: number): string {
  return `color-mix(in srgb, currentColor ${percent}%, transparent)`;
}

const SURFACE: CSSProperties = {
  backgroundColor: mix(8),
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};

export function MusicLinksBlockView({ block }: { block: MusicLinksBlock }) {
  const desktop = useDesktopPreview();
  const previewEnabled = useEditorStore((s) => s.previewEnabled);
  const t = useTranslations("musicLinks");
  const title = block.title ?? "";
  const view = readMusicRenderBlock(block);

  // Published page / preview: a block with nothing to show renders nothing (§8).
  if (view.tracks.length === 0 && previewEnabled) return null;

  return (
    <div className="py-2" data-testid="music-block" data-layout={view.layout}>
      <Foldable
        foldable={block.foldable === true}
        header={
          title ? (
            <h2
              dir={dirOf(title)}
              className={desktop ? `${DESKTOP_BLOCK_TITLE} text-foreground` : "px-6 text-xl font-bold text-foreground"}
            >
              {title}
            </h2>
          ) : null
        }
      >
        <div className={title ? "pt-2" : undefined}>
          {view.tracks.length === 0 ? (
            <div
              data-testid="music-placeholder"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-sm font-medium"
              style={{ borderColor: mix(25), color: mix(60) }}
            >
              <Music className="size-6" />
              {t("placeholder")}
            </div>
          ) : (
            <Body
              layout={view.layout}
              tracks={view.tracks}
              showCover={view.showCover}
              buttonStyle={view.buttonStyle}
              interactive={previewEnabled}
            />
          )}
        </div>
      </Foldable>
    </div>
  );
}

function Body({
  layout,
  tracks,
  showCover,
  buttonStyle,
  interactive,
}: {
  layout: "list" | "grid" | "cards";
  tracks: MusicRenderTrack[];
  showCover: boolean;
  buttonStyle: "icon" | "iconText";
  interactive: boolean;
}) {
  const desktop = useDesktopPreview();
  // Unified item gap: 8px on the phone, 16px on the desktop pane.
  const gap = desktop ? "gap-4" : "gap-2";

  if (layout === "list") {
    return (
      <div className={cn("flex w-full flex-col", gap)}>
        {tracks.map((tr) => (
          <div
            key={tr.key}
            data-testid="music-song"
            className="flex items-center gap-3 rounded-xl p-2.5"
            style={SURFACE}
          >
            <Cover src={tr.cover} show={showCover} size={56} preview={tr.preview} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <TrackText title={tr.title} artist={tr.artist} lines={1} />
              <PlatformButtons
                links={tr.links}
                variant={buttonStyle}
                interactive={interactive}
                scroll
                compact
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className={cn("grid w-full grid-cols-2", gap)}>
        {tracks.map((tr) => (
          <div
            key={tr.key}
            data-testid="music-song"
            className="flex min-w-0 flex-col gap-2.5 rounded-xl p-2.5"
            style={SURFACE}
          >
            <Cover src={tr.cover} show={showCover} size={null} preview={tr.preview} />
            <TrackText title={tr.title} artist={tr.artist} />
            <div className="flex-1" />
            <PlatformButtons links={tr.links} variant="icon" interactive={interactive} compact />
          </div>
        ))}
      </div>
    );
  }

  // cards (default — an unknown layout already reads as cards)
  return (
    <div className={cn("flex w-full flex-col", gap)}>
      {tracks.map((tr) => (
        <div
          key={tr.key}
          data-testid="music-song"
          className="flex flex-col gap-3 rounded-xl p-3"
          style={SURFACE}
        >
          <div className="flex items-center gap-3">
            <Cover src={tr.cover} show={showCover} size={72} preview={tr.preview} />
            <TrackText className="flex-1" title={tr.title} artist={tr.artist} />
          </div>
          <PlatformButtons links={tr.links} variant={buttonStyle} interactive={interactive} />
        </div>
      ))}
    </div>
  );
}

// ─── Cover + play glyph (Nuxt Cover.vue / PlayGlyph.vue / Note.vue) ─────────

function NoteGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden focusable="false">
      <path d="M9 17.5a3 3 0 1 1-2-2.83V5.6a1 1 0 0 1 .76-.97l10-2.5A1 1 0 0 1 19 3.1v11.4a3 3 0 1 1-2-2.83V6.28l-8 2v9.22Z" />
    </svg>
  );
}

function PlayGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M8 4.8v14.4a.8.8 0 0 0 1.22.68l11.2-7.2a.8.8 0 0 0 0-1.36L9.22 4.12A.8.8 0 0 0 8 4.8Z" />
    </svg>
  );
}

function Cover({
  src,
  show,
  size,
  preview,
}: {
  src: string | null;
  show: boolean;
  /** Side in px; null = fill the tile's width (grid). */
  size: number | null;
  preview: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = src && failed !== src ? src : null;
  const small = size != null && size <= 64;

  if (!show) {
    if (!preview) return null;
    // No cover: the play disc stands in its place, in the page's text colour.
    return (
      <span
        data-testid="music-play"
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: mix(12) }}
      >
        <PlayGlyph size={16} />
      </span>
    );
  }

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-[10px]", size == null && "aspect-square w-full")}
      style={{
        backgroundColor: mix(10),
        ...(size != null ? { width: size, height: size } : null),
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image}
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(image)}
          className="block size-full select-none object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center" style={{ color: mix(45) }} aria-hidden>
          <NoteGlyph size={size != null ? Math.round(size * 0.4) : 40} />
        </div>
      )}
      {preview && (
        <span
          data-testid="music-play"
          aria-hidden
          className={cn(
            "absolute inline-flex items-center justify-center rounded-full text-white",
            small ? "inset-0 m-auto size-7" : "bottom-1.5 right-1.5 size-8",
          )}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          <PlayGlyph size={small ? 14 : 16} />
        </span>
      )}
    </div>
  );
}

// ─── Title + artist (Nuxt TrackText.vue) ─────────────────────────────────────

/**
 * Each text keeps its own direction (`<bdi dir="auto">`) while the line box
 * aligns to the block's start edge — the canvas is pinned to LTR, as the
 * default published page is, so that is the left edge.
 */
function TrackText({
  title,
  artist,
  lines = 2,
  className,
}: {
  title: string;
  artist: string;
  lines?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {title && (
        <div
          className={cn(
            "text-left text-[15px] font-semibold leading-[1.3] [overflow-wrap:anywhere]",
            lines === 1 ? "truncate" : "line-clamp-2",
          )}
          style={{ color: mix(90) }}
        >
          <bdi dir="auto">{title}</bdi>
        </div>
      )}
      {artist && (
        <div className="mt-0.5 truncate text-left text-[13px] leading-[1.3]" style={{ color: mix(60) }}>
          <bdi dir="auto">{artist}</bdi>
        </div>
      )}
    </div>
  );
}

// ─── Platform buttons (Nuxt PlatformButtons.vue / PlatformIcon.vue) ─────────

function PlatformButtons({
  links,
  variant,
  interactive,
  scroll = false,
  compact = false,
}: {
  links: MusicRenderLink[];
  variant: "icon" | "iconText";
  interactive: boolean;
  /** One row that scrolls sideways instead of wrapping (list rows). */
  scroll?: boolean;
  /** Smaller buttons (list rows, grid tiles). */
  compact?: boolean;
}) {
  if (links.length === 0) return null;
  const withText = variant === "iconText";
  const iconSize = withText ? (compact ? 20 : 22) : compact ? 26 : 30;
  const buttonClass = withText
    ? cn(
        "inline-flex shrink-0 items-center rounded-full no-underline",
        compact ? "h-8 gap-1.5 ps-1.5 pe-3" : "h-9 gap-2 ps-[7px] pe-3.5",
      )
    : cn(
        "inline-flex shrink-0 items-center justify-center no-underline",
        compact ? "size-[34px] rounded-[10px]" : "size-10 rounded-xl",
      );
  const buttonStyle: CSSProperties = { color: "inherit", backgroundColor: mix(10) };

  return (
    <div
      data-testid="music-buttons"
      className={cn(
        "flex gap-2",
        scroll
          ? "-m-[3px] flex-nowrap overflow-x-auto p-[3px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] rtl:[mask-image:linear-gradient(to_left,#000_calc(100%-28px),transparent)]"
          : "flex-wrap",
      )}
    >
      {links.map((link) => {
        // The published page's default names (Nuxt: Arabic only for a visitor
        // who switched the page to Arabic).
        const name = musicPlatformName(link.platform, "en");
        const inner = (
          <>
            <span
              aria-hidden
              className="inline-flex shrink-0 overflow-hidden"
              style={{ width: iconSize, height: iconSize, borderRadius: Math.round(iconSize * 0.24) }}
            >
              <MusicPlatformIcon id={link.platform} size={iconSize} />
            </span>
            {withText && (
              <span
                dir="auto"
                className="whitespace-nowrap text-[13px] font-medium leading-none"
                style={{ color: mix(85) }}
              >
                {name}
              </span>
            )}
          </>
        );
        return interactive ? (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={name}
            aria-label={withText ? undefined : name}
            data-testid="music-link"
            data-platform={link.platform}
            className={buttonClass}
            style={buttonStyle}
          >
            {inner}
          </a>
        ) : (
          <span
            key={link.id}
            title={name}
            data-testid="music-link"
            data-platform={link.platform}
            className={buttonClass}
            style={buttonStyle}
          >
            {inner}
          </span>
        );
      })}
    </div>
  );
}
