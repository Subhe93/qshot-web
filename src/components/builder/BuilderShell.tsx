"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Blocks,
  Home,
  Files,
  Paintbrush,
  Settings as SettingsIcon,
  CalendarCheck,
  Loader2,
  Check,
  Save,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useEditorStore, type EditorSnapshot } from "@/stores/editor-store";
import {
  getProfile,
  saveProfile,
  decodeSchemaIssue,
  readSchemaValidationFailure,
} from "@/lib/api/profiles";
import {
  getProfile as getAdminProfile,
  updateProfile as updateAdminProfile,
} from "@/lib/api/admin";
import { savePageBlocks } from "@/lib/api/pages";
import { fillDefaults } from "@/lib/builder/hero-defaults";
import {
  parseBlocks,
  parseSettings,
  serializeBlocks,
  serializeSettings,
} from "@/lib/builder/serialization";
import { findIncompleteBlocks, findUnknownBlocks } from "@/lib/builder/validate";
import { catalogByType } from "@/lib/builder/catalog";
import { useMediaQuery } from "@/lib/use-media-query";
import { takeAiDraft, type AiDraft } from "@/lib/ai/draft-handoff";
import { BuilderDesktop } from "./BuilderDesktop";
import type { Block } from "@/lib/types/blocks";
import { AddBlockMenu } from "./AddBlockMenu";
import { BuilderCanvas } from "./BuilderCanvas";
import { UndoRedo } from "./UndoRedo";
import { PagesPanel } from "./PagesPanel";
import { SettingsPanel } from "./SettingsPanel";
import { WebsiteSettingsPanel } from "./WebsiteSettingsPanel";
import { WebsiteStylePanel } from "./WebsiteStylePanel";
import { HeroSettingsSheet } from "./hero/HeroSettingsSheet";
import { NameBioSheet } from "./hero/NameBioSheet";
import { ThemeSheet } from "./ThemeSheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { TEMPLATES_ENABLED } from "@/lib/builder/feature-flags";

import { siteUrl } from "@/lib/site-domain";
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

