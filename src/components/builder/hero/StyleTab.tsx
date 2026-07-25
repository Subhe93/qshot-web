"use client";

import { Check } from "lucide-react";
import { heroDefaults } from "@/lib/builder/hero-defaults";
import { mergeUserContent } from "@/lib/builder/template-apply";
import { cn } from "@/lib/utils";
import type { HeroStyle, WebsiteSettings } from "@/lib/types/profile";

/**
 * StyleTab — a 3-column grid of the 7 hero styles, each shown with the same
 * static preview thumbnail the mobile app uses (assets/image/st1..st7 →
 * /style-previews/*). Selecting a style applies that style's defaults with
 * the user's content carried over (mobile `HeroSettingsCubit.set style` at
 * origin/dev runs `mergeUserContent(current, defaults)` — texts, urls and
 * uploaded images survive; visual fields reset to the style's defaults).
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
            onClick={() => {
              // Mobile `set style`: merge user content into the style's
              // defaults, then REPLACE exactly these hero fields with the
              // merged values (fields the style doesn't use become null, as
              // mobile serializes them). name / bio / floating button / font
              // are left untouched by the cubit.
              const merged = mergeUserContent(settings, heroDefaults(id));
              update({
                style: merged.style,
                background: merged.background ?? null,
                header: merged.header ?? null,
                cover_photo: merged.cover_photo ?? null,
                logo: merged.logo ?? null,
                profile_picture: merged.profile_picture ?? null,
                title: merged.title ?? null,
                text: merged.text ?? null,
                button1: merged.button1 ?? null,
                button2: merged.button2 ?? null,
                font_color: merged.font_color ?? null,
                card_style: merged.card_style ?? null,
              });
            }}
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
