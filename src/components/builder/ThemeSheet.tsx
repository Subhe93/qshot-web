"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, Pipette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ColorPickerPanel } from "@/components/ui/color-picker";
import { argbToCss } from "@/lib/builder/color";
import { primaryArgb, solid } from "@/lib/builder/color-value";
import { heroStyleFlags } from "@/lib/builder/hero-defaults";
import {
  createFromTemplate,
  restyleWithTemplate,
  type TemplateApplyResult,
} from "@/lib/builder/template-apply";
import {
  onColorFor,
  paletteFromBrand,
  type TemplatePalette,
} from "@/lib/builder/template-palette";
import {
  WEBSITE_TEMPLATES,
  websiteTemplateOf,
  type TemplateTranslator,
  type WebsiteTemplate,
} from "@/lib/builder/website-templates";
import { useEditorStore, type EditorSnapshot } from "@/stores/editor-store";
import { cn } from "@/lib/utils";

/**
 * The Theme bottom sheet — port of the mobile `theme_sheet.dart`: pick a
 * template (top) and a brand color (bottom). Every tap LIVE-previews by
 * pushing the resolved blocks+settings into the editor store; nothing is
 * committed until Apply — closing without applying restores the snapshot
 * taken when the sheet opened (mobile: `putPreview` + `editable(null)`).
 *
 * The barrier is transparent so the canvas behind stays visible (mobile
 * `barrierColor: Colors.transparent`); max height is 70vh.
 */
