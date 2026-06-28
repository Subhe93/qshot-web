"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Home,
  Files,
  Paintbrush,
  Settings as SettingsIcon,
  CalendarCheck,
  Loader2,
  Check,
  Save,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useEditorStore } from "@/stores/editor-store";
import { getProfile, saveProfile } from "@/lib/api/profiles";
import { savePageBlocks } from "@/lib/api/pages";
import { fillDefaults } from "@/lib/builder/hero-defaults";
import { useMediaQuery } from "@/lib/use-media-query";
import { takeAiDraft, type AiDraft } from "@/lib/ai/draft-handoff";
import { BuilderDesktop } from "./BuilderDesktop";
import type { Block } from "@/lib/types/blocks";
import { AddBlockMenu } from "./AddBlockMenu";
import { BuilderCanvas } from "./BuilderCanvas";
import { PagesPanel } from "./PagesPanel";
import { SettingsPanel } from "./SettingsPanel";
import { WebsiteSettingsPanel } from "./WebsiteSettingsPanel";
import { WebsiteStylePanel } from "./WebsiteStylePanel";
import { HeroSettingsSheet } from "./hero/HeroSettingsSheet";
import { NameBioSheet } from "./hero/NameBioSheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

type Panel = "home" | "pages" | "style" | "settings";

// Seed shown for a brand-new profile so the canvas is never empty. Uses the real
// mobile block `type` values + a JSON-encoded Quill Delta for the paragraph.
function demoBlocks(): Block[] {
  return [
    { id: nanoid(), type: "HeaderModule", value: "Welcome 👋", size: 22, align: "center" },
    {
      id: nanoid(),
      type: "ParagraphModule",
      content: JSON.stringify([
        { insert: "Tap any block to edit it, or add new ones with the + button.\n" },
      ]),
    },
    {
      id: nanoid(),
      type: "ButtonModule",
      title: "",
      layout_type: "list",
      theme: "solid",
      buttons: [{ id: nanoid(), title: "Visit my website", url: "https://qshot.com" }],
    },
  ];
}

