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
   * Commit a template apply: replaces BOTH blocks and settings at once
   * (mobile `putWebpage` + `putSettings`).
   */
  applyTemplate: (blocks: Block[], settings: WebsiteSettings) => void;
  /** Capture blocks+settings for template preview/undo restore. */
  takeSnapshot: () => EditorSnapshot;
  /** Restore a previously captured snapshot (template preview cancel / Undo). */
  restoreSnapshot: (snapshot: EditorSnapshot) => void;
  markSaved: () => void;
  /**
   * EPHEMERAL template preview — mobile `WebsiteEditorCubit._pWebpage` /
   * `_pSettings`. The canvas renders `previewOverlay ?? real`, while `dirty`,
   * auto-save and the API payload only ever see the real fields, so a preview
   * can never leak into a save no matter how the sheet goes away. This is why
   * the old "mutate the store, restore a snapshot on cancel" design is gone:
   * it saved the preview whenever any close path missed the restore.
   */
  previewOverlay: EditorSnapshot | null;
  /** Monotonic counter: bumps when a preview lands, so the canvas can scroll
   *  to the hero (mobile d0c572db `scrollToTop`). */
  previewScrollSignal: number;
  setPreviewOverlay: (snapshot: EditorSnapshot) => void;
  clearPreviewOverlay: () => void;

  /**
   * UNDO/REDO history over the CONTENT pair {blocks, settings}. Snapshots are
   * O(1): every mutation builds new arrays/objects, so a snapshot is just the
   * old references. View state (selection, hero tab, preview mode) is not
   * history — undoing should never merely move the user's cursor around.
   *
   * `_past` holds states BEFORE each change (oldest first), `_future` holds
   * states undone from (nearest first). Any fresh mutation cuts `_future`.
   * Rapid bursts (typing, slider drags) coalesce into the entry that captured
   * the state before the burst. The stacks are cleared whenever the editing
   * CONTEXT changes (load/reset/page switches): entries from another page
   * would restore that page's blocks into this one.
   */
  _past: EditorSnapshot[];
  _future: EditorSnapshot[];
  _lastHistoryAt: number;
  undo: () => void;
  redo: () => void;
}

const emptySettings: WebsiteSettings = {};

/** Undo depth. 50 covers a long session; entries are reference pairs, so the
 *  memory cost is the retained old arrays, not copies. */
const HISTORY_LIMIT = 50;
/** Mutations closer together than this merge into one undo step. */
const HISTORY_COALESCE_MS = 800;

/**
 * History fields for a state about to MUTATE its content: record the current
 * {blocks, settings} into `_past` and cut `_future`. Called by every content
 * mutation and spread into its `set()` patch.
 */
function pushHistory(s: {
  blocks: Block[];
  settings: WebsiteSettings;
  _past: EditorSnapshot[];
  _future: EditorSnapshot[];
  _lastHistoryAt: number;
}): Pick<EditorState, "_past" | "_future" | "_lastHistoryAt"> {
  const now = Date.now();
  // A burst (typing, slider drag) keeps the entry that captured the state
  // before the burst began — but only when there's nothing redoable to cut.
  if (now - s._lastHistoryAt < HISTORY_COALESCE_MS && s._future.length === 0) {
    return { _past: s._past, _future: s._future, _lastHistoryAt: now };
  }
  const past = [...s._past, { blocks: s.blocks, settings: s.settings }];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { _past: past, _future: [], _lastHistoryAt: now };
}

/** Cleared history — for load/reset/page switches (context changes). */
const NO_HISTORY: Pick<EditorState, "_past" | "_future" | "_lastHistoryAt"> = {
  _past: [],
  _future: [],
  _lastHistoryAt: 0,
};

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
      previewOverlay: null,
      ...NO_HISTORY,
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
      previewOverlay: null,
      ...NO_HISTORY,
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
      ...NO_HISTORY,
    })),

  exitToHome: () =>
    set((s) => ({
      pageId: null,
      pageName: "",
      blocks: s._homeBlocks,
      selectedId: null,
      heroTab: null,
      dirty: false,
      ...NO_HISTORY,
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
      ...pushHistory(s),
      blocks: [...s.blocks, block],
      selectedId: block.id,
      lastAddedId: block.id,
      dirty: true,
    })),

  updateBlock: (id, patch) =>
    set((s) => ({
      ...pushHistory(s),
      blocks: s.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as Block) : b,
      ),
      dirty: true,
    })),

  removeBlock: (id) =>
    set((s) => ({
      ...pushHistory(s),
      blocks: s.blocks.filter((b) => b.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      dirty: true,
    })),

  moveBlock: (from, to) =>
    set((s) => {
      const next = s.blocks.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...pushHistory(s), blocks: next, dirty: true };
    }),

  setName: (name) => set({ name, dirty: true }),

  updateSettings: (patch) =>
    set((s) => ({
      ...pushHistory(s),
      settings: { ...s.settings, ...patch },
      dirty: true,
    })),

  applyTemplate: (blocks, settings) =>
    set((s) => ({
      ...pushHistory(s),
      blocks,
      settings,
      selectedId: null,
      heroTab: null,
      dirty: true,
    })),

  takeSnapshot: () => ({ blocks: get().blocks, settings: get().settings }),

  restoreSnapshot: ({ blocks, settings }) =>
    set((s) => ({ ...pushHistory(s), blocks, settings, dirty: true })),

  markSaved: () => set({ dirty: false }),

  previewOverlay: null,
  previewScrollSignal: 0,

  setPreviewOverlay: (snapshot) =>
    set((s) => ({
      previewOverlay: snapshot,
      previewScrollSignal: s.previewScrollSignal + 1,
    })),

  clearPreviewOverlay: () => set({ previewOverlay: null }),

  _past: [],
  _future: [],
  _lastHistoryAt: 0,

  undo: () =>
    set((s) => {
      const previous = s._past[s._past.length - 1];
      if (previous == null) return s;
      return {
        _past: s._past.slice(0, -1),
        _future: [{ blocks: s.blocks, settings: s.settings }, ...s._future],
        // Break coalescing: the next edit must start a fresh undo step, or it
        // would merge into (and effectively erase) the step just restored.
        _lastHistoryAt: 0,
        blocks: previous.blocks,
        settings: previous.settings,
        // The restored state may not contain the block whose editor sheet is
        // open — close editors rather than leave one pointing at nothing.
        selectedId: null,
        heroTab: null,
        dirty: true,
      };
    }),

  redo: () =>
    set((s) => {
      const [next, ...rest] = s._future;
      if (next == null) return s;
      return {
        _past: [...s._past, { blocks: s.blocks, settings: s.settings }],
        _future: rest,
        _lastHistoryAt: 0,
        blocks: next.blocks,
        settings: next.settings,
        selectedId: null,
        heroTab: null,
        dirty: true,
      };
    }),
}));
