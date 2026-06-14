"use client";

import { Check } from "lucide-react";
import { heroDefaults } from "@/lib/builder/hero-defaults";
import { cn } from "@/lib/utils";
import type { HeroStyle, WebsiteSettings } from "@/lib/types/profile";

/**
 * StyleTab — a 3-column grid of the 7 hero styles, each shown with the same
 * static preview thumbnail the mobile app uses (assets/image/st1..st7 →
 * /style-previews/*). Selecting a style applies that style's full template
 * defaults (mobile resets the hero to the chosen template).
 */

const STYLES: { id: HeroStyle; label: string; img: string }[] = [
  { id: "style1", label: "Builder", img: "/style-previews/st1.png" },
  { id: "style2", label: "Style 2", img: "/style-previews/st2.jpeg" },
  { id: "style3", label: "Style 3", img: "/style-previews/st3.png" },
  { id: "style4", label: "Style 4", img: "/style-previews/st4.png" },
  { id: "style5", label: "Style 5", img: "/style-previews/st5.png" },
  { id: "style6", label: "Style 6", img: "/style-previews/st6.png" },
  { id: "style7", label: "Style 7", img: "/style-previews/st7.png" },
];

export function StyleTab({
  settings,
  update,
}: {
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
}) {
  const current = settings.style ?? "style2";

  return (
    <div className="grid grid-cols-3 gap-3">
      {STYLES.map(({ id, label, img }) => {
        const selected = current === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => update(heroDefaults(id))}
            className={cn(
              "relative flex flex-col items-center gap-1.5 rounded-2xl bg-surface p-1.5 transition-all",
              selected ? "ring-2 ring-primary" : "ring-1 ring-border",
            )}
          >
            {selected && (
              <span className="absolute end-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow">
                <Check className="size-3" />
              </span>
            )}
            <div className="h-[150px] w-full overflow-hidden rounded-xl border border-foreground/[0.06] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={label}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <span className="text-xs font-semibold text-foreground">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