export function BuilderShell({
  id,
  adminName,
  adminProfileId,
}: {
  id: string;
  /** When set, load/save this profile via the ADMIN endpoints (admin edits any
   *  profile visually — mirrors mobile WebsiteEditor(Role.admin)). */
  adminName?: string;
  /** The real profile id (from the control panel) — the admin-update save target. */
  adminProfileId?: string;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  // Block display names (builder.blocks.*), used to name the block a server
  // schema error points at.
  const tb = useTranslations("builder.blocks");
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
  const restoreSnapshot = useEditorStore((s) => s.restoreSnapshot);
  const router = useRouter();

  const [panel, setPanel] = useState<Panel>("home");
  const [addOpen, setAddOpen] = useState(false);
  // Theme (templates) sheet + the 5s post-apply undo snapshot.
  const [themeOpen, setThemeOpen] = useState(false);
  // True while the CURRENT sheet opening came from the auto-gate (a brand-new
  // site), as opposed to the user opening Templates by hand.
  const [themeIsGate, setThemeIsGate] = useState(false);
  const [templateUndo, setTemplateUndo] = useState<EditorSnapshot | null>(null);
  // Desktop (≥lg) uses the Elementor-style two-pane layout; mobile keeps this tree.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Consume any AI draft handed off by the wizard exactly once (the render guard
  // survives React Strict Mode's double-invoked effects in dev).
  const aiDraftRef = useRef<AiDraft | null | undefined>(undefined);
  if (aiDraftRef.current === undefined) {
    aiDraftRef.current = takeAiDraft(id);
  }

  // In admin mode, the real target profile id — used as the save target for the
  // admin `update` endpoint. Seeded from the `pid` route param (reliable), then
  // confirmed from the admin `show` payload once it loads.
  const adminIdRef = useRef<string | null>(adminProfileId ?? null);

  // Allow deep-linking a panel via the URL hash (e.g. /builder/x#settings).
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "pages" || h === "style" || h === "settings" || h === "home") {
      // Deferred a tick — react-hooks/set-state-in-effect.
      const t = setTimeout(() => setPanel(h), 0);
      return () => clearTimeout(t);
    }
  }, []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Quick "Saved" toast so the silent auto-save (and manual save) is noticeable.
  // `error` toasts carry a real (often long) server complaint, so they get a
  // warning icon and a much longer dwell time than the 2s "Saved" flash.
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
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
  const profileUrl = siteUrl(slug);

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
      // Deferred a tick — react-hooks/set-state-in-effect.
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }

    // Admin mode: load ANY profile via the admin `show` endpoint (raw payload →
    // parse to the editor's normalized shapes, same as the user loader).
    if (adminName) {
      // Deferred a tick — react-hooks/set-state-in-effect. The fetch below
      // resolves later, so the loading flag is always raised before it lands.
      const t = setTimeout(() => setLoading(true), 0);
      (async () => {
        let p = null;
        try {
          p = await getAdminProfile(adminName);
        } catch {
          // ignore — fall back to a fresh seed
        }
        if (!active) return;
        adminIdRef.current = p?.id ?? adminProfileId ?? null;
        const rawBlocks = (p?.info?.modules ??
          (p?.settings?.modules as unknown[] | undefined) ??
          []) as unknown[];
        load({
          profileId: p?.id ?? id,
          name: p?.name ?? adminName,
          settings: p
            ? parseSettings(p.settings as Parameters<typeof parseSettings>[0])
            : fillDefaults("style2", { websiteName: adminName }),
          blocks: rawBlocks.length ? parseBlocks(rawBlocks) : demoBlocks(),
        });
        setLoading(false);
      })();
      return () => {
        active = false;
        clearTimeout(t);
      };
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
  }, [id, load, adminName, adminProfileId]);

  // Auto-open Theme gate (mobile `_maybeOpenThemeGate`): a brand-new site —
  // main page, no blocks, never templated — starts at the Theme sheet instead
  // of an empty builder. Dismissing THIS opening writes the skipped marker
  // (`template: { id: null }`, see onClose above) so it doesn't reappear on
  // every visit. Runs once per builder mount, after the site loads.
  const themeGateRan = useRef(false);
  useEffect(() => {
    if (!TEMPLATES_ENABLED) return;
    if (loading || themeGateRan.current) return;
    themeGateRan.current = true;
    const s = useEditorStore.getState();
    if (s.pageId === null && s.blocks.length === 0 && s.settings.template == null) {
      // Deferred a tick (lets the builder paint first, and avoids a synchronous
      // set-state in the effect body — react-hooks/set-state-in-effect).
      const t = setTimeout(() => {
        setThemeIsGate(true);
        setThemeOpen(true);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Auto-dismiss (force-close) the template undo toast after 5s (mobile Timer).
  useEffect(() => {
    if (!templateUndo) return;
    const h = setTimeout(() => setTemplateUndo(null), 5000);
    return () => clearTimeout(h);
  }, [templateUndo]);

  // The actual save — shared by the debounced auto-save and the manual button.
  const doSave = useCallback(async () => {
    // The server validates the whole document (schemaVersion 2.0.0 — NOT our
    // docs copy, see docs/for validation/DELTA-deployed-2.0.0-vs-our-copy.md)
    // and rejects it wholesale. An unsupported block type is one violation we
    // can still be holding (we keep unknown blocks verbatim rather than
    // destroying them) — name it instead of firing a doomed request.
    const unknown = findUnknownBlocks(blocks);
    if (unknown.length) {
      setToast({
        text: t("unsupportedBlock", {
          position: unknown[0].index + 1,
          type: unknown[0].type,
        }),
        error: true,
      });
      return;
    }
    // Blocks the builder lets you add empty (Embed, Introduction video) but the
    // server requires filled in. Name the block and the missing field locally
    // rather than firing a request that can only come back as a 422.
    const incomplete = findIncompleteBlocks(blocks);
    if (incomplete.length) {
      setToast({
        text: t(incomplete[0].messageKey, { position: incomplete[0].index + 1 }),
        error: true,
      });
      return;
    }
    setSaving(true);
    try {
      // Admin mode: persist the whole profile via the admin `update` endpoint —
      // NEVER the user `edit` endpoint (which 400s on a profile you don't own).
      if (adminName) {
        const saveId = adminIdRef.current ?? adminProfileId ?? null;
        if (!saveId) throw new Error("admin_no_profile_id");
        await updateAdminProfile({
          id: saveId,
          name,
          info: { modules: serializeBlocks(blocks) },
          settings: serializeSettings(settings) as Record<string, unknown>,
        });
      }
      // Sub-page edits save only blocks (update-info); home saves the profile.
      else if (pageId) await savePageBlocks(pageId, blocks);
      else await saveProfile(id, name, blocks, settings);
      markSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      setToast({ text: t("saved") });
    } catch (e) {
      // A 422 carries the server's schema-validation report: exactly which
      // pointer inside the document is wrong and why. Surface it instead of
      // collapsing everything into "something went wrong".
      const failure = await readSchemaValidationFailure(e);
      if (!failure) {
        // Anything else — offline, timeout, 401 (the client already logged the
        // user out), a non-JSON 4xx — keeps the previous generic message.
        console.error("[qshot] profile save failed", e);
        setToast({ text: tc("genericError"), error: true });
        return;
      }
      // The full structured report is for us; the toast can only carry one issue.
      console.error(
        `[qshot] save rejected by the server schema validator` +
          ` (schemaVersion ${failure.schemaVersion ?? "?"}, target ${failure.target ?? "?"})`,
        { summary: failure.message, errors: failure.errors, body: failure.raw },
      );

      const first = failure.errors[0];
      const issue = first ? decodeSchemaIssue(first) : null;
      // "links/0/icon: unknown field \"icon\" is not allowed" — pointer inside
      // the block first, then the server's own words.
      const reason =
        (issue ? [issue.where, issue.message].filter(Boolean).join(": ") : "") ||
        failure.message ||
        tc("genericError");
      let text: string;
      if (issue?.blockPosition != null) {
        const type = (blocks[issue.blockPosition - 1] as Block | undefined)?.type;
        const labelKey = type ? catalogByType[type]?.labelKey : undefined;
        text = t("saveRejectedBlock", {
          position: issue.blockPosition,
          // Prefer the block's display name; fall back to the raw type.
          block: labelKey ? tb(labelKey) : (type ?? "?"),
          reason,
        });
      } else {
        text = t("saveRejected", { reason });
      }
      if (failure.errors.length > 1) {
        text += ` ${t("saveRejectedMore", { count: failure.errors.length - 1 })}`;
      }
      setToast({ text, error: true });
    } finally {
      setSaving(false);
    }
  }, [pageId, blocks, id, name, settings, markSaved, t, tb, tc, adminName, adminProfileId]);

  // Manual save — runs immediately (markSaved clears `dirty`, which cancels any
  // pending debounced save via the effect cleanup below). Safe even while the
  // Theme sheet is open: template previews live in the store's previewOverlay,
  // so a save can only ever see the real state.
  const saveNow = useCallback(() => {
    if (!saving) void doSave();
  }, [saving, doSave]);

  // Debounced silent auto-save (mirrors the mobile app's auto-save). No pause
  // for the Theme sheet anymore: previews go through `previewOverlay` and never
  // touch the saved fields — the old pause papered over the leak the overlay
  // now closes structurally.
  useEffect(() => {
    if (!dirty) return;
    const handle = setTimeout(() => void doSave(), 1500);
    return () => clearTimeout(handle);
  }, [dirty, doSave]);

  // Auto-dismiss the toast. Errors quote the server and need reading time.
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), toast.error ? 10000 : 2000);
    return () => clearTimeout(h);
  }, [toast]);

  function goPanel(p: Panel) {
    select(null);
    setPanel(p);
  }

  const blockSheetOpen = panel === "home" && selectedId != null;

  // Style panel "Templates" row → back to the website view first (mobile pops
  // the style page to the home tab — two live-previewing surfaces can't
  // stack), then open the Theme sheet over the visible canvas.
  function openThemeSheet() {
    if (!TEMPLATES_ENABLED) return;
    // Guard from the mobile handover doc (README-form-mobile.md §8 item 1):
    // with a SUB-PAGE open, the sheet would resolve/apply against the
    // sub-page's blocks — templating the sub-page and overwriting the whole
    // site's hero settings. Mobile's auto-gate checks isMainPage but its
    // manual path is still exposed ("needs a decision" on their side); we take
    // the doc's suggested fix — templates always operate on the home page.
    if (useEditorStore.getState().pageId !== null) exitToHome();
    setThemeIsGate(false); // manual open — dismissing writes no marker
    select(null);
    editHero(null);
    setPanel("home");
    setThemeOpen(true);
  }

  const themeSheetProps = {
    onClose: () => {
      setThemeOpen(false);
      // Mobile `_closeThemePanel`: dismissing the GATE without applying writes
      // `TemplateRef.skipped()` — `template: { id: null }` — meaning "asked
      // and declined", so the gate doesn't reopen on every visit to an empty
      // site. Manual opens record nothing. The marker goes to the REAL
      // settings (dirty → auto-save persists it).
      if (themeIsGate) {
        setThemeIsGate(false);
        const s = useEditorStore.getState();
        if (s.settings.template == null) {
          s.updateSettings({ template: { id: null } });
        }
      }
    },
    onApplied: (snapshot: EditorSnapshot) => {
      setThemeIsGate(false);
      setThemeOpen(false);
      setTemplateUndo(snapshot);
    },
  };

  // The 5s "Template Applied / Undo" toast restoring the pre-apply snapshot —
  // shared by both layouts. The sheet itself is hosted per layout: docked into
  // the desktop sidebar, floating (barrier-free) on mobile.
  const undoToast = (
    <>
      {templateUndo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4">
          <div className="animate-fade-in pointer-events-auto flex items-center gap-3 rounded-full bg-dark px-4 py-2 text-sm font-medium text-white shadow-lg">
            {t("templates.applied")}
            <button
              type="button"
              onClick={() => {
                restoreSnapshot(templateUndo);
                setTemplateUndo(null);
              }}
              className="font-bold uppercase text-primary hover:opacity-80"
            >
              {t("templates.undo")}
            </button>
          </div>
        </div>
      )}
    </>
  );

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
          onOpenTemplates={TEMPLATES_ENABLED ? openThemeSheet : undefined}
          themeSheet={themeOpen ? <ThemeSheet docked {...themeSheetProps} /> : null}
        />
        {undoToast}
        <SaveToast toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-muted">
      {/* Top bar: back + url pill + preview */}
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={tc("back")}
          className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
          <span className="text-[9px] font-medium leading-none text-muted-foreground">
            {t("backToDashboard")}
          </span>
        </button>
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 text-sm text-muted-foreground">
          {loading ? (
            <span className="h-3 w-32 animate-pulse rounded-full bg-border" />
          ) : (
            <>
              <span className="truncate">{profileUrl}</span>
              <div className="ms-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label={tc("copy")}
                  onClick={() => navigator.clipboard?.writeText(profileUrl)}
                  className="hover:text-foreground"
                >
                  <Copy className="size-4" />
                </button>
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tc("openInNewTab")}
                  className="hover:text-foreground"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </>
          )}
        </div>
        <UndoRedo suspended={themeOpen} />
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
        {!loading && panel === "home" && <BuilderCanvas browseOnly={themeOpen} />}
        {panel === "style" && <WebsiteStylePanel onOpenTemplates={TEMPLATES_ENABLED ? openThemeSheet : undefined} />}
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
          Hidden in preview mode so the canvas shows as the live website, and
          while the Theme sheet is open — with the barrier gone, its buttons
          (especially the Add-Block FAB poking above the sheet) would otherwise
          mutate the un-committed template preview. */}
      {!previewEnabled && !themeOpen && (
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
            <Blocks className="size-6" />
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

      {themeOpen && <ThemeSheet {...themeSheetProps} />}
      {undoToast}
      <SaveToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// Quick auto-dismissing toast (bottom-center), shared by both layouts.
// Success = the 2s "Saved" pill. Error = the server's own complaint, so it wraps
// instead of truncating, and is dismissable (it dwells 10s).
export function SaveToast({
  toast,
  onDismiss,
}: {
  toast: { text: string; error?: boolean } | null;
  onDismiss?: () => void;
}) {
  if (!toast) return null;
  const isError = !!toast.error;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div
        role={isError ? "alert" : "status"}
        onClick={isError ? onDismiss : undefined}
        className={cn(
          "animate-fade-in flex items-start gap-2 px-4 py-2 text-sm font-medium text-white shadow-lg",
          isError
            ? "pointer-events-auto max-w-md cursor-pointer rounded-2xl bg-error text-start"
            : "items-center rounded-full bg-dark",
        )}
      >
        {isError ? (
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        ) : (
          <Check className="size-4 text-success" />
        )}
        <span className="min-w-0 wrap-break-word">{toast.text}</span>
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
