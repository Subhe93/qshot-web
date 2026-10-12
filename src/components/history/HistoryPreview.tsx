"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  historyQueryKeys,
  showHistory,
  toHistoryError,
  type HistoryRow,
} from "@/lib/api/history";
import { historyRowToEditorState } from "@/lib/history/content";
import type { Block } from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";
import { Hero } from "@/components/builder/preview/Hero";
import { BlockView } from "@/components/builder/preview/BlockView";
import { PageBackgroundContext } from "@/components/builder/preview/desktop-preview";
import { BookingProfileContext } from "@/components/builder/preview/booking-context";
import { colorValueToCss, solidArgb } from "@/lib/builder/color-value";
import { argbToCss } from "@/lib/builder/color";
import { DEFAULT_FONT, ensureGoogleFonts, fontStack } from "@/lib/builder/google-fonts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { historyErrorMessage } from "./copy";

/**
 * Read-only phone frame for a stored version — the same `Hero` + `BlockView`
 * renderer and the same contexts BuilderCanvas provides (page background for
 * the adaptive social chip, no booking profile so the booking block draws its
 * placeholder instead of fetching). Prop-driven: it never reads or writes the
 * editor store, so a preview can never leak into a save (§6.4, §7.1).
 */
export function HistoryFrame({
  settings,
  blocks,
  hero,
  width = 390,
  className,
  bodyClassName,
}: {
  settings: WebsiteSettings;
  blocks: Block[];
  /** Main page: the hero sits above the blocks. Sub-pages have none. */
  hero: boolean;
  /** Frame width in px, or `"fill"` to take the column's width. */
  width?: number | "fill";
  className?: string;
  /** Scroll/height classes for the page body (default: a 70vh scroll area). */
  bodyClassName?: string;
}) {
  const websiteFont = settings.font_family || DEFAULT_FONT;
  useEffect(() => {
    ensureGoogleFonts([websiteFont]);
  }, [websiteFont]);

  const fontColorCss = argbToCss(settings.font_color ?? 0xffffffff) ?? "#ffffff";
  const siteStyle = {
    fontFamily: fontStack(websiteFont),
    color: fontColorCss,
    "--foreground": fontColorCss,
    "--muted-foreground": `color-mix(in srgb, ${fontColorCss} 62%, transparent)`,
  } as React.CSSProperties;
  const pageBg = colorValueToCss(settings.background?.color_value) ?? "#1f1f26";
  const pageBgValue = settings.background?.color_value;
  const pageBgArgb =
    pageBgValue && pageBgValue.type === "solid" ? solidArgb(pageBgValue.color) : 0xff000000;

  return (
    <div
      dir="ltr"
      style={{ width: width === "fill" ? undefined : width }}
      className={cn(
        "relative max-w-full overflow-hidden rounded-4xl border border-border bg-white shadow-xl",
        width === "fill" && "w-full",
        className,
      )}
    >
      <div
        className={cn("builder-preview-isolate", bodyClassName ?? "max-h-[70vh] overflow-y-auto")}
        style={{ background: pageBg, ...siteStyle } as React.CSSProperties}
      >
        <PageBackgroundContext.Provider value={pageBgArgb}>
          <BookingProfileContext.Provider value={null}>
            {hero && <Hero settings={settings} />}
            <div className="flex flex-col gap-3 px-4 pb-14 pt-3">
              {blocks.map((b) => (
                <FrameBlock key={b.id} block={b} />
              ))}
            </div>
          </BookingProfileContext.Provider>
        </PageBackgroundContext.Provider>
      </div>
    </div>
  );
}

/** One read-only block — same wrapper as the canvas's preview mode. */
export function FrameBlock({ block }: { block: Block }) {
  // Hidden blocks are removed entirely in preview/live, as on mobile.
  if (block.hide === true) return null;
  const bg =
    "use_background_color" in block && block.use_background_color
      ? argbToCss(block.background_color)
      : undefined;
  return (
    <div data-block-id={block.id} className="rounded-[5px] px-2 py-1.5" style={{ backgroundColor: bg }}>
      <BlockView block={block} />
    </div>
  );
}

/**
 * §6.4 Preview: `show` → the editor model through the builder's own parsers →
 * `HistoryFrame`. Sub-page rows carry no `settings`, so the live site's
 * settings paint the frame (font, colours) around the stored blocks.
 */
export function HistoryPreview({
  profileId,
  row,
  liveSettings,
}: {
  profileId: string;
  row: HistoryRow;
  liveSettings: WebsiteSettings;
}) {
  const t = useTranslations("history");
  const tc = useTranslations("common");
  const query = useQuery({
    queryKey: historyQueryKeys.show(profileId, row.id),
    queryFn: () => showHistory(profileId, row.id),
    staleTime: 60_000,
    retry: false,
  });

  if (query.isPending) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground" role="status">
        <Loader2 className="size-6 animate-spin" />
        <span className="sr-only">{tc("loading")}</span>
      </div>
    );
  }
  if (query.isError) {
    const error = toHistoryError(query.error);
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
        <p>{t("preview.failed")}</p>
        <p className="text-xs">{historyErrorMessage(error, t, tc("genericError"), "row")}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {tc("retry")}
        </Button>
      </div>
    );
  }

  const state = historyRowToEditorState(query.data);
  const settings = state.settings ?? liveSettings;

  // The sheet body is the one scroll area: the frame grows to its content
  // (no inner scroll), and "Restore this version" lives in the sheet footer.
  return (
    <div className="flex flex-col items-center">
      <HistoryFrame
        settings={settings}
        blocks={state.blocks}
        hero={row.pageId === null}
        bodyClassName=""
      />
    </div>
  );
}
