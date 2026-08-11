"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { argbToCss } from "@/lib/builder/color";
import { colorValueToCss, solidArgb } from "@/lib/builder/color-value";
import {
  DEFAULT_FONT,
  ensureGoogleFonts,
  fontStack,
} from "@/lib/builder/google-fonts";
import {
  createFromTemplateSite,
  loadTemplateSites,
  restyleWithTemplateSite,
  storedTemplateSite,
  templateAccentColor,
  templateSiteLabel,
  type TemplateSite,
} from "@/lib/builder/website-templates";
import { useEditorStore, type EditorSnapshot } from "@/stores/editor-store";
import { cn } from "@/lib/utils";
import { Hero } from "./preview/Hero";
import { BlockView } from "./preview/BlockView";
import { PageBackgroundContext } from "./preview/desktop-preview";

/**
 * The Theme bottom sheet — port of the mobile `theme_sheet.dart` +
 * `theme_settings_cubit.dart` on branch `origin/feature/template-sites`
 * (commits ef5c94ed, 2dcf9a64, 1cd35b2e).
 *
 * TEMPLATES v2: a template is a whole curated SITE (data + style), not a bag
 * of style knobs. Picking one LIVE-previews the full result through the
 * store's EPHEMERAL `previewOverlay` (mobile `editor.putPreview`): the real
 * blocks/settings — the only thing dirty/auto-save/manual save ever read —
 * are untouched until Apply, and closing simply drops the overlay. Apply on
 * an existing site first asks whether the user's content survives
 * (ContentChoiceDialog): keep → restyle, replace → the template's stubs.
 *
 * BRAND COLOR: mobile defers the brand-color selector to phase 2 — templates
 * keep their authored colors, and the contract change of 2026-08-05 REMOVED
 * `settings.template.brand_color` entirely (the stamp is now `{id}` alone).
 * The swatch row + eyedropper this sheet used to show are therefore GONE.
 * `templateAccentColor(site)` survives as a pure presentation helper: the dot
 * beside each card's name. `template-palette.ts` is dormant (see its header).
 *
 * BROWSABLE PREVIEW: unlike the mobile modal, this sheet never blocks the
 * canvas. There is NO barrier at all — on mobile the wrapper is
 * pointer-events-none (only the sheet itself is interactive), and on desktop
 * `docked` renders it INSIDE the edit-panel column, leaving the phone preview
 * completely uncovered. The user scrolls the live-previewed site freely and
 * only then presses Apply; BuilderCanvas is put in `browseOnly` mode meanwhile
 * so browsing can't open block editors over the preview state. The cost of
 * losing the barrier is click-outside-to-dismiss — X / Start Blank / Escape
 * remain the (only) ways out.
 */
