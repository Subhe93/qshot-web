"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** One selectable layout: its enum value, a label, and the illustration file
 *  under public/layouts/. */
export interface LayoutOption<T extends string> {
  type: T;
  label: string;
  svg: string;
}

/**
 * Layout chooser shown in every block editor's "Layout" tab. Responsive:
 *  - Mobile (the bottom-sheet builder): the swipe slider, matching the Flutter
 *    app's PageView — one card at a time, arrows + dots, and it scrolls the strip
 *    to the selected card (the old version forgot this, so it looked stuck on the
 *    first preview).
 *  - Desktop (the Elementor-style panel, >=1024px): a grid of ALL previews so
 *    layouts can be compared and picked at a glance.
 */
export function LayoutPicker<T extends string>(props: {
  options: LayoutOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <LayoutGrid {...props} /> : <LayoutSlider {...props} />;
}

/** Thumbnail illustration on a white frame (the wireframes are light-grey on
 *  white). */
function Thumb({ svg }: { svg: string }) {
  return (
    <div className="flex aspect-[281/134] w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/layouts/${svg}`}
        alt=""
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function SelectedBadge() {
  return (
    <span className="absolute end-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow">
      <Check className="size-3" />
    </span>
  );
}

// ── Desktop: all previews in a grid ──
function LayoutGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: LayoutOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((l) => {
        const selected = l.type === value;
        return (
          <button
            key={l.type}
            type="button"
            onClick={() => onChange(l.type)}
            aria-pressed={selected}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-2xl border p-2.5 text-center transition-colors",
              selected
                ? "border-primary bg-primary/[0.04]"
                : "border-border hover:border-primary/40",
            )}
          >
            {selected && <SelectedBadge />}
            <Thumb svg={l.svg} />
            <span className="text-xs font-semibold text-foreground">{l.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Mobile: one-card swipe slider with arrows + dots (matches the app) ──
function LayoutSlider<T extends string>({
  options,
  value,
  onChange,
}: {
  options: LayoutOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((l) => l.type === value),
  );

  // Keep the strip scrolled to the selected card so arrows/dots actually move it.
  useEffect(() => {
    const slide = scrollRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedIndex]);

  const go = (i: number) =>
    onChange(options[Math.min(options.length - 1, Math.max(0, i))].type);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <Arrow dir="prev" disabled={selectedIndex === 0} onClick={() => go(selectedIndex - 1)} />
        <div
          ref={scrollRef}
          className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((l) => {
            const selected = l.type === value;
            return (
              <button
                key={l.type}
                type="button"
                onClick={() => onChange(l.type)}
                className={cn(
                  "relative flex w-full shrink-0 snap-center flex-col items-center gap-3 rounded-2xl border p-3 transition-colors",
                  selected ? "border-primary bg-primary/[0.04]" : "border-transparent",
                )}
              >
                {selected && <SelectedBadge />}
                <Thumb svg={l.svg} />
                <span className="text-sm font-semibold text-foreground">{l.label}</span>
              </button>
            );
          })}
        </div>
        <Arrow
          dir="next"
          disabled={selectedIndex === options.length - 1}
          onClick={() => go(selectedIndex + 1)}
        />
      </div>

      <div className="flex justify-center gap-1.5">
        {options.map((l, i) => (
          <button
            key={l.type}
            type="button"
            aria-label={l.label}
            onClick={() => onChange(l.type)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selectedIndex ? "w-3.5 bg-primary" : "w-1.5 bg-primary/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity hover:bg-muted disabled:opacity-30"
    >
      {dir === "prev" ? (
        <ChevronLeft className="size-5 rtl:rotate-180" />
      ) : (
        <ChevronRight className="size-5 rtl:rotate-180" />
      )}
    </button>
  );
}
