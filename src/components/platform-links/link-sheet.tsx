"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, CircleHelp, ClipboardPaste, Loader2, MapPin, MessageSquareQuote, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  hostLooksAllowed,
  PLATFORM_URL_MAX_LENGTH,
  type PlatformEntry,
} from "@/lib/platform-redirect/model";
import type { PlatformRedirectError } from "@/lib/platform-redirect/errors";
import type { WriteOutcome } from "@/lib/platform-redirect/queries";
import { InlineError, PlatformIcon, SectionLabel } from "./bits";
import { errorShowsExamples, platformRedirectErrorMessage } from "./copy";

/**
 * "Your {label} link" — paste the destination for one platform (integration
 * guide §7.3, §7.7): `urlHint` placeholder, Paste button, tappable `examples`,
 * a soft host warning that never blocks, and for Google Reviews the
 * "How do I get my link?" help (the two methods of §7.3).
 */
export function LinkSheet({
  entry,
  busy,
  onSave,
  onClose,
  onPlanRefused,
}: {
  entry: PlatformEntry;
  busy: boolean;
  onSave: (url: string) => Promise<WriteOutcome<unknown>>;
  onClose: () => void;
  onPlanRefused: () => void;
}) {
  const t = useTranslations("platformLinks");
  const tc = useTranslations("common");
  const ids = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(entry.link?.url ?? "");
  const [error, setError] = useState<PlatformRedirectError | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  const isGoogle = entry.platform === "google_reviews";
  const trimmed = url.trim();
  const looksAllowed = trimmed ? hostLooksAllowed(trimmed, entry.allowedHosts) : null;
  const showWarning = looksAllowed === false && !error && !localError;
  const canSave = trimmed.length > 0 && !busy;

  useEffect(() => {
    if (!help) inputRef.current?.focus();
  }, [help]);

  function setValue(next: string) {
    setUrl(next);
    setError(null);
    setLocalError(null);
    setPasteNote(null);
  }

  async function paste() {
    try {
      if (!navigator.clipboard?.readText) throw new Error("unsupported");
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setValue(text);
      else setPasteNote(t("pasteFailed"));
    } catch {
      setPasteNote(t("pasteFailed"));
      inputRef.current?.focus();
    }
  }

  async function save() {
    if (!canSave) return;
    // A scheme is mandatory (§7.3 INVALID_URL "scheme"); add https:// for a
    // bare host so the user is not refused for the most common omission.
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!/^https?:\/\//i.test(candidate)) {
      setLocalError(t("errInvalidUrl"));
      return;
    }
    if (candidate.length > PLATFORM_URL_MAX_LENGTH) {
      setLocalError(t("errInvalidUrlTooLong"));
      return;
    }
    const outcome = await onSave(candidate);
    if (outcome.ok) {
      onClose();
      return;
    }
    if (outcome.error.isPlanError) {
      onClose();
      onPlanRefused();
      return;
    }
    setError(outcome.error);
  }

  const shownError = localError
    ? { message: localError, examples: undefined as string[] | undefined }
    : error
      ? {
          message: platformRedirectErrorMessage(error, t, entry.label, tc("genericError")),
          examples: errorShowsExamples(error) ? error.extra.examples : undefined,
        }
      : null;
  const errorId = `${ids}-error`;
  const hintId = `${ids}-hint`;

  if (help) {
    return (
      <BottomSheet title={t("googleHelpTitle")} onClose={onClose}>
        <button
          type="button"
          onClick={() => setHelp(false)}
          className="-mt-1 mb-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {tc("back")}
        </button>
        <HelpMethod
          Icon={MessageSquareQuote}
          title={t("googleHelpReviewTitle")}
          body={t("googleHelpReviewBody")}
          sample="https://g.page/r/…/review"
        />
        <HelpMethod
          Icon={MapPin}
          title={t("googleHelpMapsTitle")}
          body={t("googleHelpMapsBody")}
          sample="https://maps.app.goo.gl/…"
          className="mt-3"
        />
        <p className="mt-4 rounded-xl bg-muted px-3.5 py-3 text-xs leading-relaxed text-foreground/70">
          {t("googleHelpNote")}
        </p>
        <Button
          variant="gradient"
          className="mt-5 h-12 w-full rounded-2xl text-base font-semibold"
          onClick={() => setHelp(false)}
        >
          {t("googleHelpBack")}
        </Button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title={t("linkSheetTitle", { label: entry.label })}
      onClose={onClose}
      footer={
        <div className="px-5 pb-4 pt-2.5">
          <Button
            variant="gradient"
            className="h-12 w-full rounded-2xl text-base font-semibold"
            disabled={!canSave}
            aria-busy={busy}
            onClick={() => void save()}
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : t("saveLink")}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
        <PlatformIcon platform={entry.platform} label={entry.label} size="sm" />
        <p className="text-xs leading-relaxed text-foreground/70">{t("linkSheetHint", { label: entry.label })}</p>
      </div>

      <SectionLabel className="mt-4">{t("linkField")}</SectionLabel>
      {/* LTR as a whole — URL text, padding and the Paste button — so an RTL
          layout cannot put the typed text under the button. */}
      <div className="relative" dir="ltr">
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={PLATFORM_URL_MAX_LENGTH + 8}
          value={url}
          placeholder={entry.urlHint || "https://"}
          aria-label={t("linkField")}
          aria-invalid={shownError != null}
          aria-describedby={shownError ? `${hintId} ${errorId}` : hintId}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          className={cn(
            "h-12 w-full rounded-xl border bg-card pl-3.5 pr-[88px] text-sm text-foreground outline-none transition-colors placeholder:text-foreground/35 focus:border-primary focus:ring-4 focus:ring-primary/10",
            shownError ? "border-error" : "border-input",
          )}
        />
        <button
          type="button"
          onClick={() => void paste()}
          className="absolute right-1.5 top-1.5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground/[0.06] px-2.5 text-xs font-semibold text-foreground hover:bg-foreground/10"
        >
          <ClipboardPaste className="size-3.5" aria-hidden />
          {t("paste")}
        </button>
      </div>
      <p id={hintId} className="mt-1.5 px-0.5 text-xs text-foreground/55">
        {pasteNote ?? t("linkFieldHint")}
      </p>

      {showWarning && (
        <p className="animate-fade-in mt-2 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-xs font-medium text-[#8a5a00]" role="status">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t("hostWarning", { label: entry.label })}</span>
        </p>
      )}

      {shownError && (
        <InlineError
          id={errorId}
          className="mt-2"
          message={shownError.message}
          examples={shownError.examples}
          onExample={(example) => {
            setValue(example);
            inputRef.current?.focus();
          }}
        />
      )}

      {entry.examples.length > 0 && (
        <>
          <SectionLabel className="mt-4">{t("examples")}</SectionLabel>
          <p className="-mt-1 mb-2 px-0.5 text-xs text-foreground/55">{t("tapExample")}</p>
          <div className="flex flex-col gap-1.5">
            {entry.examples.map((example) => (
              <button
                key={example}
                type="button"
                dir="ltr"
                onClick={() => {
                  setValue(example);
                  inputRef.current?.focus();
                }}
                className="truncate rounded-xl border border-border bg-card px-3 py-2 text-start font-mono text-[12px] text-foreground/75 transition-colors hover:border-primary/50 hover:bg-primary/[0.04]"
              >
                {example}
              </button>
            ))}
          </div>
        </>
      )}

      {isGoogle && (
        <button
          type="button"
          onClick={() => setHelp(true)}
          className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-start text-sm font-semibold text-foreground hover:bg-muted"
        >
          <CircleHelp className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="flex-1">{t("googleHelp")}</span>
          <ChevronLeft className="size-4 rotate-180 text-foreground/30 rtl:rotate-0" aria-hidden />
        </button>
      )}
    </BottomSheet>
  );
}

function HelpMethod({
  Icon,
  title,
  body,
  sample,
  className,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  sample: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-2.5">
        <span className="brand-tint-soft flex size-9 items-center justify-center rounded-xl text-primary">
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-bold text-foreground">{title}</p>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-foreground/75">{body}</p>
      <p dir="ltr" className="mt-2 inline-block rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground/70">
        {sample}
      </p>
    </div>
  );
}
