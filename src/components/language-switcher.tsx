"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const labels: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  sv: "Svenska",
  zh: "中文",
  fr: "Français",
  it: "Italiano",
  ku: "Kurdî",
  no: "Norsk",
  pt: "Português",
};

function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <span
      className={cn(
        "relative block size-5 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/flags/${locale}.svg`}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover"
      />
    </span>
  );
}

type MenuPos = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  dropUp: boolean;
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // Position the portalled menu against the trigger, flipping up when there
  // isn't room below.
  const computePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimated = 320;
    const dropUp = spaceBelow < estimated && rect.top > spaceBelow;

    const margin = 8;
    const width = Math.max(rect.width, 208);
    // Anchor to the trigger's start edge, but right-align (and clamp) when that
    // would push the menu off-screen.
    let left = rect.left;
    if (left + width > window.innerWidth - margin) left = rect.right - width;
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - width - margin),
    );

    setPos({
      left,
      width,
      dropUp,
      top: dropUp ? undefined : rect.bottom + 8,
      bottom: dropUp ? window.innerHeight - rect.top + 8 : undefined,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePos();
    window.addEventListener("resize", computePos);
    window.addEventListener("scroll", computePos, true);
    return () => {
      window.removeEventListener("resize", computePos);
      window.removeEventListener("scroll", computePos, true);
    };
  }, [open, computePos]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Flag locale={locale} />
        <span className="flex-1 truncate text-start">{labels[locale]}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
            }}
            className={cn(
              "animate-popover-in z-[100] max-h-[min(60vh,340px)] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg",
              pos.dropUp ? "origin-bottom" : "origin-top",
            )}
          >
            {locales.map((l) => {
              const active = l === locale;
              return (
                <li key={l}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => select(l)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted",
                      active
                        ? "font-medium text-foreground"
                        : "text-foreground/80",
                    )}
                  >
                    <Flag locale={l} />
                    <span className="flex-1 truncate">{labels[l]}</span>
                    {active && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
