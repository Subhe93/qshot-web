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
import { colorValueToCss } from "@/lib/builder/color-value";
import { argbToCss } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import { fontStack, ensureGoogleFonts, DEFAULT_FONT } from "@/lib/builder/google-fonts";
import { cdnUrl } from "@/lib/api/qrcodes";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { useEffect } from "react";
import { Hero } from "./preview/Hero";
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
  const select = useEditorStore((s) => s.select);
  const editHero = useEditorStore((s) => s.editHero);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const moveBlock = useEditorStore((s) => s.moveBlock);
  const preview = useEditorStore((s) => s.previewEnabled);

  // In preview mode, let a mouse drag pan the horizontal block sliders (which
  // otherwise only respond to touch/trackpad). Gated to preview so it never
  // collides with dnd-kit block reordering in edit mode.
  const { ref: dragScrollRef, bind: dragScrollBind } = useDragScroll(preview);

  // The website's own font (mobile default Roboto) — explicit so the preview
  // never falls back to the dashboard font, and loaded so it actually renders.
  const websiteFont = settings.font_family || DEFAULT_FONT;
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

  // Hero + blocks — identical in every frame/mode.
  const content = (
    <>
      {/* Sub-pages have only blocks — no hero/name/bio. In the desktop "full"
          frame the wrapper paints the background, so the hero stays transparent. */}
      {!onPage && (
        <Hero
          settings={settings}
          onEdit={preview ? undefined : editHero}
          transparentBg={deviceWidth === "full"}
        />
      )}
      <div
        className="flex flex-col gap-3 px-4 pb-14 pt-3"
        onClick={preview ? undefined : (e) => e.stopPropagation()}
      >
        {preview ? (
          blocks.map((b) => <PreviewBlock key={b.id} block={b} />)
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((b) => (
                <SortableBlock
                  key={b.id}
                  block={b}
                  selected={selectedId === b.id}
                  onSelect={() => select(b.id)}
                  onDelete={() => removeBlock(b.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {blocks.length === 0 && !preview && (
          <div className="m-6 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            {t("emptyCanvas")}
          </div>
        )}
      </div>
    </>
  );

  // ── Desktop "computer view" — mirrors the Nuxt public site ([slug].vue):
  // a full-bleed page background (image / solid / gradient) or a blurred
  // profile/cover image, with the content centred in a ~940px column. When the
  // background is a blurred image, the column is a translucent dark glass card.
  if (deviceWidth === "full") {
    // Match the Nuxt public desktop layout (pages/[slug].vue + BlurredBackground):
    // a full-bleed BLURRED profile/cover image fills the area AROUND the centred
    // 940px column; the column itself shows the REAL page background — the page
    // colour/gradient when set, else a translucent dark glass card (when only a
    // blur image exists), else the explicit page image.
    const bgImagePath = settings.background?.image || "";
    const blurPath = !bgImagePath
      ? settings.profile_picture?.image_url ||
        settings.cover_photo?.image_url ||
        settings.logo?.image_url ||
        ""
      : "";
    const useBlur = !!blurPath; // blurred backdrop behind/around the column
    const hasColor = !!settings.background?.color_value;
    const glass = useBlur && !hasColor; // dark glass column only when no real colour
    return (
      <div
        className={cn("relative overflow-hidden", fillHeight ? "h-full" : "min-h-[80vh]")}
        style={{ background: bgImagePath ? "#1f1f26" : useBlur ? "#121212" : pageBg }}
      >
        {bgImagePath && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${cdnUrl(bgImagePath)})` }}
          />
        )}
        {useBlur && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnUrl(blurPath)}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={{ filter: "blur(120px)", transform: "scale(1.2)" }}
          />
        )}
        <div
          ref={dragScrollRef}
          {...dragScrollBind}
          className="relative h-full overflow-y-auto"
          onClick={preview ? undefined : () => select(null)}
        >
          {/* The centred 940px column. When the page has a real colour/gradient
              it's painted HERE (matching the phone/tablet preview), with the blur
              showing only around the column. With no colour it's a translucent
              dark glass card (Nuxt behaviour). */}
          <div
            dir="ltr"
            className={cn(
              "builder-preview-isolate mx-auto min-h-full w-full max-w-[58.8rem] overflow-hidden",
              glass && "border border-white/10 bg-zinc-900/80 shadow-md backdrop-blur-3xl md:rounded-xl",
            )}
            style={{ ...siteStyle, background: hasColor ? pageBg : undefined }}
          >
            {content}
          </div>
        </div>
        <FloatingButtonLayer preview={preview} />
      </div>
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
          ref={dragScrollRef}
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
    <div className="rounded-[5px] px-2 py-1.5" style={{ backgroundColor: bg }}>
      <BlockView block={block} />
    </div>
  );
}
