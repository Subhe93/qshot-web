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
import { fontStack, ensureGoogleFonts, DEFAULT_FONT } from "@/lib/builder/google-fonts";
import { useEffect } from "react";
import { Hero } from "./preview/Hero";
import { BlockView } from "./preview/BlockView";
import { SortableBlock } from "./SortableBlock";
import { FloatingButtonLayer } from "./FloatingButtonLayer";

export function BuilderCanvas() {
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

  return (
    <div className="flex justify-center px-4 py-6">
      {/* Phone-width preview — edge-to-edge content, subtle device frame.
          Force LTR so the live preview matches the published website regardless
          of the dashboard's current locale direction (per-text RTL is still
          handled inside blocks via dirOf()). */}
      <div
        dir="ltr"
        className="relative w-[430px] max-w-full overflow-hidden rounded-[2rem] border border-border bg-white shadow-xl"
      >
        <div
          className="builder-preview-isolate max-h-[80vh] overflow-y-auto"
          style={
            {
              // Mobile getBackgroundColor() falls back to AppColors.black; match
              // it so the default (white) font colour never lands on the white
              // frame.
              background:
                colorValueToCss(settings.background?.color_value) ?? "#1f1f26",
              // The website's own font wins over the isolated baseline so both the
              // hero and blocks render in the site font — never the dashboard font.
              fontFamily: fontStack(websiteFont),
              // Website font color (mobile getForegroundColor = font_color ??
              // white) becomes the base text colour AND re-points the dashboard
              // theme tokens (`text-foreground`, `text-muted-foreground`, and
              // their /opacity variants) so EVERY block's text inherits the site
              // colour without touching each block component. NOTE: globals.css
              // uses `@theme inline`, so `text-foreground` compiles to
              // `var(--foreground)` (the underlying token) — override THAT, not
              // `--color-foreground`.
              color: fontColorCss,
              "--foreground": fontColorCss,
              "--muted-foreground": `color-mix(in srgb, ${fontColorCss} 62%, transparent)`,
            } as React.CSSProperties
          }
          onClick={preview ? undefined : () => select(null)}
        >
          {/* Sub-pages have only blocks — no hero/name/bio. In preview, the hero
              is read-only (no onEdit) so its links/buttons launch. */}
          {!onPage && <Hero settings={settings} onEdit={preview ? undefined : editHero} />}

          <div
            className="flex flex-col gap-3 px-4 pb-14 pt-3"
            onClick={preview ? undefined : (e) => e.stopPropagation()}
          >
            {preview ? (
              // Live preview: plain read-only blocks — no outlines, handles, or
              // tap-to-edit; links inside the blocks launch normally.
              blocks.map((b) => <PreviewBlock key={b.id} block={b} />)
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
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

            {/* Empty-canvas hint — hidden in preview (mobile parity). */}
            {blocks.length === 0 && !preview && (
              <div className="m-6 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                {t("emptyCanvas")}
              </div>
            )}
          </div>
        </div>

        {/* Floating action button — editor sheet in edit mode, real launcher in
            preview (mobile FloatingButtonWidget). */}
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
