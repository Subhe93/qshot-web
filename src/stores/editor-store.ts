import { create } from "zustand";
import type { Block } from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";

interface EditorState {
  profileId: string | null;
  name: string;
  settings: WebsiteSettings;
  blocks: Block[];
  selectedId: string | null;
  dirty: boolean;

  load: (payload: {
    profileId: string | null;
    name: string;
    settings: WebsiteSettings;
    blocks: Block[];
  }) => void;
  reset: () => void;
  select: (id: string | null) => void;
  addBlock: (block: Block) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (from: number, to: number) => void;
  setName: (name: string) => void;
  updateSettings: (patch: Partial<WebsiteSettings>) => void;
  markSaved: () => void;
}

const emptySettings: WebsiteSettings = {
  name: { text: "" },
  bio: "",
  profile_picture: { image_url: "", shape: "circle" },
  cover_photo: {},
};

export const useEditorStore = create<EditorState>((set) => ({
  profileId: null,
  name: "",
  settings: emptySettings,
  blocks: [],
  selectedId: null,
  dirty: false,

  load: ({ profileId, name, settings, blocks }) =>
    set({
      profileId,
      name,
      settings: { ...emptySettings, ...settings },
      blocks,
      selectedId: null,
      dirty: false,
    }),

  reset: () =>
    set({
      profileId: null,
      name: "",
      settings: emptySettings,
      blocks: [],
      selectedId: null,
      dirty: false,
    }),

  select: (id) => set({ selectedId: id }),

  addBlock: (block) =>
    set((s) => ({
      blocks: [...s.blocks, block],
      selectedId: block.id,
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

  markSaved: () => set({ dirty: false }),
}));