export function ThemeSheet({
  onClose,
  onApplied,
  docked = false,
}: {
  /** Closed without applying (the open-time snapshot is already restored). */
  onClose: () => void;
  /** A template was committed; `undoSnapshot` restores the pre-apply state. */
  onApplied: (undoSnapshot: EditorSnapshot) => void;
  /**
   * Render as a panel filling the desktop sidebar column (position: absolute
   * against its nearest positioned ancestor) instead of the floating bottom
   * sheet. The host places it; the sheet only fills.
   */
  docked?: boolean;
}) {
  const t = useTranslations("builder.templates");
  const tc = useTranslations("common");
  const applyTemplate = useEditorStore((s) => s.applyTemplate);
  const setPreviewOverlay = useEditorStore((s) => s.setPreviewOverlay);
  const clearPreviewOverlay = useEditorStore((s) => s.clearPreviewOverlay);

  // Open-time snapshot — the cubit's `_webpage`/`_settings`: what resolve()
  // starts from. Since previews live in the OVERLAY, the real store fields no
  // longer change while the sheet is open, so this is a plain convenience
  // capture, not the fragile restore point it used to be.
  const [snapshot] = useState<EditorSnapshot>(() =>
    useEditorStore.getState().takeSnapshot(),
  );

  /** A fresh site gets the template's data+style; an existing one is restyled. */
  const isNewSite = snapshot.blocks.length === 0;

  // `cubit.templates` — null while the bundled snapshots load (the sheet opens
  // immediately and shows a spinner; the fetch never blocks the animation).
  const [sites, setSites] = useState<TemplateSite[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [template, setTemplate] = useState<TemplateSite | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Mobile 9b8985dd: the bottom sheet can collapse to its header strip so the
  // previewed site behind is fully visible. Docked (desktop) never needs it —
  // the panel doesn't cover the preview in the first place.
  const [collapsed, setCollapsed] = useState(false);

  /**
   * Mobile `ThemeSettingsCubit.resolve(keepContent)`: `keepContent` answers
   * the "use your own content?" prompt — true keeps the user's blocks and only
   * restyles them; false takes the template's sample content, which is
   * destructive. A new site has nothing to keep, so it always creates.
   */
  function resolve(site: TemplateSite, keepContent = true) {
    if (isNewSite || !keepContent)
      return createFromTemplateSite(site, snapshot.settings);
    return restyleWithTemplateSite(site, snapshot.blocks, snapshot.settings);
  }

  // Live preview goes to the OVERLAY (mobile `editor.putPreview`) — the real
  // blocks/settings, dirty flag and auto-save never see it, so no close path
  // can accidentally persist a template that was only being looked at.
  //
  // DELIBERATE divergence from mobile: mobile previews `resolve()` (restyle —
  // the user's own content in the template's style), which made the user's
  // cover photo look "stuck" across every template while browsing. Here the
  // preview always shows the template's own sample content (`keepContent:
  // false` → create), so each card previews as designed; whether the user's
  // content survives is decided at APPLY time by the ContentChoiceDialog.
  function preview(site: TemplateSite) {
    setPreviewOverlay(resolve(site, false));
  }

  /**
   * Mobile `ThemeSettingsCubit._load()`: await the registry, restore the site's
   * stored selection, and — for a BRAND-NEW site with no stored template —
   * pre-select AND pre-preview the FIRST template (the `TEMPLATE_SITE_LABELS`
   * order), so the user sees a filled site instead of an empty one.
   *
   * `settings.template.id` may be NULL (contract change: a user with their own
   * custom design is not forced to hold a template). `storedTemplateSite`
   * resolves null/undefined/unknown alike to "nothing selected" — so an
   * EXISTING site (it has blocks) opens the sheet with no card selected, no
   * live preview pushed, and no Apply button, exactly as a site carrying an
   * unknown id does. Only `isNewSite` (zero blocks) still auto-selects, and
   * that is deliberately keyed on emptiness rather than on the template key:
   * an empty page has no design to protect, and the auto-preview is reverted
   * by `cancel()` / "Start Blank" anyway.
   *
   * `isCurrent` guards against a resolve landing after the sheet closed (and
   * against React's dev double-effect); the registry itself is cached, so the
   * second call is a no-op.
   */
  function load(isCurrent: () => boolean) {
    loadTemplateSites()
      .then((list) => {
        if (!isCurrent()) return;
        setSites(list);
        setLoadError(false);
        const stored = storedTemplateSite(list, snapshot.settings.template?.id);
        if (stored != null) {
          setTemplate(stored);
          return;
        }
        if (isNewSite && list.length > 0) {
          setTemplate(list[0]);
          preview(list[0]);
        }
      })
      .catch(() => {
        if (isCurrent()) setLoadError(true);
      });
  }

  useEffect(() => {
    let cancelled = false;
    load(() => !cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Last line of defence: if the sheet unmounts through ANY path (route
  // change, layout switch), the ephemeral preview dies with it. Commit clears
  // the overlay itself first, so this is a no-op on the apply path.
  useEffect(() => {
    return () => useEditorStore.getState().clearPreviewOverlay();
  }, []);

  /** Mobile `cubit.selectTemplate` — select + live preview, no commit. */
  function selectTemplate(site: TemplateSite) {
    setTemplate(site);
    preview(site);
  }

  // Dismiss without applying ("Start Blank" on a new site): dropping the
  // overlay IS the whole revert — the real state was never touched (mobile
  // `_closeThemePanel(null)` → `editable(null)`).
  function cancel() {
    clearPreviewOverlay();
    onClose();
  }

  /** Commit for real. `keepContent` per the choice dialog; see resolve(). */
  function commit(keepContent: boolean) {
    if (!template) return;
    const r = resolve(template, keepContent);
    clearPreviewOverlay();
    // Undo snapshot from the REAL state, after the overlay is gone — mobile
    // takes `undoWebpage/undoSettings` the same way, right before putWebpage.
    const undo = useEditorStore.getState().takeSnapshot();
    applyTemplate(r.blocks, r.settings);
    onApplied(undo);
  }

  // Mobile `_apply`: a new site has no content to lose — apply straight away.
  // An existing site decides its content's fate in the choice dialog.
  function apply() {
    if (!template) return;
    if (isNewSite) {
      commit(true);
      return;
    }
    setConfirmOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ConfirmDialog handles its own dismissal.
      if (e.key === "Escape" && !confirmOpen) cancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmOpen]);

  /**
   * Card title. `TEMPLATE_SITE_LABELS` (via `templateSiteLabel`) is the
   * app-side English source of truth and the ORDER of the picker; the web
   * builder is 9-locale, so a localized `names.<id>` wins when present.
   */
  function labelFor(site: TemplateSite): string {
    const key = `names.${site.id}`;
    return t.has(key) ? t(key) : templateSiteLabel(site);
  }

  // ── Shared pieces, composed differently per hosting ──

  const header = (
    <div className="flex shrink-0 items-start gap-2 px-5 pt-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-foreground">{t("choose")}</h2>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/80">
          {t("theme")}
        </p>
      </div>
      {/* Collapse to the header so the previewed site can be scrolled
          (mobile: keyboard_arrow_up/down IconButton). Bottom sheet only. */}
      {!docked && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t("showTemplates") : t("viewWebsite")}
          aria-expanded={!collapsed}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground hover:bg-foreground/10"
        >
          {collapsed ? (
            <ChevronUp className="size-6" />
          ) : (
            <ChevronDown className="size-6" />
          )}
        </button>
      )}
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
  );

  /** Error / spinner, filling whatever box the hosting gives the cards. */
  const pendingState = loadError ? (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
      <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      <button
        type="button"
        onClick={() => {
          setLoadError(false);
          load(() => true);
        }}
        className="text-sm font-semibold text-primary hover:underline"
      >
        {tc("retry")}
      </button>
    </div>
  ) : sites == null ? (
    <div
      role="status"
      aria-label={tc("loading")}
      className="flex h-full items-center justify-center"
    >
      <Loader2 className="size-7 animate-spin text-primary" />
    </div>
  ) : null;

  const cards = (sites ?? []).map((site) => (
    <TemplateCard
      key={site.id}
      name={labelFor(site)}
      site={site}
      selected={template?.id === site.id}
      onSelect={() => selectTemplate(site)}
    />
  ));

  // Apply — only once a template is selected.
  const applyButton = template && (
    <div className="shrink-0 px-5 pb-5 pt-2">
      <Button variant="gradient" className="w-full rounded-2xl" onClick={apply}>
        {t("apply")}
      </Button>
    </div>
  );

  const confirm = confirmOpen && (
    <ContentChoiceDialog
      onKeep={() => {
        setConfirmOpen(false);
        commit(true);
      }}
      onReplace={() => {
        setConfirmOpen(false);
        commit(false);
      }}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  // ── Desktop: fill the sidebar column (same hosting as BottomSheet's
  // panel-host mode) — the preview pane is left entirely uncovered. The tall
  // column takes a 2-across GRID that scrolls vertically; a horizontal strip
  // in a 346px-wide panel would hide most of the (now 7) templates. ──
  if (docked) {
    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          className="animate-fade-in absolute inset-0 z-40 flex flex-col bg-card"
        >
          {header}
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {pendingState ?? (
              <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 px-3 pb-4">
                {cards}
              </div>
            )}
          </div>
          {applyButton}
        </div>
        {confirm}
      </>
    );
  }

  // ── Mobile: bottom sheet WITHOUT a barrier. The wrapper ignores pointer
  // events entirely, so the canvas above the sheet stays scrollable — only the
  // sheet itself is interactive. The sheet SIZES TO ITS CONTENT (header +
  // horizontal strip + Apply) with no inner vertical scrolling: the previous
  // 60vh cap made short viewports scroll the body by a few pixels for nothing.
  // The strip height is FIXED (see CARD_STRIP_HEIGHT) so the sheet doesn't
  // resize when the snapshots finish loading — mobile does the same with a
  // literal SizedBox; error/spinner fill the same box, so no state can jump. ──
  return createPortal(
    <>
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex justify-center">
      <div
        role="dialog"
        aria-modal="true"
        className="animate-sheet-up pointer-events-auto relative flex max-h-dvh w-full max-w-md flex-col overflow-hidden rounded-t-[20px] bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.25)]"
      >
        {/* Grab handle */}
        <div className="flex shrink-0 justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
        </div>
        {header}
        {/* Collapsed: header only — the previewed site behind is reachable. */}
        {!collapsed && (
          <>
            <div className="mt-3 shrink-0" style={{ height: CARD_STRIP_HEIGHT }}>
              {pendingState ?? (
                <div className="flex h-full gap-3 overflow-x-auto px-5 py-1">
                  {cards}
                </div>
              )}
            </div>
            {applyButton}
          </>
        )}
        {(collapsed || !template) && <div className="h-4 shrink-0" />}
      </div>
    </div>
    {confirm}
    </>,
    document.body,
  );
}

// ─── Keep-or-replace content dialog ────────────────────────────────────────

/**
 * Mobile `_ContentChoiceDialog`: asks whether the user's existing blocks
 * survive the template. The safe choice ("keep my content") is first and
 * visually primary; the destructive one is outlined in the error color with
 * its consequence spelled out underneath, so it can't be picked by accident.
 */
function ContentChoiceDialog({
  onKeep,
  onReplace,
  onCancel,
}: {
  onKeep: () => void;
  onReplace: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("builder.templates");
  const tc = useTranslations("common");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-6"
      onMouseDown={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-popover-in w-full max-w-sm rounded-3xl bg-card p-5 pt-6 shadow-xl"
      >
        <h2 className="text-center text-base font-bold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-2.5 text-center text-sm text-muted-foreground">
          {t("contentChoiceMessage")}
        </p>

        {/* Safe choice first and visually primary. */}
        <Button
          variant="gradient"
          className="mt-5 w-full rounded-[14px]"
          onClick={onKeep}
        >
          {t("keepMyContent")}
        </Button>

        {/* Destructive: outlined in the error color, consequence underneath. */}
        <button
          type="button"
          onClick={onReplace}
          className="mt-2.5 w-full rounded-[14px] border border-error/50 py-3 text-sm font-semibold text-error transition-colors hover:bg-error/5"
        >
          {t("useTemplateContent")}
        </button>
        <p className="mt-1.5 text-center text-xs text-error/80">
          {t("replaceContentWarning")}
        </p>

        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full rounded-full py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          {tc("cancel")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ─── Live preview card ─────────────────────────────────────────────────────
// Mobile `_TemplateCard` (commit 1cd35b2e) renders the template with the REAL
// hero + block widgets at phone width and scales the result into the card. Web
// does exactly that with the read-only `Hero` + `BlockView` renderers.

const CARD_WIDTH = 118;
const CARD_HEIGHT = 176;

/**
 * Height of the horizontal card strip, derived rather than guessed.
 *
 * Mobile hardcodes `SizedBox(height: 210)`, and porting that number literally
 * cut the NAME off: the strip is `overflow-x-auto`, which makes overflow-y
 * non-visible too, so the last few pixels of the label were clipped instead of
 * simply overflowing. The sum below is every box between the strip's edges:
 *
 *   card              176   CARD_HEIGHT
 *   card margins        8   m-[4px] top + bottom
 *   label margin        6   mt-1.5
 *   label line          16  text-xs → line-height 1rem
 *   strip padding       8   py-1 top + bottom
 *   headroom            6   taller line boxes in non-Latin scripts
 *                    ────
 *                     220
 *
 * Keep this in sync if any of those classes change — a 4px shortfall is all it
 * took to hide the names.
 */
const CARD_STRIP_HEIGHT = CARD_HEIGHT + 8 + 6 + 16 + 8 + 6;
/** Mobile `_renderWidth` — the phone width the preview is laid out at. */
const RENDER_WIDTH = 390;
const SCALE = CARD_WIDTH / RENDER_WIDTH;
/**
 * The card shows `CARD_HEIGHT / SCALE` ≈ 580 render px, which the hero plus a
 * couple of blocks already overflow. Capping the list keeps two cards cheap
 * (no maps / embeds mounted off-screen) while filling the visible area.
 */
const PREVIEW_BLOCKS = 6;

function TemplateCard({
  name,
  site,
  selected,
  onSelect,
}: {
  name: string;
  site: TemplateSite;
  selected: boolean;
  onSelect: () => void;
}) {
  const settings = site.settings;
  // Same composition as BuilderCanvas: the site's own font + font colour
  // re-point the theme tokens so every block inherits the site colour.
  const websiteFont = settings.font_family || DEFAULT_FONT;
  useEffect(() => {
    ensureGoogleFonts([websiteFont]);
  }, [websiteFont]);

  const fontColorCss = argbToCss(settings.font_color ?? 0xffffffff) ?? "#ffffff";
  const bgValue = settings.background?.color_value;
  // Mobile `settings.getBackgroundColor()` — solid page colour, black otherwise.
  const pageBgArgb =
    bgValue && bgValue.type === "solid" ? solidArgb(bgValue.color) : 0xff000000;
  const pageBg = colorValueToCss(bgValue) ?? "#1f1f26";
  // The template's AUTHORED accent (button1 fill, else the page background).
  // Presentation only — nothing persists it since `brand_color` was removed.
  const accent = argbToCss(templateAccentColor(site));

  return (
    // A div, not a button: the rendered blocks contain their own <button>/<a>
    // elements and nesting those in a button is invalid HTML (see ProfileCard).
    <div className="shrink-0">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        // Mobile 850e3023 tightened this: margin 3→4, the AnimatedContainer
        // became a plain Container (no 150ms tween), and the primary glow
        // boxShadow was dropped — the ring alone marks the selection now.
        // The outset `0 0 0 Npx` shadow is the CSS equivalent of Flutter's
        // `strokeAlign: BorderSide.strokeAlignOutside`: it grows outward, so a
        // 3px selected ring can't shrink the preview inside.
        // `dir="ltr"` belongs on the FRAME, not on the surface inside it.
        // An element's own `direction` controls its CONTENT; where the element
        // itself lands when it overflows is decided by its CONTAINING BLOCK —
        // this div. The surface is RENDER_WIDTH (390px) inside CARD_WIDTH
        // (118px): under RTL the frame aligns the child's RIGHT edge with its
        // own, so the child's left edge sits at 118 − 390 = −272px, and
        // `origin-top-left` then scales about a point outside the frame. The
        // card showed nothing but its background colour in Arabic while English
        // was fine. Pinning the FRAME to LTR restores identical geometry in
        // every locale; the previewed site's own text direction is untouched,
        // because Hero/BlockView set `dir={dirOf(text)}` per field.
        dir="ltr"
        className="relative m-[4px] cursor-pointer overflow-hidden rounded-[14px]"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          backgroundColor: pageBg,
          boxShadow: selected
            ? "0 0 0 3px var(--primary)"
            : "0 0 0 1px color-mix(in srgb, var(--foreground) 25%, transparent)",
        }}
      >
        {/* The 390px render surface. It is anchored by the frame above, which
            is pinned to LTR — see the comment there. */}
        <div
          className="pointer-events-none origin-top-left"
          style={{
            width: RENDER_WIDTH,
            transform: `scale(${SCALE})`,
            fontFamily: fontStack(websiteFont),
            color: fontColorCss,
            ["--foreground" as string]: fontColorCss,
            ["--muted-foreground" as string]: `color-mix(in srgb, ${fontColorCss} 62%, transparent)`,
          }}
        >
          <PageBackgroundContext.Provider value={pageBgArgb}>
            <Hero settings={settings} />
            <div className="flex flex-col gap-3 px-4 pb-14 pt-3">
              {site.blocks.slice(0, PREVIEW_BLOCKS).map((b) => (
                <BlockView key={b.id} block={b} />
              ))}
            </div>
          </PageBackgroundContext.Provider>
        </div>

        {/* Selected badge — mobile pins it to the card's top-end corner. */}
        {selected && (
          <span className="absolute end-0 top-0 flex size-[26px] items-center justify-center rounded-full border-2 border-white bg-primary">
            <Check className="size-[15px] text-white" />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 flex max-w-[124px] items-center justify-center gap-1.5 truncate text-center text-xs",
          selected ? "font-bold text-primary" : "font-medium text-foreground",
        )}
      >
        {/* The template's authored accent colour, so the two cards stay
            distinguishable at a glance even before the preview paints. */}
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="truncate">{name}</span>
      </p>
    </div>
  );
}
