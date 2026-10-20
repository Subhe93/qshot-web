"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleAlert, Copy, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformIconFile, type PlatformStatus } from "@/lib/platform-redirect/model";

/** The platform's original brand mark on a soft tile. `label` is the
 *  admin-editable title, used for the alt text. */
export function PlatformIcon({
  platform,
  label,
  size = "md",
  className,
}: {
  platform: string;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const file = platformIconFile(platform);
  const box = size === "lg" ? "size-14 rounded-2xl p-3" : size === "sm" ? "size-8 rounded-lg p-1.5" : "size-11 rounded-xl p-2.5";
  if (file === "link.svg") {
    return (
      <span className={cn("brand-tint-soft flex shrink-0 items-center justify-center text-primary", box, className)}>
        <Link2 className="size-1/2" aria-hidden />
      </span>
    );
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center border border-border bg-white shadow-soft", box, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand-icons/colored/${file}`} alt={label} draggable={false} className="size-full object-contain" />
    </span>
  );
}

export function StatusBadge({ status }: { status: PlatformStatus }) {
  const t = useTranslations("platformLinks");
  const active = status === "active";
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        active ? "bg-success/10 text-[#1f8f43]" : "bg-warning/15 text-[#9a6700]",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-warning")} aria-hidden />
      {active ? t("statusActive") : t("statusPaused")}
    </span>
  );
}

/** Copies `value`; the icon flips to a check for 1.5 s. Icon-only — the
 *  `label` is the accessible name. */
export function CopyButton({
  value,
  label,
  className,
  size = "md",
}: {
  value: string;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const t = useTranslations("platformLinks");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure context / permission) — select-and-copy
      // fallback via a transient textarea keeps the button useful.
      try {
        const area = document.createElement("textarea");
        area.value = value;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
        setCopied(true);
      } catch {
        /* nothing more to try */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? t("copied") : label}
      title={copied ? t("copied") : label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "sm" ? "size-8" : "size-9",
        copied && "text-success hover:text-success",
        className,
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </button>
  );
}

export function InlineError({
  id,
  message,
  examples,
  onExample,
  className,
}: {
  id?: string;
  message: string;
  /** Server `examples` to show under the sentence (host/format refusals). */
  examples?: string[];
  onExample?: (example: string) => void;
  className?: string;
}) {
  const t = useTranslations("platformLinks");
  return (
    <div
      id={id}
      role="alert"
      className={cn("animate-fade-in rounded-xl border border-error/30 bg-error/5 px-3 py-2.5", className)}
    >
      <p className="flex items-start gap-2 text-sm font-medium text-error">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{message}</span>
      </p>
      {examples && examples.length > 0 && (
        <div className="mt-2 ps-6">
          <p className="text-xs font-semibold text-foreground/60">{t("examples")}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {examples.slice(0, 4).map((example) => (
              <li key={example}>
                {onExample ? (
                  <button
                    type="button"
                    dir="ltr"
                    onClick={() => onExample(example)}
                    className="max-w-full truncate rounded-md bg-card px-2 py-1 text-start font-mono text-[11px] text-foreground/75 ring-1 ring-border hover:bg-muted"
                  >
                    {example}
                  </button>
                ) : (
                  <span dir="ltr" className="block truncate font-mono text-[11px] text-foreground/75">
                    {example}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-foreground/50", className)}>
      {children}
    </p>
  );
}
