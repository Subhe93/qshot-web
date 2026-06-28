"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, Check, ChevronsUpDown } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  /** Optional secondary line under the label. */
  description?: string;
  /** Optional leading node (icon/flag). */
  icon?: ReactNode;
}

/**
 * Searchable single-select, generalising the booking TimezonePicker: a field
 * button that opens a responsive BottomSheet (in-panel sub-view on desktop,
 * bottom sheet on mobile) with a pinned search box and a filtered, checkable
 * list. The search box only appears when there are more than five options — for
 * shorter lists it's a plain picker. Use this for any list with 6+ choices so
 * users can type to find an option instead of scrolling.
 */
export function SearchableSelect<T extends string | number>({
  value,
  options,
  onChange,
  title,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
}: {
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Sheet title. */
  title: string;
  /** Field text when nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value) ?? null;
  const showSearch = options.length > 5;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const label = o.label.toLowerCase();
      return (
        label.includes(q) ||
        label.replace(/[_/]/g, " ").includes(q) ||
        String(o.value).toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, options]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-muted-foreground")}>
          {selected?.icon}
          <span className="truncate">{selected ? selected.label : (placeholder ?? "")}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <BottomSheet title={title} onClose={() => setOpen(false)} bodyClassName="p-0">
          <div className="flex max-h-[70vh] flex-col">
            {showSearch && (
              <div className="shrink-0 border-b border-border p-3">
                <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {emptyText ?? ""}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {filtered.map((o) => (
                    <button
                      key={String(o.value)}
                      type="button"
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm",
                        o.value === value
                          ? "bg-primary/10 font-semibold text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {o.icon}
                        <span className="min-w-0">
                          <span className="block truncate">{o.label}</span>
                          {o.description && (
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              {o.description}
                            </span>
                          )}
                        </span>
                      </span>
                      {o.value === value && <Check className="size-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
