"use client";

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
} from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/stores/editor-store";
import { colorValueToCss, solidArgb } from "@/lib/builder/color-value";
import { argbToCss } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import { fontStack, ensureGoogleFonts, DEFAULT_FONT } from "@/lib/builder/google-fonts";
import { cdnUrl } from "@/lib/api/qrcodes";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { useCallback, useEffect, useRef } from "react";
import { Hero } from "./preview/Hero";
import { DesktopPreviewContext, PageBackgroundContext } from "./preview/desktop-preview";
import { BlockView } from "./preview/BlockView";
import { SortableBlock } from "./SortableBlock";
import { FloatingButtonLayer } from "./FloatingButtonLayer";

export function BuilderCanvas({
  deviceWidth,
  fillHeight = false,
}: { deviceWidth?: number | "full"; fillHeight?: boolean } = {}) {
  const t = useTranslations("builder");
  const blocks = useEditorStore((s) => s.blocks);
  const settings = useEditorStore((s) => s.settings);
  const onPage = useEditorStore((s) => s.pageId) !== null;
  const selectedId = useEditorStore((s) => s.selectedId);
  const lastAddedId = useEditorStore((s) => s.lastAddedId);
  const select = useEditorStore((s) => s.select);
  const editHero = useEditorStore((s) => s.editHero);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const moveBlock = useEditorStore((s) => s.moveBlock);
  const preview = useEditorStore((s) => s.previewEnabled);

  // In preview mode, let a mouse drag pan the horizontal block sliders (which
  // otherwise only respond to touch/trackpad). Gated to preview so it never
  // collides with dnd-kit block reordering in edit mode.
  const { ref: dragScrollRef, bind: dragScrollBind } = useDragScroll(preview);

  // Compose our own ref onto the scroll container (dragScrollRef is a callback
  // ref, so we can't read its node) — used to auto-scroll to a newly-added block.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      dragScrollRef(node);
    },
    [dragScrollRef],
  );

  // When a block is added, smoothly scroll it into view. Runs in both canvas
  // instances (mobile canvas + desktop preview pane); each scrolls its own
  // container. rAF lets the new block paint before we measure/scroll.
  useEffect(() => {
    if (!lastAddedId) return;
    const container = scrollRef.current;
    if (!container) return;
    let rafId = 0;
    // One frame so the new block has painted, then a CUSTOM smooth scroll — the
    // native scrollIntoView("smooth") is too fast/uncontrollable for short hops,
    // so we animate scrollTop over a fixed duration with easing.
    rafId = requestAnimationFrame(() => {
      const el = container.querySelector<HTMLElement>(
        `[data-block-id="${lastAddedId}"]`,
      );
      if (!el) return;
      const contRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // Center the new block in the scroll container.
      const raw =
        container.scrollTop +
        (elRect.top - contRect.top) -
        (container.clientHeight - elRect.height) / 2;
      const max = container.scrollHeight - container.clientHeight;
      const to = Math.max(0, Math.min(raw, max));
      const from = container.scrollTop;
      const dist = to - from;
      if (Math.abs(dist) < 2) return;

      // Respect reduced-motion.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        container.scrollTop = to;
        return;
      }

      const duration = 650; // ms — deliberate, "scroll-behavior: smooth" feel
      const easeInOut = (p: number) =>
        p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      let startTs = 0;
      const step = (ts: number) => {
        if (!startTs) startTs = ts;
        const p = Math.min((ts - startTs) / duration, 1);
        container.scrollTop = from + dist * easeInOut(p);
        if (p < 1) rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(rafId);
  }, [lastAddedId]);

  // The website's own font (mobile default Roboto) — explicit so the preview
  // never falls back to the dashboard font, and loaded so it actually renders.
  // Desktop "computer" pane mirrors the Nuxt public front, whose default font
  // is Inter (pages/index.vue `font_family || 'Inter'`) — view-only.
  const isDesktop = deviceWidth === "full";
  const websiteFont = settings.font_family || (isDesktop ? "Inter" : DEFAULT_FONT);
  useEffect(() => {
    ensureGoogleFonts([websiteFont]);
  }, [websiteFont]);

  // Website font colour (mobile getForegroundColor = font_color ?? white).
  const fontColorCss = argbToCss(settings.font_color ?? 0xffffffff) ?? "#ffffff";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    if (from !== -1 && to !== -1) moveBlock(from, to);
  }

  // Shared site text styling — the website font + font colour re-points the
  // dashboard theme tokens so every block inherits the site colour.
  const siteStyle = {
    fontFamily: fontStack(websiteFont),
    color: fontColorCss,
    "--foreground": fontColorCss,
    "--muted-foreground": `color-mix(in srgb, ${fontColorCss} 62%, transparent)`,
  } as React.CSSProperties;
  // Mobile getBackgroundColor() falls back to AppColors.black.
  const pageBg = colorValueToCss(settings.background?.color_value) ?? "#1f1f26";

  // Blocks list (shared by the phone canvas and the desktop pane).
  const blocksInner = (
    <>
      {preview ? (
        blocks.map((b) => <PreviewBlock key={b.id} block={b} />)
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((b) => (
              // Thin wrapper carries the scroll anchor — SortableBlock owns the
              // sortable node and doesn't forward arbitrary attributes. A brief
              // highlight on the just-added block draws the user's eye to it.
              <div
                key={b.id}
                data-block-id={b.id}
                className={b.id === lastAddedId ? "animate-block-added" : undefined}
              >
                <SortableBlock
                  block={b}
                  selected={selectedId === b.id}
                  onSelect={() => select(b.id)}
                  onDelete={() => removeBlock(b.id)}
                />
              </div>
            ))}
          </SortableContext>
        </DndContext>
      )}
      {blocks.length === 0 && !preview && (
        <div className="m-6 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {t("emptyCanvas")}
        </div>
      )}
    </>
  );

  // Hero + blocks — identical in every frame/mode (desktop-only extras: Nuxt's
  // decorative spotlight glow above the modules and the section's pb-[20px]).
  // Mobile SettingsEntity.getBackgroundColor(): the solid page color, black for
  // a gradient/image/unset background. Blocks read it via PageBackgroundContext.
  const pageBgValue = settings.background?.color_value;
  const pageBgArgb =
    pageBgValue && pageBgValue.type === "solid"
      ? solidArgb(pageBgValue.color)
      : 0xff000000;

  const content = (
    <PageBackgroundContext.Provider value={pageBgArgb}>
      {/* Sub-pages have only blocks — no hero/name/bio. In the desktop "full"
          frame the wrapper paints the background, so the hero stays transparent. */}
      {!onPage && (
        <Hero
          settings={settings}
          onEdit={preview ? undefined : editHero}
          transparentBg={isDesktop}
          desktop={isDesktop}
        />
      )}
      <div
        className={cn(
          "flex flex-col gap-3 pt-3",
          // Desktop: 12px + the 8px block wrapper = Nuxt's 20px module gutter
          // (Modules.vue `p-5`); phone keeps 16px + 8px.
          isDesktop ? "relative px-3 pb-5" : "px-4 pb-14",
        )}
        onClick={preview ? undefined : (e) => e.stopPropagation()}
      >
        {isDesktop && (
          // Nuxt index.vue spotlight glow above the modules column.
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 left-1/2 size-72 -translate-x-1/2 rounded-full bg-white/25 blur-[120px] lg:size-[32rem] lg:blur-[200px]"
          />
        )}
        {isDesktop ? <div className="relative flex flex-col gap-3">{blocksInner}</div> : blocksInner}
      </div>
    </PageBackgroundContext.Provider>
  );

  // ── Desktop "computer view" — mirrors the Nuxt public site ([slug].vue):
  // a full-bleed page background (image / solid / gradient) or a blurred
  // profile/cover image, with the content centred in a ~940px column. When the
  // background is a blurred image, the column is a translucent dark glass card.
  if (deviceWidth === "full") {
    // Match the Nuxt public desktop layout (pages/index.vue + BlurredBackground):
    // a full-bleed BLURRED profile/cover image fills the area AROUND the centred
    // 940px column. The column SECTION always carries the glass chrome (1px
    // white/10 border, rounded-xl, shadow, backdrop-blur) and its inline
    // background paints over the translucent zinc: the page image (bg-fixed,
    // confined to the column), the page colour/gradient, or the forced-black
    // fallback (index.vue writes color_value 000000 when absent).
    const bgImagePath = settings.background?.image || "";
    const blurPath = !bgImagePath
      ? settings.profile_picture?.image_url ||
        settings.cover_photo?.image_url ||
        settings.logo?.image_url ||
        ""
      : "";
    const useBlur = !!blurPath; // blurred backdrop behind/around the column
    const desktopPageBg = colorValueToCss(settings.background?.color_value) ?? "rgb(0, 0, 0)";
    return (
      <DesktopPreviewContext.Provider value={true}>
      <div
        className={cn("relative overflow-hidden", fillHeight ? "h-full" : "min-h-[80vh]")}
        style={{ background: bgImagePath ? "#1f1f26" : useBlur ? "#121212" : desktopPageBg }}
      >
        {useBlur && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnUrl(blurPath)}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={{ filter: "blur(128px)", transform: "scale(1.2)" }}
          />
        )}
        <div
          ref={setScrollRef}
          {...dragScrollBind}
          className="relative h-full overflow-y-auto"
          onClick={preview ? undefined : () => select(null)}
        >
          <div
            dir="ltr"
            className="builder-preview-isolate builder-preview-desktop mx-auto min-h-full w-full max-w-[58.8rem] overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 shadow-md backdrop-blur-3xl"
            style={{
              ...siteStyle,
              ...(bgImagePath
                ? {
                    backgroundImage: `url(${cdnUrl(bgImagePath)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundAttachment: "fixed",
                  }
                : { background: desktopPageBg }),
            }}
          >
            {content}
          </div>
        </div>
        <FloatingButtonLayer preview={preview} />
      </div>
      </DesktopPreviewContext.Provider>
    );
  }

  // ── Phone / tablet — device frame (also the mobile canvas, unchanged) ──
  return (
    <div className={cn("flex justify-center px-4 py-6", fillHeight && "h-full py-4")}>
      {/* Force LTR so the live preview matches the published website regardless of
          the dashboard locale direction (per-text RTL handled inside blocks). */}
      <div
        dir="ltr"
        style={{ width: deviceWidth ?? 430 }}
        className={cn(
          "relative max-w-full overflow-hidden border border-border bg-white shadow-xl",
          fillHeight && "flex h-full flex-col",
          deviceWidth && deviceWidth > 480 ? "rounded-2xl" : "rounded-4xl",
        )}
      >
        <div
          ref={setScrollRef}
          {...dragScrollBind}
          className={cn(
            "builder-preview-isolate overflow-y-auto",
            fillHeight ? "flex-1" : "max-h-[80vh]",
          )}
          style={{ background: pageBg, ...siteStyle } as React.CSSProperties}
          onClick={preview ? undefined : () => select(null)}
        >
          {content}
        </div>
        <FloatingButtonLayer preview={preview} />
      </div>
    </div>
  );
}

/** Read-only block in preview mode — same per-block background as SortableBlock. */
function PreviewBlock({ block }: { block: import("@/lib/types/blocks").Block }) {
  // Mobile removes hidden blocks entirely in preview/live.
  if (block.hide === true) return null;
  const bg =
    "use_background_color" in block && block.use_background_color
      ? argbToCss(block.background_color)
      : undefined;
  return (
    <div
      data-block-id={block.id}
      className="rounded-[5px] px-2 py-1.5"
      style={{ backgroundColor: bg }}
    >
      <BlockView block={block} />
    </div>
  );
}
