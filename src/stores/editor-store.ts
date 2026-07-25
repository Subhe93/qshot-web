import { create } from "zustand";
import type { Block } from "@/lib/types/blocks";
import type { WebsiteSettings, HeroTab } from "@/lib/types/profile";

/** Blocks+settings pair used for template preview/undo (mobile snapshots both). */
export interface EditorSnapshot {
  blocks: Block[];
  settings: WebsiteSettings;
}

interface EditorState {
  profileId: string | null;
  name: string;
  settings: WebsiteSettings;
  blocks: Block[];
  selectedId: string | null;
  /** Id of the block most recently added via `addBlock` — used to auto-scroll
   * the canvas to it. Null after `load`/`reset` (no fresh addition to focus). */
  lastAddedId: string | null;
  /** Which hero element is being edited (opens the hero settings sheet), or null. */
  heroTab: HeroTab | null;
  /** The sub-page being edited (null = the home page). Sub-pages have no hero. */
  pageId: string | null;
  pageName: string;
  /** Cached home-page blocks while a sub-page is open, restored on exit. */
  _homeBlocks: Block[];
  dirty: boolean;
  /**
   * Preview mode (mobile `previewEnabled`): the canvas renders the website as it
   * will appear live — no edit outlines/handles, links launch, bottom nav hidden.
   */
  previewEnabled: boolean;

  load: (payload: {
    profileId: string | null;
    name: string;
    settings: WebsiteSettings;
    blocks: Block[];
    /** Start dirty (e.g. an AI draft that should auto-save). Defaults false. */
    dirty?: boolean;
  }) => void;
  reset: () => void;
  /** Open a sub-page for editing (its modules become the active blocks). */
  enterPage: (payload: { pageId: string; pageName: string; blocks: Block[] }) => void;
  /** Return to editing the home page. */
  exitToHome: () => void;
  select: (id: string | null) => void;
  editHero: (tab: HeroTab | null) => void;
  /** Toggle preview mode; entering preview closes any open editor selection. */
  togglePreview: () => void;
  addBlock: (block: Block) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (from: number, to: number) => void;
  setName: (name: string) => void;
  updateSettings: (patch: Partial<WebsiteSettings>) => void;
  /**
   * Commit a template apply (or live-preview state): replaces BOTH blocks and
   * settings at once (mobile `putWebpage` + `putSettings`).
   */
  applyTemplate: (blocks: Block[], settings: WebsiteSettings) => void;
  /** Capture blocks+settings for template preview/undo restore. */
  takeSnapshot: () => EditorSnapshot;
  /** Restore a previously captured snapshot (template preview cancel / Undo). */
  restoreSnapshot: (snapshot: EditorSnapshot) => void;
  markSaved: () => void;
}

const emptySettings: WebsiteSettings = {};

export const useEditorStore = create<EditorState>((set, get) => ({
  profileId: null,
  name: "",
  settings: emptySettings,
  blocks: [],
  selectedId: null,
  lastAddedId: null,
  heroTab: null,
  pageId: null,
  pageName: "",
  _homeBlocks: [],
  dirty: false,
  previewEnabled: false,

  load: ({ profileId, name, settings, blocks, dirty = false }) =>
    set({
      profileId,
      name,
      settings: { ...emptySettings, ...settings },
      blocks,
      selectedId: null,
      lastAddedId: null,
      heroTab: null,
      pageId: null,
      pageName: "",
      _homeBlocks: [],
      dirty,
      previewEnabled: false,
    }),

  reset: () =>
    set({
      profileId: null,
      name: "",
      settings: emptySettings,
      blocks: [],
      selectedId: null,
      heroTab: null,
      pageId: null,
      pageName: "",
      _homeBlocks: [],
      dirty: false,
      previewEnabled: false,
    }),

  enterPage: ({ pageId, pageName, blocks }) =>
    set((s) => ({
      pageId,
      pageName,
      // Cache home blocks only when leaving the home page (not page→page).
      _homeBlocks: s.pageId === null ? s.blocks : s._homeBlocks,
      blocks,
      selectedId: null,
      heroTab: null,
      dirty: false,
    })),

  exitToHome: () =>
    set((s) => ({
      pageId: null,
      pageName: "",
      blocks: s._homeBlocks,
      selectedId: null,
      heroTab: null,
      dirty: false,
    })),

  // Selecting a block closes the hero sheet, and vice-versa (mutually exclusive).
  select: (id) => set({ selectedId: id, heroTab: null }),
  editHero: (tab) => set({ heroTab: tab, selectedId: null }),

  togglePreview: () =>
    set((s) => ({
      previewEnabled: !s.previewEnabled,
      // Leaving edit mode closes any open block/hero editor sheet.
      selectedId: null,
      heroTab: null,
    })),

  addBlock: (block) =>
    set((s) => ({
      blocks: [...s.blocks, block],
      selectedId: block.id,
      lastAddedId: block.id,
      dirty: true,
    })),

  updateBlock: (id, patch) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as Block) : b,
      ),
      dirty: true,
    })),

  removeBlock: (id) =>
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      dirty: true,
    })),

  moveBlock: (from, to) =>
    set((s) => {
      const next = s.blocks.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { blocks: next, dirty: true };
    }),

  setName: (name) => set({ name, dirty: true }),

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch }, dirty: true })),

  applyTemplate: (blocks, settings) =>
    set({ blocks, settings, selectedId: null, heroTab: null, dirty: true }),

  takeSnapshot: () => ({ blocks: get().blocks, settings: get().settings }),

  restoreSnapshot: ({ blocks, settings }) =>
    set({ blocks, settings, dirty: true }),

  markSaved: () => set({ dirty: false }),
}));
