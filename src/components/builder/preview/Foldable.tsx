"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";

/**
 * Mirrors the mobile `ExpandableWidget`
 * (lib/features/website/widget/editor/expandable_widget.dart).
 *
 * When `foldable` is false/undefined, the header and content render unchanged
 * (the mobile `Column([header, body])` path).
 *
 * When `foldable` is true, the header gets a trailing chevron that toggles the
 * content. Mobile uses `ExpansionTile(initiallyExpanded: !previewEnabled)`:
 * open while editing, collapsed in preview mode — matched here via the editor
 * store's `previewEnabled`.
 */
export function Foldable({
  foldable,
  header,
  children,
}: {
  foldable?: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  // Mobile uses `initiallyExpanded: !previewEnabled` — open while editing,
  // collapsed in preview so the dropdown's real (folded) state is visible.
  const previewEnabled = useEditorStore((s) => s.previewEnabled);
  const [open, setOpen] = useState(!previewEnabled);
  // Re-apply the mode default when toggling between edit and preview.
  useEffect(() => {
    setOpen(!previewEnabled);
  }, [previewEnabled]);

  if (!foldable) {
    return (
      <>
        {header}
        {children}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center pe-4 text-start"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <ChevronDown
          size={20}
          className={`shrink-0 text-foreground/50 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
          aria-hidden
        />
      </button>
      {open && children}
    </>
  );
}
