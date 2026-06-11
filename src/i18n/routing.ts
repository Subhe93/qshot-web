import { defineRouting } from "next-intl/routing";

// Locales mirror the mobile app (lib/main.dart supportedLocales).
export const locales = [
  "en", // English
  "ar", // Arabic (RTL)
  "sv", // Swedish
  "zh", // Chinese (Simplified)
  "fr", // French
  "it", // Italian
  "ku", // Kurdish
  "no", // Norwegian
  "pt", // Portuguese
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Right-to-left locales.
export const rtlLocales: Locale[] = ["ar"];

export function getDirection(locale: string): "rtl" | "ltr" {
  return rtlLocales.includes(locale as Locale) ? "rtl" : "ltr";
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});