export function ThemeSheet({
  onClose,
  onApplied,
}: {
  /** Closed without applying (the open-time snapshot is already restored). */
  onClose: () => void;
  /** A template was committed; `undoSnapshot` restores the pre-apply state. */
  onApplied: (undoSnapshot: EditorSnapshot) => void;
}) {
  const t = useTranslations("builder.templates");
  const tc = useTranslations("common");
  const applyTemplate = useEditorStore((s) => s.applyTemplate);
  const restoreSnapshot = useEditorStore((s) => s.restoreSnapshot);
  const markSaved = useEditorStore((s) => s.markSaved);

  // Open-time snapshot — the cubit's `_webpage`/`_settings`: resolve() always
  // starts from it (the live store holds preview state while the sheet is
  // open), and it is what closing-without-apply restores.
  const [snapshot] = useState<EditorSnapshot>(() =>
    useEditorStore.getState().takeSnapshot(),
  );
  const [wasDirty] = useState(() => useEditorStore.getState().dirty);

  /** A fresh site gets the starter composition; an existing one is restyled. */
  const isNewSite = snapshot.blocks.length === 0;

  const [template, setTemplate] = useState<WebsiteTemplate | null>(() =>
    websiteTemplateOf(snapshot.settings.template?.id),
  );
  // The user's explicit pick this session (mobile `_brandColor`), else the
  // stored ref's color from the snapshot (normalized unsigned, like toARGB32).
  const [picked, setPicked] = useState<number | null>(() => {
    const c = snapshot.settings.template?.brand_color;
    return c == null ? null : c >>> 0;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Mobile `brandColor` fallback chain.
  const brandColor =
    picked ??
    template?.defaultBrandColor ??
    WEBSITE_TEMPLATES[0].defaultBrandColor;

  const translator: TemplateTranslator = (key) => t(`sections.${key}`);

  function resolve(tpl: WebsiteTemplate, color: number): TemplateApplyResult {
    if (isNewSite) return createFromTemplate(tpl, color, translator);
    return restyleWithTemplate(tpl, snapshot.blocks, snapshot.settings, color);
  }

  function preview(tpl: WebsiteTemplate, color: number) {
    const r = resolve(tpl, color);
    applyTemplate(r.blocks, r.settings);
  }

  function selectTemplate(tpl: WebsiteTemplate) {
    setTemplate(tpl);
    preview(tpl, picked ?? tpl.defaultBrandColor);
  }

  function selectBrandColor(color: number) {
    setPicked(color);
    if (template) preview(template, color);
  }

  // Dismiss without applying: put back what the site looked like on open.
  function cancel() {
    restoreSnapshot(snapshot);
    if (!wasDirty) markSaved();
    onClose();
  }

  function commit() {
    if (!template) return;
    const r = resolve(template, brandColor);
    applyTemplate(r.blocks, r.settings);
    onApplied(snapshot);
  }

  function apply() {
    if (!template) return;
    if (isNewSite) {
      commit();
      return;
    }
    setConfirmOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ConfirmDialog / the color picker handle their own dismissal.
      if (e.key === "Escape" && !confirmOpen && !pickerOpen) cancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmOpen, pickerOpen]);

  const swatches =
    template?.suggestedColors ?? WEBSITE_TEMPLATES[0].suggestedColors;
  const customSelected = !swatches.includes(brandColor);

  return createPortal(
    <>
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center"
      onMouseDown={cancel}
    >
      {/* Transparent barrier — the canvas behind live-previews the theme. */}
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-sheet-up relative flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-t-[20px] bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.25)] sm:rounded-t-[20px]"
      >
        {/* Grab handle */}
        <div className="flex shrink-0 justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
        </div>

        {pickerOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <ColorPickerPanel
              value={solid(brandColor)}
              showAlpha={false}
              onApply={(v) => {
                setPickerOpen(false);
                selectBrandColor(primaryArgb(v));
              }}
              onCancel={() => setPickerOpen(false)}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {/* Header */}
            <div className="flex items-start gap-2 px-5 pt-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-foreground">
                  {t("choose")}
                </h2>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/80">
                  {t("theme")}
                </p>
              </div>
              {isNewSite ? (
                // A brand-new site: no X — dismissing means "Start Blank".
                <button
                  type="button"
                  onClick={cancel}
                  className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  {t("startBlank")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancel}
                  aria-label={tc("cancel")}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/15"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>

            {/* Template cards */}
            <div className="mt-3 flex gap-3 overflow-x-auto px-5 py-1">
              {WEBSITE_TEMPLATES.map((tpl) => {
                const selected = template?.id === tpl.id;
                const palette = paletteFromBrand(
                  selected ? brandColor : tpl.defaultBrandColor,
                );
                return (
                  <TemplateCard
                    key={tpl.id}
                    name={t(`names.${tpl.id}`)}
                    template={tpl}
                    palette={palette}
                    selected={selected}
                    onClick={() => selectTemplate(tpl)}
                  />
                );
              })}
            </div>

            {/* Brand color */}
            <div className="mt-4 px-5">
              <p className="text-sm font-semibold text-foreground">
                {t("brandColor")}
              </p>
              <div className="mt-2.5 flex items-center gap-2.5">
                {swatches.map((color) => {
                  const selected = brandColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => selectBrandColor(color)}
                      aria-label={argbToCss(color)}
                      aria-pressed={selected}
                      className={cn(
                        "flex size-[38px] shrink-0 items-center justify-center rounded-full border-[3px] transition-all",
                        selected ? "border-primary" : "border-transparent",
                      )}
                      style={{ backgroundColor: argbToCss(color) }}
                    >
                      {selected && <Check className="size-4 text-white" />}
                    </button>
                  );
                })}
                {/* Custom color (eyedropper) — "selected" when the current
                    brand color is not one of the suggested swatches. */}
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  aria-label={t("customColor")}
                  className={cn(
                    "flex size-[38px] shrink-0 items-center justify-center rounded-full transition-all",
                    customSelected
                      ? "border-[3px] border-primary"
                      : "border border-foreground/30",
                  )}
                  style={{
                    backgroundColor: customSelected
                      ? argbToCss(brandColor)
                      : "transparent",
                  }}
                >
                  <Pipette
                    className="size-3.5"
                    style={{
                      color: customSelected
                        ? argbToCss(onColorFor(brandColor))
                        : "var(--foreground)",
                    }}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Apply — only once a template is selected. */}
        {!pickerOpen && template && (
          <div className="shrink-0 px-5 pb-5 pt-2">
            <Button
              variant="gradient"
              className="w-full rounded-2xl"
              onClick={apply}
            >
              {t("apply")}
            </Button>
          </div>
        )}
      </div>
    </div>

    {/* Sibling of the sheet wrapper so its backdrop clicks don't bubble into
        the wrapper's dismiss handler through the React tree. */}
    <ConfirmDialog
      open={confirmOpen}
      title={t("title")}
      message={t("switchMessage")}
      confirmText={t("apply")}
      cancelText={tc("cancel")}
      type="warning"
      onConfirm={() => {
        setConfirmOpen(false);
        commit();
      }}
      onCancel={() => setConfirmOpen(false)}
    />
    </>,
    document.body,
  );
}

