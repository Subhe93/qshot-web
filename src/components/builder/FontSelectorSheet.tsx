"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  GOOGLE_FONTS,
  ensureGoogleFonts,
  fontStack,
} from "@/lib/builder/google-fonts";

/** Font picker bottom sheet — mirrors the mobile FontFamilySelectorLayout. */
export function FontSelectorSheet({
  value,
  onSelect,
  onClose,
}: {
  value?: string | null;
  onSelect: (font: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  // Preview every font in its own face.
  useEffect(() => {
    ensureGoogleFonts(GOOGLE_FONTS);
  }, []);

  const fonts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(q)) : GOOGLE_FONTS;
  }, [query]);

  return (
    <BottomSheet title="Website font" onClose={onClose}>
      <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fonts"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="mt-3 max-h-[55vh] overflow-y-auto">
        {fonts.map((font) => {
          const active = (value ?? "Roboto") === font;
          return (
            <button
              key={font}
              type="button"
              onClick={() => {
                onSelect(font);
                onClose();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-surface"
            >
              <span
                className="truncate text-lg text-foreground"
                style={{ fontFamily: fontStack(font) }}
              >
                {font}
              </span>
              {active && <Check className="size-5 shrink-0 text-primary" />}
            </button>
          );
        })}
        {fonts.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No fonts found
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
