"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Redo2, Undo2 } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";

/**
 * Undo/redo header buttons + the Ctrl/Cmd+Z · Ctrl+Shift+Z · Ctrl+Y keyboard
 * shortcuts. Exactly one instance is mounted at a time (each builder layout's
 * header), so the document-level key listener lives here.
 *
 * The shortcuts step aside wherever the browser (or Quill) owns text-editing
 * undo — inputs, textareas, contenteditable — intercepting there would break
 * native field undo for a site-level one the user didn't ask for.
 *
 * `suspended` (Theme sheet open): the history operates on the REAL state,
 * which is invisible under the template preview overlay — undoing blind would
 * be confusing, so both buttons and shortcuts pause.
 */
export function UndoRedo({ suspended = false }: { suspended?: boolean }) {
  const t = useTranslations("builder");
  const canUndo = useEditorStore((s) => s._past.length > 0);
  const canRedo = useEditorStore((s) => s._future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  useEffect(() => {
    if (suspended) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (
        target != null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) useEditorStore.getState().redo();
        else useEditorStore.getState().undo();
      } else if (key === "y" && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [suspended]);

  const buttonClass = (enabled: boolean) =>
    cn(
      "flex size-9 items-center justify-center rounded-full text-foreground transition-colors",
      enabled ? "bg-muted hover:bg-border" : "bg-muted/50 text-muted-foreground/50",
    );

  return (
    <>
      <button
        type="button"
        onClick={undo}
        disabled={suspended || !canUndo}
        aria-label={t("undo")}
        title={t("undo")}
        className={buttonClass(!suspended && canUndo)}
      >
        {/* Undo points "back", which mirrors in RTL like the back arrow does. */}
        <Undo2 className="size-5 rtl:-scale-x-100" />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={suspended || !canRedo}
        aria-label={t("redo")}
        title={t("redo")}
        className={buttonClass(!suspended && canRedo)}
      >
        <Redo2 className="size-5 rtl:-scale-x-100" />
      </button>
    </>
  );
}