export function BuilderShell({ id }: { id: string }) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const name = useEditorStore((s) => s.name);
  const dirty = useEditorStore((s) => s.dirty);
  const settings = useEditorStore((s) => s.settings);
  const blocks = useEditorStore((s) => s.blocks);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const heroTab = useEditorStore((s) => s.heroTab);
  const editHero = useEditorStore((s) => s.editHero);
  const load = useEditorStore((s) => s.load);
  const markSaved = useEditorStore((s) => s.markSaved);
  const pageId = useEditorStore((s) => s.pageId);
  const pageName = useEditorStore((s) => s.pageName);
  const exitToHome = useEditorStore((s) => s.exitToHome);
  const previewEnabled = useEditorStore((s) => s.previewEnabled);
  const togglePreview = useEditorStore((s) => s.togglePreview);
  const router = useRouter();

  const [panel, setPanel] = useState<Panel>("home");
  const [addOpen, setAddOpen] = useState(false);
  // Desktop (≥lg) uses the Elementor-style two-pane layout; mobile keeps this tree.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Consume any AI draft handed off by the wizard exactly once (the render guard
  // survives React Strict Mode's double-invoked effects in dev).
  const aiDraftRef = useRef<AiDraft | null | undefined>(undefined);
  if (aiDraftRef.current === undefined) {
    aiDraftRef.current = takeAiDraft(id);
  }

  // Allow deep-linking a panel via the URL hash (e.g. /builder/x#settings).
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "pages" || h === "style" || h === "settings" || h === "home") {
      setPanel(h);
    }
  }, []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Quick "Saved" toast so the silent auto-save (and manual save) is noticeable.
  const [toast, setToast] = useState<string | null>(null);
  // A brand-new draft loads instantly; an existing profile is fetched, so show a
  // skeleton until its data lands in the store.
  const [loading, setLoading] = useState(id !== "new");

  // The slug is the URL handle (store `name`, e.g. "subhi20") — NOT the hero
  // display name (`settings.name.text`). Matches WebsiteSettingsPanel/profile-card.
  const slug =
    name
      ?.toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "me";
  const profileUrl = `https://${slug}.qshot.com`;

  useEffect(() => {
    let active = true;

    // An AI-generated draft handed off from the wizard — load it directly so the
    // generated content shows instantly (no backend refetch race). A real id
    // starts dirty so the builder's auto-save persists it.
    const draft = aiDraftRef.current;
    if (draft) {
      load({
        profileId: id,
        name: draft.name,
        settings: draft.settings,
        blocks: draft.blocks,
        dirty: id !== "new",
      });
      setLoading(false);
      return;
    }

    if (id === "new") {
      // Mirror the mobile create flow: full style defaults + empty blocks.
      load({
        profileId: id,
        name: "My profile",
        settings: fillDefaults("style2", { websiteName: "My profile" }),
        blocks: [],
      });
      return;
    }
    (async () => {
      let profile = null;
      try {
        profile = await getProfile(id);
      } catch {
        // ignore — fall back to a fresh seed
      }
      if (!active) return;
      load({
        profileId: id,
        // The public URL slug is `user_name` (mobile/dashboard source of truth);
        // fall back to the legacy `name` field, then a placeholder.
        name: profile?.user_name ?? profile?.name ?? "My profile",
        settings: profile?.settings ?? { name: { text: "My profile" }, bio: { text: "" } },
        // Blocks live under info.modules (mobile WebpageEntity); fall back to a
        // legacy settings.modules location, then to a fresh seed.
        blocks:
          profile?.info?.modules ??
          (profile?.settings?.modules as Block[] | undefined) ??
          demoBlocks(),
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, load]);

  // The actual save — shared by the debounced auto-save and the manual button.
  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      // Sub-page edits save only blocks (update-info); home saves the profile.
      if (pageId) await savePageBlocks(pageId, blocks);
      else await saveProfile(id, name, blocks, settings);
      markSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      setToast(t("saved"));
    } catch {
      setToast(tc("genericError"));
    } finally {
      setSaving(false);
    }
  }, [pageId, blocks, id, name, settings, markSaved, t, tc]);

  // Manual save — runs immediately (markSaved clears `dirty`, which cancels any
  // pending debounced save via the effect cleanup below).
  const saveNow = useCallback(() => {
    if (!saving) void doSave();
  }, [saving, doSave]);

  // Debounced silent auto-save (mirrors the mobile app's auto-save).
  useEffect(() => {
    if (!dirty) return;
    const handle = setTimeout(() => void doSave(), 1500);
    return () => clearTimeout(handle);
  }, [dirty, doSave]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(h);
  }, [toast]);

  function goPanel(p: Panel) {
    select(null);
    setPanel(p);
  }

  const blockSheetOpen = panel === "home" && selectedId != null;

  if (isDesktop) {
    return (
      <>
        <BuilderDesktop
          id={id}
          profileUrl={profileUrl}
          loading={loading}
          saving={saving}
          saved={saved}
          dirty={dirty}
          onSave={saveNow}
        />
        <SaveToast text={toast} />
      </>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-muted">
      {/* Top bar: back + url pill + preview */}
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Link
          href="/dashboard"
          aria-label={tc("back")}
          className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 text-sm text-muted-foreground">
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
        {/* Manual save (auto-save still runs; this lets the user save on demand). */}
        <button
          type="button"
          onClick={saveNow}
          disabled={saving}
          aria-label={t("save")}
          className="flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-sm font-semibold text-foreground hover:bg-border disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4 text-success" />
          ) : (
            <Save className="size-4" />
          )}
          <span className="hidden sm:inline">{t("save")}</span>
        </button>
        {/* Preview toggle — flips the canvas between edit and live preview
            (mobile previewEnabled): no outlines/handles, links launch. */}
        <button
          type="button"
          onClick={togglePreview}
          aria-label={t("tabPreview")}
          aria-pressed={previewEnabled}
          className={cn(
            "flex size-9 items-center justify-center rounded-full text-foreground transition-colors",
            previewEnabled
              ? "bg-primary/10 ring-2 ring-primary"
              : "bg-muted hover:bg-border",
          )}
        >
          {previewEnabled ? (
            <EyeOff className="size-5" />
          ) : (
            <Eye className="size-5" />
          )}
        </button>
      </header>

      {/* Editing-a-sub-page banner */}
      {pageId && panel === "home" && (
        <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm">
          <Files className="size-4 text-primary" />
          <span className="flex-1 truncate text-foreground">
            {pageName || "Page"}
          </span>
          <button
            type="button"
            onClick={() => {
              exitToHome();
            }}
            className="rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            {t("nav.home")}
          </button>
        </div>
      )}

      {/* Active panel */}
      <div className="flex-1 overflow-y-auto">
        {loading && panel === "home" && <CanvasSkeleton />}
        {!loading && panel === "home" && <BuilderCanvas />}
        {panel === "style" && <WebsiteStylePanel />}
        {panel === "settings" && (
          <div className="p-4">
            <WebsiteSettingsPanel />
          </div>
        )}
        {panel === "pages" && (
          <PagesPanel profileId={id} onOpenPage={() => setPanel("home")} />
        )}
      </div>

      {/* Bottom nav: Home / Pages / Add / Style / Settings.
          Hidden in preview mode so the canvas shows as the live website. */}
      {!previewEnabled && (
      <nav className="relative flex shrink-0 items-stretch border-t border-border bg-card">
        <NavItem
          label={t("nav.home")}
          Icon={Home}
          active={panel === "home"}
          onClick={() => goPanel("home")}
        />
        <NavItem
          label={t("nav.pages")}
          Icon={Files}
          active={panel === "pages"}
          onClick={() => goPanel("pages")}
        />
        {/* Center Add-Block FAB */}
        <div className="flex w-16 shrink-0 items-start justify-center">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label={t("addBlock")}
            className="brand-gradient -mt-5 flex size-14 items-center justify-center rounded-full text-white shadow-lg"
          >
            <Plus className="size-6" />
          </button>
        </div>
        <NavItem
          label={t("nav.style")}
          Icon={Paintbrush}
          active={panel === "style"}
          onClick={() => goPanel("style")}
        />
        <NavItem
          label={t("nav.settings")}
          Icon={SettingsIcon}
          active={panel === "settings"}
          onClick={() => goPanel("settings")}
        />
        <NavItem
          label={t("nav.booking")}
          Icon={CalendarCheck}
          active={false}
          onClick={() => router.push(`/sites/${id}/booking`)}
        />
      </nav>
      )}

      {/* Add-block sheet */}
      {addOpen && (
        <BottomSheet
          title={t("addBlock")}
          subtitle={t("addBlockSubtitle")}
          onClose={() => setAddOpen(false)}
        >
          <AddBlockMenu onAdded={() => setAddOpen(false)} />
        </BottomSheet>
      )}

      {/* Selected-block editor sheet */}
      {blockSheetOpen && (
        <BottomSheet title={t("nav.settings")} onClose={() => select(null)}>
          <SettingsPanel />
        </BottomSheet>
      )}

      {/* Hero element editor sheets (tapping a hero element in the canvas) */}
      {panel === "home" && heroTab && heroTab !== "name" && heroTab !== "bio" && (
        <HeroSettingsSheet initialTab={heroTab} onClose={() => editHero(null)} />
      )}
      {panel === "home" && (heroTab === "name" || heroTab === "bio") && (
        <NameBioSheet which={heroTab} onClose={() => editHero(null)} />
      )}

      <SaveToast text={toast} />
    </div>
  );
}

// Quick auto-dismissing "Saved" toast (bottom-center), shared by both layouts.
export function SaveToast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div className="animate-fade-in flex items-center gap-2 rounded-full bg-dark px-4 py-2 text-sm font-medium text-white shadow-lg">
        <Check className="size-4 text-success" />
        {text}
      </div>
    </div>
  );
}

// Skeleton placeholder shown in the canvas while an existing profile is fetched.
// Mirrors the canvas layout: a hero card on top, then a few block cards.
function CanvasSkeleton() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-4" aria-hidden>
      {/* Hero card: cover + avatar + name/bio lines */}
      <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
        <div className="h-28 animate-pulse bg-muted" />
        <div className="flex flex-col items-center gap-3 px-4 pb-5">
          <div className="-mt-10 size-20 animate-pulse rounded-full border-4 border-card bg-border" />
          <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      {/* Block cards */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl bg-card shadow-soft"
        />
      ))}
    </div>
  );
}

function NavItem({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium " +
        (active ? "text-primary" : "text-muted-foreground")
      }
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}
