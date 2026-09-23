"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  History,
  IdCard,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_DOMAIN } from "@/lib/site-domain";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TEMP_REDIRECT_PLATFORMS } from "@/lib/temp-redirect/domains";
import {
  isTempRedirectEndValid,
  tempRedirectLadderDays,
  tempRedirectLatestEnd,
  TEMP_REDIRECT_MIN_LEAD_MS,
} from "@/lib/temp-redirect/durations";
import { tempRedirectDisplayLabel } from "@/lib/temp-redirect/model";
import {
  buildTempRedirectTargets,
  resolveCustomTempRedirectTarget,
  TEMP_REDIRECT_MAX_URL_LENGTH,
  type TempRedirectProfileSource,
  type TempRedirectTarget,
} from "@/lib/temp-redirect/targets";
import type { TempRedirectController, TempRedirectGate } from "./use-temp-redirect";
import { formatMoment, presetDaysLabel, tempRedirectErrorMessage } from "./copy";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

interface Preset {
  label: string;
  ms: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD`, device-local, for `<input type="date">`. */
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `HH:mm`, device-local, for `<input type="time">`. */
function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * "Point my profile link somewhere else until…" — destination + end time in
 * one sheet (mobile `TempRedirectSheet`). Deliberately not a page: the user is
 * at a registration desk with a lanyard in one hand.
 */
export function TempRedirectSheet({
  profile,
  profileHost,
  controller,
  gate,
  onClose,
  onUpgrade,
}: {
  profile: TempRedirectProfileSource;
  profileHost: string;
  controller: TempRedirectController;
  gate: TempRedirectGate;
  onClose: () => void;
  /** A plan refusal from the server: close, then open the upgrade dialog. */
  onUpgrade: () => void;
}) {
  const t = useTranslations("tempRedirect");
  const tc = useTranslations("common");
  const locale = useLocale();
  const maxDays = gate.maxDays;

  // This profile's own destinations, fixed for the life of the sheet (mobile
  // `late final _targets`). Only this profile's — product decision 2026-09-2x:
  // one profile only (mobile 05d3428c): a redirect belongs to one profile, and
  // a list mixing several made it unclear which site a destination came from.
  const [targets] = useState<TempRedirectTarget[]>(() =>
    buildTempRedirectTargets(profile, { siteDomain: SITE_DOMAIN }),
  );

  const presets = useMemo<Preset[]>(
    () => [
      { label: t("preset1h"), ms: HOUR_MS },
      ...tempRedirectLadderDays(maxDays).map((days) => ({
        label: presetDaysLabel(t, days),
        ms: days * DAY_MS,
      })),
    ],
    [t, maxDays],
  );

  // Reopening while a redirect is live pre-selects what is actually running —
  // landing on the first row would invite "confirming" a destination the user
  // never chose. A running URL not in this profile's list (the link was since
  // edited, or typed by hand) goes into the custom field rather than being
  // dropped. `selectedUrl === null` is the custom row.
  const [initial] = useState(() => {
    const running = controller.active?.url;
    if (!running) return { selectedUrl: targets[0]?.url ?? null, custom: "" };
    if (targets.some((target) => target.url === running)) {
      return { selectedUrl: running, custom: "" };
    }
    return { selectedUrl: null, custom: running };
  });
  const [selectedUrl, setSelectedUrl] = useState<string | null>(initial.selectedUrl);
  const [custom, setCustom] = useState(initial.custom);
  const [showPlatforms, setShowPlatforms] = useState(false);

  // 1 day is the literal ask and the default wherever the plan reaches it.
  const [presetMs, setPresetMs] = useState<number | null>(
    () => (presets.find((p) => p.ms === DAY_MS) ?? presets[presets.length - 1]).ms,
  );
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + (presetMs ?? DAY_MS)));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Pick a time: date first, then time (mobile's two pickers), device-local.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickDate, setPickDate] = useState("");
  const [pickTime, setPickTime] = useState("");

  const [urlError, setUrlError] = useState<string | null>(null);
  const ids = useId();
  const customHelpId = `${ids}-custom-help`;
  const customErrorId = `${ids}-custom-error`;
  const platformsId = `${ids}-platforms`;

  const selectedTarget =
    selectedUrl === null ? null : (targets.find((target) => target.url === selectedUrl) ?? null);
  const customSelected = selectedTarget == null;
  const timeValid = isTempRedirectEndValid(endsAt, maxDays, new Date(now));
  const hasDestination = !customSelected || custom.trim().length > 0;
  const active = controller.active;

  const latest = tempRedirectLatestEnd(maxDays, new Date(now));
  const earliest = new Date(now + TEMP_REDIRECT_MIN_LEAD_MS + 60_000);
  const minDate = toDateInput(earliest);
  const maxDate = toDateInput(latest);

  function applyPick(date: string, time: string) {
    setPickDate(date);
    setPickTime(time);
    setNow(Date.now());
    if (!date || !time) return;
    const picked = new Date(`${date}T${time}`);
    if (Number.isNaN(picked.getTime())) return;
    setPresetMs(null);
    setEndsAt(picked);
    controller.clearActionError();
  }

  async function confirm() {
    let target: TempRedirectTarget;
    if (selectedTarget) {
      target = selectedTarget;
    } else {
      // Two steps so the message names the broken rule: malformed / ours /
      // this profile → badUrl; well-formed but not a known platform → badDomain.
      const resolved = resolveCustomTempRedirectTarget(custom, profileHost);
      if (!resolved.ok) {
        setUrlError(t(resolved.error));
        return;
      }
      target = resolved.target;
    }
    if (!isTempRedirectEndValid(endsAt, maxDays, new Date())) return;
    const outcome = await controller.start({
      url: target.url,
      label: target.label,
      source: target.source,
      endsAt,
    });
    if (outcome.ok) onClose();
    // A 403 must reach the upgrade dialog even when the client believed the
    // user was entitled — plan codes and the store can disagree.
    else if (outcome.error?.isPlanError) onUpgrade();
  }

  async function stop() {
    if ((await controller.stop()).ok) onClose();
  }

  const shownError = controller.actionError
    ? tempRedirectErrorMessage(controller.actionError, t, tc("genericError"))
    : null;
  const confirmLabel = active ? t("change") : t("start");

  return (
    <BottomSheet
      title={t("title")}
      onClose={onClose}
      footer={
        <div className="px-5 pb-4 pt-2.5">
          <Button
            variant="gradient"
            className="h-12 w-full rounded-2xl text-base font-semibold"
            disabled={controller.busy || !timeValid || !hasDestination}
            aria-label={confirmLabel}
            aria-busy={controller.busy}
            onClick={() => void confirm()}
          >
            {controller.busy ? <Loader2 className="size-5 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col">
        {/* "profile link", never "QR codes": the dynamic QR short link does
            not follow this redirect. */}
        <p className="-mt-2 mb-2 text-xs text-foreground/55">{t("subtitle")}</p>

        <div className="mt-2 rounded-2xl border border-border bg-card px-3.5 py-3">
          <p className="text-sm font-bold text-foreground">{t("howTitle")}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <HowLine Icon={ArrowRight} text={t("howLine1")} />
            <HowLine Icon={IdCard} text={t("howLine2")} />
            <HowLine Icon={History} text={t("howLine3")} />
          </div>
          <p className="mt-1.5 text-xs text-foreground/55">{t("howNote")}</p>
        </div>

        {active && (
          <div className="mt-2 flex items-center gap-2 rounded-[14px] bg-primary/[0.07] py-2.5 pe-2 ps-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">
                {t("activeGoingTo", { label: tempRedirectDisplayLabel(active) })}
              </p>
              {active.endsAt && (
                <p className="text-xs text-foreground/55">
                  {t("activeUntil", { when: formatMoment(active.endsAt, locale) })}
                </p>
              )}
            </div>
            {controller.busy ? (
              <Loader2 className="mx-3 size-4 animate-spin text-foreground/50" />
            ) : (
              <button
                type="button"
                onClick={() => void stop()}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-error hover:bg-error/10"
              >
                {t("stop")}
              </button>
            )}
          </div>
        )}

        <SectionLabel>{t("yourLinks")}</SectionLabel>
        {targets.length === 0 && <p className="mb-2 text-xs text-foreground/55">{t("noLinks")}</p>}
        <div
          role="radiogroup"
          aria-label={t("yourLinks")}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          {targets.map((target) => (
            <ChoiceRow
              key={target.url}
              selected={selectedTarget?.url === target.url}
              title={target.label}
              subtitle={target.url}
              onSelect={() => {
                setSelectedUrl(target.url);
                setUrlError(null);
                controller.clearActionError();
              }}
            />
          ))}
          <ChoiceRow
            selected={customSelected}
            title={t("custom")}
            onSelect={() => {
              setSelectedUrl(null);
              controller.clearActionError();
            }}
          />
        </div>

        {customSelected && (
          <div className="mt-2.5">
            {/* LTR as a whole — the URL, its padding and the help button — so
                an RTL layout cannot put the typed text under the button. */}
            <div className="relative" dir="ltr">
              <input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={TEMP_REDIRECT_MAX_URL_LENGTH}
                value={custom}
                placeholder={t("customHint")}
                aria-label={t("customHint")}
                aria-invalid={urlError != null}
                aria-describedby={urlError ? `${customHelpId} ${customErrorId}` : customHelpId}
                onChange={(e) => {
                  setCustom(e.target.value);
                  setUrlError(null);
                  controller.clearActionError();
                }}
                className="h-11 w-full rounded-xl border border-border bg-card pl-3.5 pr-11 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:border-primary rtl:placeholder:text-right"
              />
              <button
                type="button"
                onClick={() => setShowPlatforms((v) => !v)}
                aria-label={t("allowedDomainsTitle")}
                aria-expanded={showPlatforms}
                aria-controls={platformsId}
                title={t("allowedDomainsTitle")}
                className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-lg text-foreground/40 hover:bg-muted"
              >
                <CircleHelp className="size-4" />
              </button>
            </div>
            <p id={customHelpId} className="mt-1.5 px-1 text-xs text-foreground/55">
              {t("customHintDomains")}
            </p>
            {showPlatforms && <PlatformList id={platformsId} title={t("allowedDomainsTitle")} />}
          </div>
        )}
        {urlError && <InlineError id={customErrorId} message={urlError} />}

        <SectionLabel className="mt-4">{t("until")}</SectionLabel>
        <div role="group" aria-label={t("until")} className="flex rounded-xl bg-foreground/[0.05] p-1">
          {presets.map((preset) => (
            <button
              key={preset.ms}
              type="button"
              aria-pressed={presetMs === preset.ms}
              onClick={() => {
                setNow(Date.now());
                setPresetMs(preset.ms);
                setEndsAt(new Date(Date.now() + preset.ms));
                setPickerOpen(false);
                controller.clearActionError();
              }}
              className={cn(
                "min-w-0 flex-1 truncate rounded-[10px] py-2 text-[13px] font-semibold transition-colors",
                presetMs === preset.ms
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-foreground/45 hover:text-foreground/70",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="mt-2.5 overflow-hidden rounded-2xl border border-border bg-card">
          <button
            type="button"
            aria-expanded={pickerOpen}
            onClick={() => {
              if (!pickerOpen) {
                setPickDate(toDateInput(endsAt));
                setPickTime(toTimeInput(endsAt));
              }
              setPickerOpen((v) => !v);
            }}
            className="flex w-full items-center gap-2 px-3.5 py-3 text-start hover:bg-muted"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-semibold",
                timeValid ? "text-foreground" : "text-error",
              )}
            >
              {t("endsAt", { when: formatMoment(endsAt, locale) })}
            </span>
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-foreground/25 transition-transform",
                pickerOpen ? "rotate-90" : "rtl:rotate-180",
              )}
            />
          </button>
          {pickerOpen && (
            // Date, then time — device-local wall time, capped at the plan
            // ceiling and ≥ 60 s ahead. The wire is UTC.
            <div className="grid grid-cols-2 gap-2 border-t border-border px-3.5 py-3">
              <input
                type="date"
                aria-label={t("presetPick")}
                min={minDate}
                max={maxDate}
                value={pickDate}
                onChange={(e) => applyPick(e.target.value, pickTime)}
                className="h-10 min-w-0 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <input
                type="time"
                aria-label={t("until")}
                min={pickDate === minDate ? toTimeInput(earliest) : undefined}
                max={pickDate === maxDate ? toTimeInput(latest) : undefined}
                value={pickTime}
                onChange={(e) => applyPick(pickDate, e.target.value)}
                className="h-10 min-w-0 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
        {shownError && <InlineError message={shownError} />}
      </div>
    </BottomSheet>
  );
}

function HowLine({
  Icon,
  text,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3 shrink-0 text-primary" />
      <p className="text-xs leading-snug text-foreground/75">{text}</p>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mb-2 mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-foreground/50",
        className,
      )}
    >
      {children}
    </p>
  );
}

function ChoiceRow({
  selected,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 border-b border-border px-3.5 py-3 text-start last:border-b-0 hover:bg-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-foreground/55 rtl:text-right" dir="ltr">
            {subtitle}
          </span>
        )}
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-foreground/25",
        )}
      >
        {selected && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

/** Every platform the custom field accepts, by name — read from the same
 *  declaration the matcher flattens, so the two can never drift. */
function PlatformList({ id, title }: { id: string; title: string }) {
  const names = TEMP_REDIRECT_PLATFORMS.map((p) => p.name).sort((a, b) => a.localeCompare(b));
  return (
    <div id={id} className="mt-2 rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-sm font-bold text-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {names.map((name) => (
          <span
            key={name}
            dir="ltr"
            className="rounded-lg bg-muted px-2 py-1 text-xs text-foreground/75"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function InlineError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-2 px-1 text-xs text-error">
      <CircleAlert className="mt-0.5 size-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
