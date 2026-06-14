"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPickerField } from "@/components/ui/color-picker";

/**
 * Shared building blocks for the mobile-style block editors (tab bar, grouped
 * cards, rows, toggle switch). Mirrors the Flutter sheet_styles helpers so every
 * block editor looks consistent.
 */

export interface SheetTab<T extends string> {
  value: T;
  label: string;
  Icon: LucideIcon;
}

export function SheetTabBar<T extends string>({
  tabs,
  current,
  onChange,
}: {
  tabs: SheetTab<T>[];
  current: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {tabs.map((tab) => {
        const active = current === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-semibold transition-colors",
              active ? "bg-foreground/[0.07] text-foreground" : "text-foreground/45",
            )}
          >
            <tab.Icon
              className="size-[15px]"
              style={active ? { color: "var(--primary)" } : undefined}
            />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** A rounded grouped card with hairline dividers between rows (iOS-style). */
export function GroupedCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface">{children}</div>
  );
}

/** One row inside a GroupedCard: colored icon chip + title + trailing control. */
export function GroupedRow({
  Icon,
  color = "var(--primary)",
  customIcon,
  title,
  trailing,
  onClick,
  divider = true,
}: {
  Icon?: LucideIcon;
  color?: string;
  customIcon?: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  divider?: boolean;
}) {
  const chip = customIcon ?? (
    <span
      className="flex size-[30px] shrink-0 items-center justify-center rounded-lg"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {Icon && <Icon className="size-[17px]" style={{ color }} />}
    </span>
  );
  const inner = (
    <>
      {chip}
      <span className="flex-1 truncate text-sm font-medium text-foreground">
        {title}
      </span>
      {trailing}
    </>
  );
  return (
    <>
      {divider && <div className="ms-14 h-px bg-foreground/[0.08] first:hidden" />}
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex h-[55px] w-full items-center gap-3 px-3 text-start transition-colors hover:bg-foreground/[0.02]"
        >
          {inner}
        </button>
      ) : (
        <div className="flex h-[55px] w-full items-center gap-3 px-3">{inner}</div>
      )}
    </>
  );
}

/** iOS-style toggle switch (mobile Switch.adaptive). */
export function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-foreground/15",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
          checked ? "start-[18px]" : "start-0.5",
        )}
      />
    </button>
  );
}

/** A grouped-card row pairing a tappable color swatch with an enable toggle. */
export function ColorRow({
  label,
  color,
  enabled,
  onColor,
  onToggle,
}: {
  label: string;
  color: number;
  enabled: boolean;
  onColor: (argb: number) => void;
  onToggle: (value: boolean) => void;
}) {
  return (
    <>
      <div className="ms-14 h-px bg-foreground/[0.08] first:hidden" />
      <div className="flex h-[55px] w-full items-center gap-3 px-3">
        <ColorPickerField value={color} onChange={onColor} compact />
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {label}
        </span>
        <ToggleSwitch checked={enabled} onChange={onToggle} />
      </div>
    </>
  );
}

/** Small uppercase section label above a group. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}
