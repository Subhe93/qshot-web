"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEditorStore } from "@/stores/editor-store";
import { getProfile, saveProfile } from "@/lib/api/profiles";
import type { Block } from "@/lib/types/blocks";
import { AddBlockMenu } from "./AddBlockMenu";
import { BuilderCanvas } from "./BuilderCanvas";
import { SettingsPanel } from "./SettingsPanel";

// Seed shown for a brand-new profile so the canvas is never empty.
function demoBlocks(): Block[] {
  return [
    { id: nanoid(), type: "HeaderBlock", value: "Welcome 👋", size: 22, align: "center" },
    {
      id: nanoid(),
      type: "ParagraphBlock",
      content: "Tap any block to edit it, or add new ones from the left.",
    },
    {
      id: nanoid(),
      type: "ButtonBlock",
      layout_type: "list",
      buttons: [{ id: nanoid(), title: "Visit my website", url: "https://qshot.com" }],
    },
  ];
}

export function BuilderShell({ id }: { id: string }) {
  const t = useTranslations("builder");
  const name = useEditorStore((s) => s.name);
  const dirty = useEditorStore((s) => s.dirty);
  const settings = useEditorStore((s) => s.settings);
  const blocks = useEditorStore((s) => s.blocks);
  const setName = useEditorStore((s) => s.setName);
  const load = useEditorStore((s) => s.load);
  const markSaved = useEditorStore((s) => s.markSaved);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  useEffect(() => {
    let active = true;

    // New profile: seed locally, no network round-trip.
    if (id === "new") {
      load({
        profileId: id,
        name: "My profile",
        settings: { name: { text: "My profile" }, bio: "" },
        blocks: demoBlocks(),
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
        name: profile?.name ?? "My profile",
        settings: profile?.settings ?? { name: { text: "My profile" }, bio: "" },
        blocks: (profile?.settings?.modules as Block[] | undefined) ?? demoBlocks(),
      });
    })();
    return () => {
      active = false;
    };
  }, [id, load]);

  async function onSave() {
    setSaving(true);
    setSavedAt(false);
    try {
      await saveProfile(id, name, { ...settings, modules: blocks });
      markSaved();
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2000);
    } catch {
      // Surfaced softly; a toast system comes later.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-transparent px-2 py-1 text-sm font-medium hover:border-border focus:border-input focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="flex h-9 items-center gap-2 rounded-lg bg-dark px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : savedAt ? (
            <Check className="size-4" />
          ) : null}
          {savedAt ? t("saved") : t("save")}
        </button>
      </div>

      {/* Panes */}
      <div className="grid flex-1 grid-cols-[260px_1fr_320px] overflow-hidden">
        <aside className="overflow-y-auto border-e border-border bg-card p-4">
          <AddBlockMenu />
        </aside>
        <main className="overflow-y-auto bg-muted">
          <BuilderCanvas />
        </main>
        <aside className="overflow-y-auto border-s border-border bg-card p-4">
          <SettingsPanel />
        </aside>
      </div>
    </div>
  );
}
