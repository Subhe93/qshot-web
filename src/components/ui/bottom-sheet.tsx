"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal bottom sheet mirroring the mobile editors: dimmed backdrop, white panel
 * sliding up from the bottom with a grab handle and 20px top radius; centers as a
 * rounded card on larger screens. Optional `title`/close header and sticky
 * `footer`; the body scrolls between them.
 */
export function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
      onMouseDown={onClose}
    >
      <div className="animate-fade-in absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "animate-sheet-up relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[20px] bg-card shadow-2xl sm:max-h-[86vh] sm:rounded-[20px]",
          className,
        )}
      >
        {/* Grab handle */}
        <div className="flex shrink-0 justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
        </div>

        {title && (
          <div className="flex shrink-0 items-start gap-2 px-5 pb-3 pt-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-foreground">{title}</h2>
              {subtitle && (
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground hover:bg-foreground/15"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName ?? "p-4")}>
          {children}
        </div>

        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
