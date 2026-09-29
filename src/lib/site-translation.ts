/**
 * Site translation — the SETTING only (docs/CONTRACT-website-translation.md).
 * The builder saves the owner's choice; the published site (Nuxt) is the one
 * that shows the language button and translates. Pure: no React, no I/O.
 *
 *   settings.translation = { enabled: boolean, languages?: string[] }
 *
 * A missing key means OFF. An empty/missing `languages` means the defaults.
 * The setting survives a downgrade; availability is decided from the plan at
 * render time, never by deleting the setting.
 *
 * Codes, labels and defaults MIRROR the Nuxt `utils/siteTranslation.ts` — keep
 * the two lists identical.
 */

import type { Account } from "@/lib/api/account";
import { planAvailable, planFeatureMap } from "@/lib/plan/features";

export interface SiteLanguage {
  /** Google Translate code. */
  code: string;
  /** Shown in its own language — a visitor looks for theirs, not ours. */
  label: string;
}

/** The stored shape. `languages` is absent (never `[]`) when none is picked. */
export interface SiteTranslation {
  enabled: boolean;
  languages?: string[];
}

export const SITE_LANGUAGES: readonly SiteLanguage[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "tr", label: "Türkçe" },
  { code: "ku", label: "Kurdî" },
  { code: "ckb", label: "کوردی" },
  { code: "sv", label: "Svenska" },
  { code: "no", label: "Norsk" },
  { code: "da", label: "Dansk" },
  { code: "nl", label: "Nederlands" },
  { code: "ru", label: "Русский" },
  { code: "zh-CN", label: "中文" },
  { code: "fa", label: "فارسی" },
  { code: "ur", label: "اردو" },
  { code: "hi", label: "हिन्दी" },
  { code: "ja", label: "日本語" },
];

export const DEFAULT_SITE_LANGUAGES: readonly string[] = [
  "en",
  "ar",
  "fr",
  "de",
  "es",
  "tr",
  "ku",
  "sv",
];

const BY_CODE = new Map(SITE_LANGUAGES.map((l) => [l.code, l]));

export function siteLanguage(code: string): SiteLanguage | undefined {
  return BY_CODE.get(code);
}

/** Supported codes only, de-duplicated, the owner's order kept. */
export function normaliseSiteLanguages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const code of raw) {
    if (typeof code !== "string" || seen.has(code) || !BY_CODE.has(code)) continue;
    seen.add(code);
    picked.push(code);
  }
  return picked;
}

/**
 * Tolerant read of a stored `settings.translation`. Anything that is not a
 * plain object reads as ABSENT (`undefined`); `enabled` is true only for the
 * boolean `true`; `languages` is dropped when nothing valid is left.
 */
export function normaliseSiteTranslation(raw: unknown): SiteTranslation | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as { enabled?: unknown; languages?: unknown };
  const languages = normaliseSiteLanguages(source.languages);
  const out: SiteTranslation = { enabled: source.enabled === true };
  if (languages.length > 0) out.languages = languages;
  return out;
}

/**
 * What goes on the wire. `undefined` = OMIT the whole key: the feature was
 * never turned on (off AND no languages), so an untouched site serialises
 * exactly as before. `languages` is omitted when empty — never `[]`. A
 * switched-off setting that still holds languages is kept: the owner's choice
 * survives a toggle-off.
 */
export function serialiseSiteTranslation(raw: unknown): SiteTranslation | undefined {
  const value = normaliseSiteTranslation(raw);
  if (!value) return undefined;
  if (!value.enabled && !value.languages) return undefined;
  return value;
}

export function translationEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  return normaliseSiteTranslation((settings as { translation?: unknown }).translation)?.enabled === true;
}

/** The owner's picks, or the defaults when none is picked. */
export function resolveSiteLanguages(translation: unknown): SiteLanguage[] {
  const picked = normaliseSiteLanguages(
    translation && typeof translation === "object"
      ? (translation as { languages?: unknown }).languages
      : undefined,
  );
  const codes = picked.length > 0 ? picked : DEFAULT_SITE_LANGUAGES;
  return codes.map((code) => BY_CODE.get(code)!);
}

/** Optional backend feature code ("Yes"/"No", like the other website features). */
export const SITE_TRANSLATION_FEATURE = "website_translation";

/**
 * Paid plans only. Generous while the account loads and for admins (as the
 * rest of the plan lib). When the backend ships the `website_translation`
 * code it decides ("Yes"/"No" through `planAvailable`); until then the rule is
 * "not the free plan".
 *
 * This gates the BUILDER ROW only — it never touches the stored setting.
 */
export function siteTranslationAllowed(account: Account | undefined): boolean {
  if (!account || account.user?.isAdmin) return true;
  if (planFeatureMap(account)[SITE_TRANSLATION_FEATURE] != null) {
    return planAvailable(account, SITE_TRANSLATION_FEATURE);
  }
  return !account.plan?.free;
}
