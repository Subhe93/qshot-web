"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProfileCard } from "@/components/profile-card";
import type { ProfileSummary } from "@/lib/types/profile";

/**
 * Full-height, horizontal carousel of website cards.
 * - Mouse wheel scrolls it horizontally (vertical wheel → fast sideways scroll).
 * - Prev/next buttons step one card at a time (smooth).
 * - Soft fade overlays on each edge hint that more cards exist off-screen.
 *
 * Navigation/measurement use scrollIntoView + getBoundingClientRect so it stays
 * correct in both LTR and RTL (no manual scrollLeft sign math).
 */
export function ProfileSlider({
  items,
  onCreate,
}: {
  items: ProfileSummary[];
  onCreate: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // Visual edge state — drives both the fade overlays and the nav buttons.
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  // Show the creative create-card when there are few sites (≤2).
  const showCreate = items.length <= 2;
  // Keep the nav buttons visible whenever there's more than one card.
  const hasMultiple = items.length + (showCreate ? 1 : 0) > 1;

  // Recompute the active index + which edges have hidden content. Pixel-based
  // (getBoundingClientRect) so it's direction-agnostic.
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const cr = el.getBoundingClientRect();
    const mid = cr.left + cr.width / 2;

    // Detect hidden content by the visual left/right extents across ALL cards —
    // direction-agnostic, so the left shadow shows in RTL too (where the clipped
    // card is the last DOM child, not the first).
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const r = (child as HTMLElement).getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left);
      maxRight = Math.max(maxRight, r.right);
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setShowStart(minLeft < cr.left - 1); // content hidden past the LEFT edge
    setShowEnd(maxRight > cr.right + 1); // content hidden past the RIGHT edge
    setIndex(best);
  }, []);

  const go = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(el.children.length - 1, i));
    (el.children[clamped] as HTMLElement | undefined)?.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  }, []);

  // Keep edge/index state synced with manual scroll + resize.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [measure, items.length]);

  // Translate vertical mouse-wheel into horizontal scrolling (direction-aware).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Ignore horizontal trackpad gestures (the browser handles those natively).
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll
      e.preventDefault();
      const rtl = getComputedStyle(el).direction === "rtl";
      el.scrollBy({ left: rtl ? -e.deltaY : e.deltaY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Nav buttons — kept visible whenever there's more than one card. */}
      {hasMultiple && (
        <div className="mb-3 flex shrink-0 items-center justify-end gap-2">
          <NavButton
            dir="prev"
            disabled={!showStart}
            onClick={() => go(index - 1)}
          />
          <NavButton dir="next" disabled={!showEnd} onClick={() => go(index + 1)} />
        </div>
      )}

      {/* Track */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className="flex h-full items-stretch gap-5 overflow-x-auto overscroll-x-contain pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((p) => (
            <div
              key={p._id ?? p.id}
              className="h-full w-[86vw] max-w-95 shrink-0 sm:w-90"
            >
              <ProfileCard profile={p} />
            </div>
          ))}

          {showCreate && (
            <div className="h-full w-[86vw] max-w-95 shrink-0 sm:w-90">
              <CreateCard onClick={onCreate} />
            </div>
          )}
        </div>

        {/* Edge shadows — hint that more cards exist off-screen. */}
        <span
          aria-hidden
          className={
            "pointer-events-none absolute bottom-4 left-0 top-1 w-12 bg-gradient-to-r from-secondary/35 via-primary/20 to-transparent transition-opacity duration-200 " +
            (showStart ? "opacity-100" : "opacity-0")
          }
        />
        <span
          aria-hidden
          className={
            "pointer-events-none absolute bottom-4 right-0 top-1 w-12 bg-gradient-to-l from-primary/35 via-secondary/20 to-transparent transition-opacity duration-200 " +
            (showEnd ? "opacity-100" : "opacity-0")
          }
        />
      </div>
    </div>
  );
}

function NavButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={dir}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="size-5 rtl:rotate-180" />
    </button>
  );
}

/** Creative call-to-action card shown when the user has few sites. */
function CreateCard({ onClick }: { onClick: () => void }) {
  const t = useTranslations("dashboard");
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full min-h-[300px] w-full flex-col items-center justify-center overflow-hidden rounded-[22px] border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-card to-secondary/10 p-8 text-center transition-all hover:border-primary/60 hover:shadow-soft"
    >
      {/* Decorative glow blobs */}
      <span className="brand-gradient pointer-events-none absolute -right-12 -top-12 size-36 rounded-full opacity-20 blur-2xl" />
      <span className="brand-gradient pointer-events-none absolute -bottom-14 -left-10 size-36 rounded-full opacity-20 blur-2xl" />

      <span className="brand-gradient relative flex size-20 items-center justify-center rounded-3xl text-white shadow-lg transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
        <Plus className="size-9" />
      </span>
      <p className="relative mt-5 text-lg font-bold text-foreground">
        {t("newProfile")}
      </p>
      <p className="relative mt-1.5 max-w-[230px] text-sm text-muted-foreground">
        {t("createCardDesc")}
      </p>
      <span className="relative mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-4 py-2 text-sm font-semibold text-primary">
        <Sparkles className="size-4" />
        {t("createFirst")}
      </span>
    </button>
  );
}