// ─── Schematic template card ───────────────────────────────────────────────
// Self-contained preview: hero structure from the style's flags, colors from
// the live palette — cards recolor instantly when the user taps a swatch.

function TemplateCard({
  name,
  template,
  palette,
  selected,
  onClick,
}: {
  name: string;
  template: WebsiteTemplate;
  palette: TemplatePalette;
  selected: boolean;
  onClick: () => void;
}) {
  const flags = heroStyleFlags(template.heroStyle);
  return (
    <button type="button" onClick={onClick} className="shrink-0">
      <div
        className="m-[3px] flex h-[176px] w-[118px] flex-col items-center overflow-hidden rounded-[14px]"
        style={{
          backgroundColor: argbToCss(palette.surface),
          boxShadow: selected
            ? "0 0 0 3px var(--primary)"
            : `0 0 0 1px ${argbToCss(palette.outline)}`,
        }}
      >
        {/* Cover strip (every template hero style has a cover). */}
        <div
          className="flex h-[52px] w-full items-end justify-center"
          style={{ backgroundColor: argbToCss(palette.primarySoft) }}
        >
          {flags.hasProfileImage && (
            <span
              className="size-6 rounded-full border-2"
              style={{
                backgroundColor: argbToCss(palette.primary),
                borderColor: argbToCss(palette.card),
              }}
            />
          )}
        </div>
        <div className="h-2.5" />
        {flags.hasTitle && (
          <span
            className="h-[7px] w-16 rounded"
            style={{ backgroundColor: argbToCss(palette.onSurface) }}
          />
        )}
        {flags.hasText && (
          <span
            className="mt-[5px] h-[5px] w-[84px] rounded"
            style={{ backgroundColor: argbToCss(palette.outline) }}
          />
        )}
        {flags.hasButton1 && (
          <div className="mt-2 flex items-center justify-center gap-[5px]">
            <span
              className="h-[11px] w-[30px] rounded-md"
              style={{ backgroundColor: argbToCss(palette.primary) }}
            />
            {flags.hasButton2 && (
              <span
                className="h-[11px] w-[30px] rounded-md"
                style={{ backgroundColor: argbToCss(palette.primarySoft) }}
              />
            )}
          </div>
        )}
        <div className="flex-1" />
        <BlockRow palette={palette} />
        <div className="h-1.5" />
        <BlockRow palette={palette} />
        <div className="h-2.5" />
      </div>
      <p
        className={cn(
          "mt-1.5 max-w-[124px] truncate text-center text-xs text-foreground",
          selected ? "font-bold" : "font-medium",
        )}
      >
        {name}
      </p>
    </button>
  );
}

function BlockRow({ palette }: { palette: TemplatePalette }) {
  return (
    <span
      className="h-[22px] w-[94px] shrink-0 rounded-md"
      style={{
        backgroundColor: argbToCss(palette.card),
        boxShadow: `inset 0 0 0 1px ${argbToCss(palette.outline)}`,
      }}
    />
  );
}
