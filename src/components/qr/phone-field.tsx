"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Search, X, Check } from "lucide-react";
import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import {
  COUNTRIES,
  countryName,
  flagEmoji,
  type Country,
} from "@/lib/data/countries";

/**
 * Professional international phone input (libphonenumber-js powered):
 * - country picker (flag + dial code) with a searchable modal of all countries
 * - as-you-type national formatting per the selected country
 * - per-country validation with an inline error for malformed numbers
 * - automatic country detection (IP geolocation → locale region → US)
 * - emits the E.164 value ("+9715…") or "" when empty
 */
export function PhoneField({
  value,
  placeholder,
  onChange,
  onValidChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (e164: string) => void;
  /** Reports whether the current input is a valid (or empty) phone number. */
  onValidChange?: (valid: boolean) => void;
}) {
  const locale = useLocale();
  const tc = useTranslations("common");

  // Default country from the active locale's region (refined by IP below).
  const localeIso = useMemo<string>(() => {
    try {
      const region = new Intl.Locale(locale).maximize().region;
      if (region && COUNTRIES.some((c) => c.iso === region)) return region;
    } catch {
      /* ignore */
    }
    return "US";
  }, [locale]);

  // Parse an incoming value once to seed the country + national digits.
  const seed = useMemo(() => {
    if (value) {
      const p = parsePhoneNumberFromString(value);
      if (p) {
        const c =
          (p.country && COUNTRIES.find((x) => x.iso === p.country)) ||
          COUNTRIES.find((x) => x.dial === p.countryCallingCode);
        if (c) return { country: c, digits: p.nationalNumber as string };
      }
      if (!value.startsWith("+")) return { digits: value.replace(/\D/g, "") };
    }
    return {};
    // Seed only from the initial value; later edits are driven by local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [country, setCountry] = useState<Country>(
    () =>
      seed.country ??
      COUNTRIES.find((c) => c.iso === localeIso) ??
      COUNTRIES[0],
  );
  const [digits, setDigits] = useState<string>(seed.digits ?? "");
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const autoDetectedRef = useRef(false);

  // Automatic country detection by IP (once), only when the field is untouched
  // and empty — never override a value the user typed or that came in.
  useEffect(() => {
    if (value || seed.country || autoDetectedRef.current) return;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 3000);
    fetch("https://ipwho.is/?fields=country_code", { signal: ac.signal })
      .then((r) => r.json())
      .then((d: { country_code?: string }) => {
        const iso = d?.country_code;
        const match = iso && COUNTRIES.find((c) => c.iso === iso);
        if (match && !touched && !digits) {
          autoDetectedRef.current = true;
          setCountry(match);
        }
      })
      .catch(() => {
        /* offline / blocked — keep locale default */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Display the national number formatted as-you-type for the chosen country.
  const display = useMemo(
    () => (digits ? new AsYouType(country.iso as CountryCode).input(digits) : ""),
    [digits, country],
  );

  const e164 = digits ? `+${country.dial}${digits}` : "";
  const valid = e164 === "" || isValidPhoneNumber(e164);
  const showError = touched && digits.length > 0 && !valid;

  // Keep the parent informed (value + validity) whenever they change.
  useEffect(() => {
    onChange(e164);
    onValidChange?.(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e164, valid]);

  function onInput(raw: string) {
    setTouched(true);
    setDigits(raw.replace(/\D/g, ""));
  }
  function pickCountry(c: Country) {
    setCountry(c);
    setOpen(false);
    setTouched(true);
  }

  return (
    <>
      <div
        className={`flex h-11 items-center rounded-lg border bg-card ${
          showError ? "border-error" : "border-input"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full shrink-0 items-center gap-1 rounded-s-lg px-3 hover:bg-muted"
        >
          <span className="text-base leading-none">{flagEmoji(country.iso)}</span>
          <span className="text-sm">+{country.dial}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        <span className="h-5 w-px bg-border" />
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={display}
          placeholder={placeholder}
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => setTouched(true)}
          className="h-full w-full min-w-0 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {digits.length > 0 && valid && (
          <Check className="me-3 size-4 shrink-0 text-success" />
        )}
      </div>
      {showError && <p className="mt-1 text-xs text-error">{tc("invalidPhone")}</p>}

      {open && (
        <CountryPickerModal
          locale={locale}
          selectedIso={country.iso}
          searchPlaceholder={tc("search")}
          onClose={() => setOpen(false)}
          onSelect={pickCountry}
        />
      )}
    </>
  );
}

function CountryPickerModal({
  locale,
  selectedIso,
  searchPlaceholder,
  onSelect,
  onClose,
}: {
  locale: string;
  selectedIso: string;
  searchPlaceholder: string;
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
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-lg bg-muted px-3">
            <Search className="size-4 text-muted-foreground" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-full w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
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
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm hover:bg-muted ${
                c.iso === selectedIso ? "bg-primary/10" : ""
              }`}
            >
              <span className="text-lg">{flagEmoji(c.iso)}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-muted-foreground">+{c.dial}</span>
              {c.iso === selectedIso && <Check className="size-4 text-primary" />}
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
