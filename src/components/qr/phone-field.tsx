"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { ChevronDown, Search, X } from "lucide-react";
import {
  COUNTRIES,
  countryName,
  flagEmoji,
  type Country,
} from "@/lib/data/countries";

/**
 * Phone input with a country picker matching the mobile `country_picker`:
 * a flag + dial-code button that opens a searchable modal of the full country
 * list. The stored value is the international form: "+<dial> <number>".
 */
export function PhoneField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (international: string) => void;
}) {
  const locale = useLocale();

  // Default country derived from the active locale's region (falls back to US).
  const defaultIso = useMemo(() => {
    try {
      const region = new Intl.Locale(locale).maximize().region;
      if (region && COUNTRIES.some((c) => c.iso === region)) return region;
    } catch {
      /* ignore */
    }
    return "US";
  }, [locale]);

  const [country, setCountry] = useState<Country>(
    () => COUNTRIES.find((c) => c.iso === defaultIso) ?? COUNTRIES[0],
  );
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(() =>
    value?.startsWith("+") ? value.replace(/^\+\d+\s?/, "") : (value ?? ""),
  );

  function emit(next: { c?: Country; n?: string }) {
    const c = next.c ?? country;
    const n = (next.n ?? number).trim();
    onChange(n ? `+${c.dial} ${n}` : "");
  }

  return (
    <>
      <div className="flex h-11 items-center rounded-lg border border-input bg-card">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full shrink-0 items-center gap-1 rounded-s-lg px-3 hover:bg-muted"
        >
          <span className="text-base leading-none">
            {flagEmoji(country.iso)}
          </span>
          <span className="text-sm">+{country.dial}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        <span className="h-5 w-px bg-border" />
        <input
          type="tel"
          value={number}
          placeholder={placeholder}
          onChange={(e) => {
            setNumber(e.target.value);
            emit({ n: e.target.value });
          }}
          className="h-full w-full min-w-0 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && (
        <CountryPickerModal
          locale={locale}
          onClose={() => setOpen(false)}
          onSelect={(c) => {
            setCountry(c);
            setOpen(false);
            emit({ c });
          }}
        />
      )}
    </>
  );
}

function CountryPickerModal({
  locale,
  onSelect,
  onClose,
}: {
  locale: string;
  onSelect: (c: Country) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sort by localized name; filter by name or dial code.
  const list = useMemo(() => {
    const withNames = COUNTRIES.map((c) => ({
      ...c,
      name: countryName(c.iso, locale),
    }));
    withNames.sort((a, b) => a.name.localeCompare(b.name, locale));
    const q = query.trim().toLowerCase();
    if (!q) return withNames;
    return withNames.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q),
    );
  }, [locale, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-lg bg-muted px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-full w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {list.map((c) => (
            <button
              key={c.iso}
              type="button"
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm hover:bg-muted"
            >
              <span className="text-lg">{flagEmoji(c.iso)}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-muted-foreground">+{c.dial}</span>
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              —
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
