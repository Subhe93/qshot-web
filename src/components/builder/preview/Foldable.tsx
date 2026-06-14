"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Mirrors the mobile `ExpandableWidget`
 * (lib/features/website/widget/editor/expandable_widget.dart).
 *
 * When `foldable` is false/undefined, the header and content render unchanged
 * (the mobile `Column([header, body])` path).
 *
 * When `foldable` is true, the header gets a trailing chevron that toggles the
 * content. Mobile uses `ExpansionTile(initiallyExpanded: !previewEnabled)`, so
 * in the builder preview (preview disabled) it starts OPEN — we match that with
 * a default-open state.
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
  const [open, setOpen] = useState(true);

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
