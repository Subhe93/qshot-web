"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Save,
  Plus,
  Files,
  Paintbrush,
  Settings as SettingsIcon,
  CalendarCheck,
  Smartphone,
  Tablet,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";
import { BuilderCanvas } from "./BuilderCanvas";
import { AddBlockMenu } from "./AddBlockMenu";
import { SettingsPanel } from "./SettingsPanel";
import { WebsiteStylePanel } from "./WebsiteStylePanel";
import { WebsiteSettingsPanel } from "./WebsiteSettingsPanel";
import { PagesPanel } from "./PagesPanel";
import { HeroSettingsContent } from "./hero/HeroSettingsSheet";
import { NameBioContent } from "./hero/NameBioSheet";
import { PanelHostContext } from "./panel-host";

type LeftTab = "elements" | "pages" | "style" | "settings";
type PreviewWidth = "phone" | "tablet" | "full";

/**
 * Desktop (≥lg) builder — Elementor-style two-pane layout: left edit panel
 * (icon rail + active panel / inline block & hero editors), right live preview
 * with a width toggle. Mobile uses the existing BuilderShell tree unchanged.
 * All edit state lives in editor-store, so both layouts stay in sync.
 */
export function BuilderDesktop({
  id,
  profileUrl,
  loading,
  saving,
  saved,
  dirty,
  onSave,
}: {
  id: string;
  profileUrl: string;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  onSave: () => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");

  const selectedId = useEditorStore((s) => s.selectedId);
  const heroTab = useEditorStore((s) => s.heroTab);
  const select = useEditorStore((s) => s.select);
  const editHero = useEditorStore((s) => s.editHero);
  const previewEnabled = useEditorStore((s) => s.previewEnabled);
  const togglePreview = useEditorStore((s) => s.togglePreview);
  const pageId = useEditorStore((s) => s.pageId);
  const pageName = useEditorStore((s) => s.pageName);
  const exitToHome = useEditorStore((s) => s.exitToHome);

  const [tab, setTab] = useState<LeftTab>("elements");
  const [width, setWidth] = useState<PreviewWidth>("phone");
  // Nested item editors (e.g. a Video Link's URL sheet) mount here so they appear
  // INSIDE the sidebar as a sub-view rather than as a modal over the preview.
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);

  function goTab(next: LeftTab) {
    select(null);
    editHero(null);
    setTab(next);
  }

  const widthPx: number | "full" =
    width === "phone" ? 430 : width === "tablet" ? 820 : "full";

  // ── Left panel body (priority: block editor → hero editor → active tab) ──
  let leftBody: ReactNode;
  let backFor: "block" | "hero" | null = null;
  if (selectedId) {
    backFor = "block";
    leftBody = <SettingsPanel />; // its own toolbar (name · move · hide · delete · Save)
  } else if (heroTab) {
    backFor = "hero";
    leftBody =
      heroTab === "name" || heroTab === "bio" ? (
        <NameBioContent which={heroTab} />
      ) : (
        <HeroSettingsContent initialTab={heroTab} />
      );
  } else if (tab === "pages") {
    leftBody = <PagesPanel profileId={id} onOpenPage={() => setTab("elements")} />;
  } else if (tab === "style") {
    leftBody = <WebsiteStylePanel />;
  } else if (tab === "settings") {
    leftBody = <WebsiteSettingsPanel />;
  } else {
    leftBody = <AddBlockMenu />;
  }

  return (
    <div className="flex h-dvh flex-col bg-muted">
      {/* Top bar — split into a left zone aligned with the edit sidebar and a
          center zone that sits directly above the preview, so the URL field,
          Save and preview toggle stay in the user's line of sight over the
          canvas. */}
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        {/* Left zone (width matches the edit sidebar when it's shown) */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            !previewEnabled && "w-[380px]",
          )}
        >
          <Link
            href="/dashboard"
            aria-label={tc("back")}
            className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
        </div>

        {/* Center zone — directly above the preview */}
        <div className="flex flex-1 items-center justify-center gap-2">
          {/* Preview width toggle */}
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
            <WidthBtn Icon={Smartphone} active={width === "phone"} onClick={() => setWidth("phone")} />
            <WidthBtn Icon={Tablet} active={width === "tablet"} onClick={() => setWidth("tablet")} />
            <WidthBtn Icon={Monitor} active={width === "full"} onClick={() => setWidth("full")} />
          </div>

          <div className="flex h-9 w-full min-w-0 max-w-md items-center gap-2 rounded-full bg-muted px-3 text-sm text-muted-foreground">
            {loading ? (
              <span className="h-3 w-32 animate-pulse rounded-full bg-border" />
            ) : (
              <>
                <span className="truncate">{profileUrl}</span>
                <button
                  type="button"
                  aria-label="Copy"
                  onClick={() => navigator.clipboard?.writeText(profileUrl)}
                  className="ms-auto shrink-0 hover:text-foreground"
                >
                  <Copy className="size-4" />
                </button>
              </>
            )}
          </div>

          {/* Manual save (auto-save still runs in the background). */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            aria-label={t("save")}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-semibold text-foreground hover:bg-border disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <Check className="size-4 text-success" />
            ) : (
              <Save className="size-4" />
            )}
            {t("save")}
            {dirty && !saving && !saved && (
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            )}
          </button>

          {/* Preview / edit toggle */}
          <button
            type="button"
            onClick={togglePreview}
            aria-label={t("tabPreview")}
            aria-pressed={previewEnabled}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors",
              previewEnabled ? "bg-primary/10 ring-2 ring-primary" : "bg-muted hover:bg-border",
            )}
          >
            {previewEnabled ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── LEFT edit panel ── */}
        {!previewEnabled && (
          <aside className="flex w-[380px] shrink-0 border-e border-border bg-card">
            {/* Icon rail */}
            <div className="flex w-16 shrink-0 flex-col items-center gap-1 border-e border-border py-3">
              <RailBtn label={t("nav.add")} Icon={Plus} active={!selectedId && !heroTab && tab === "elements"} onClick={() => goTab("elements")} />
              <RailBtn label={t("nav.pages")} Icon={Files} active={!selectedId && !heroTab && tab === "pages"} onClick={() => goTab("pages")} />
              <RailBtn label={t("nav.style")} Icon={Paintbrush} active={!selectedId && !heroTab && tab === "style"} onClick={() => goTab("style")} />
              <RailBtn label={t("nav.settings")} Icon={SettingsIcon} active={!selectedId && !heroTab && tab === "settings"} onClick={() => goTab("settings")} />
              {/* Booking management for this profile (navigates out of the builder). */}
              <Link
                href={`/sites/${id}/booking`}
                className="flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <CalendarCheck className="size-5" />
                <span className="leading-none">{t("nav.booking")}</span>
              </Link>
            </div>

            {/* Panel content */}
            <div className="relative flex min-w-0 flex-1 flex-col">
              {/* Sub-page banner */}
              {pageId && (
                <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-3 py-2 text-sm">
                  <Files className="size-4 shrink-0 text-primary" />
                  <span className="flex-1 truncate text-foreground">{pageName || "Page"}</span>
                  <button
                    type="button"
                    onClick={exitToHome}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    {t("nav.home")}
                  </button>
                </div>
              )}

              {/* Back header for the hero editor (the block editor has its own). */}
              {backFor === "hero" && (
                <button
                  type="button"
                  onClick={() => editHero(null)}
                  className="flex items-center gap-1.5 border-b border-border px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  <ChevronLeft className="size-4 rtl:rotate-180" />
                  {tc("back")}
                </button>
              )}

              <PanelHostContext.Provider value={panelHost}>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{leftBody}</div>
              </PanelHostContext.Provider>

              {/* Sub-view host for nested item editors. Empty + pointer-events
                  -none so it never blocks the panel; a mounted sheet re-enables
                  pointer events and fills the panel column. */}
              <div
                ref={setPanelHost}
                className="pointer-events-none absolute inset-0 z-30"
              />
            </div>
          </aside>
        )}

        {/* ── RIGHT preview ── */}
        <main className="min-w-0 flex-1 overflow-hidden bg-muted">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <BuilderCanvas deviceWidth={widthPx} fillHeight />
          )}
        </main>
      </div>
    </div>
  );
}

function RailBtn({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
      <span className="leading-none">{label}</span>
    </button>
  );
}

function WidthBtn({
  Icon,
  active,
  onClick,
}: {
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-full transition-colors",
        active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
