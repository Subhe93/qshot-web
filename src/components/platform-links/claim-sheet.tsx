"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ClipboardPaste, Loader2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  isValidPlatformCode,
  parseCardInput,
  PLATFORM_CODE_LENGTH,
  PLATFORM_LABEL_MAX_LENGTH,
  type CardUrlPlatform,
  type ClaimResult,
  type PlatformEntry,
} from "@/lib/platform-redirect/model";
import { PLATFORM_REDIRECT_ERROR_CODES, type PlatformRedirectError } from "@/lib/platform-redirect/errors";
import type { WriteOutcome } from "@/lib/platform-redirect/queries";
import { CodeInput } from "./code-input";
import { InlineError, PlatformIcon, SectionLabel } from "./bits";
import { formatCountdown, platformRedirectErrorMessage } from "./copy";

/**
 * "Link a card" (integration guide §7.4): five digit boxes, an optional
 * private name, the full error table including the TOO_MANY_ATTEMPTS
 * countdown, and on success the `linkConfigured` nudge of §7.4.
 */
export function ClaimSheet({
  entry,
  knownPlatforms,
  cardDomains,
  initialCode,
  busy,
  onClaim,
  onClose,
  onAddLink,
  onPlanRefused,
}: {
  entry: PlatformEntry;
  /** Every platform whose card URL we can recognise (§7.4 step 3). */
  knownPlatforms: CardUrlPlatform[];
  /** Main domains a pasted card URL may be on (§7.4 step 1). */
  cardDomains: string[];
  initialCode?: string | null;
  busy: boolean;
  onClaim: (code: string, label: string | null) => Promise<WriteOutcome<ClaimResult | null>>;
  onClose: () => void;
  /** The "add your link" nudge: close this sheet and open the link sheet. */
  onAddLink: () => void;
  onPlanRefused: () => void;
}) {
  const t = useTranslations("platformLinks");
  const tc = useTranslations("common");
  const ids = useId();
  const [code, setCode] = useState(() => (initialCode && /^\d{1,5}$/.test(initialCode) ? initialCode : ""));
  const [label, setLabel] = useState("");
  const [error, setError] = useState<PlatformRedirectError | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const labelRef = useRef<HTMLInputElement>(null);

  // Countdown clock: ticks every second only while a retry window is open;
  // `remaining` is derived, so the window closes by itself at zero.
  const remaining = retryAt == null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (retryAt == null || remaining === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [retryAt, remaining]);

  const complete = code.length === PLATFORM_CODE_LENGTH;
  const canSubmit = complete && !busy && remaining === 0;

  function resetErrors() {
    setError(null);
    setLocalError(null);
    setPasteNote(null);
  }

  function handlePasted(text: string) {
    resetErrors();
    const parsed = parseCardInput(text, { siteDomains: cardDomains, platforms: knownPlatforms, expected: entry });
    switch (parsed.kind) {
      case "digits":
      case "card":
        setCode(parsed.code);
        labelRef.current?.focus();
        return;
      case "other-platform":
        setLocalError(t("pasteOtherPlatform", { platform: parsed.platform.label }));
        return;
      case "unknown-path":
        setLocalError(t("pasteUnknownPath"));
        return;
      case "foreign-host":
        setLocalError(t("pasteForeignHost"));
        return;
      default:
        setLocalError(t("errInvalidCode"));
    }
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) throw new Error("unsupported");
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setPasteNote(t("pasteFailed"));
        return;
      }
      handlePasted(text);
    } catch {
      setPasteNote(t("pasteFailed"));
    }
  }

  async function submit() {
    if (!canSubmit) return;
    if (!isValidPlatformCode(code)) {
      setLocalError(t("errInvalidCode"));
      return;
    }
    const name = label.trim();
    if (name.length > PLATFORM_LABEL_MAX_LENGTH) {
      setLocalError(t("errInvalidLabel", { maxLength: PLATFORM_LABEL_MAX_LENGTH }));
      return;
    }
    resetErrors();
    const outcome = await onClaim(code, name || null);
    if (outcome.ok) {
      // A 200 whose body could not be read: the card IS linked and the list is
      // re-reading — show a neutral success without the row details.
      setResult(
        outcome.value ?? {
          code: { platform: entry.platform, code, url: "", label: name || null, status: "assigned", assignedAt: null, hits: 0, lastHitAt: null },
          linkConfigured: entry.link != null,
        },
      );
      return;
    }
    const err = outcome.error;
    if (err.isPlanError) {
      onClose();
      onPlanRefused();
      return;
    }
    if (err.code === PLATFORM_REDIRECT_ERROR_CODES.tooManyAttempts || err.isThrottled) {
      const seconds = err.extra.retryAfterSeconds ?? 60;
      setRetryAt(Date.now() + seconds * 1000);
      setNow(Date.now());
    }
    setError(err);
  }

  const errorId = `${ids}-error`;
  const codeHintId = `${ids}-code-hint`;
  const shownError = localError ?? (error ? platformRedirectErrorMessage(error, t, entry.label, tc("genericError")) : null);

  if (result) {
    const linked = result.code;
    return (
      <BottomSheet title={t("claimTitle")} subtitle={entry.label} onClose={onClose}>
        <div className="animate-fade-in flex flex-col items-center px-2 pb-2 pt-4 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-9" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-bold text-foreground">{t("claimed", { code: linked.code })}</p>
          {linked.label && <p className="mt-0.5 text-sm text-foreground/60">{linked.label}</p>}
          {linked.url && (
            <p dir="ltr" className="mt-3 max-w-full truncate rounded-lg bg-muted px-3 py-1.5 font-mono text-xs text-foreground/70">
              {linked.url}
            </p>
          )}

          {result.linkConfigured ? (
            <p className="mt-4 text-sm text-foreground/70">{t("claimedDesc", { label: entry.label })}</p>
          ) : (
            <div className="mt-4 w-full rounded-2xl border border-warning/40 bg-warning/10 p-4 text-start" role="status">
              <p className="text-sm font-semibold text-foreground">{t("claimedNoLink", { label: entry.label })}</p>
              <Button
                variant="gradient"
                className="mt-3 h-11 w-full rounded-xl font-semibold"
                onClick={onAddLink}
              >
                {t("addLinkNow", { label: entry.label })}
              </Button>
            </div>
          )}

          <div className="mt-5 flex w-full gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-xl font-semibold"
              onClick={() => {
                setResult(null);
                setCode("");
                setLabel("");
                resetErrors();
              }}
            >
              {t("linkAnother")}
            </Button>
            <Button variant={result.linkConfigured ? "gradient" : "outline"} className="h-11 flex-1 rounded-xl font-semibold" onClick={onClose}>
              {t("done")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title={t("claimTitle")}
      subtitle={entry.label}
      onClose={onClose}
      footer={
        <div className="px-5 pb-4 pt-2.5">
          <Button
            variant="gradient"
            className="h-12 w-full rounded-2xl text-base font-semibold"
            disabled={!canSubmit}
            aria-busy={busy}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : remaining > 0 ? (
              <span className="inline-flex items-center gap-2" aria-live="polite" aria-atomic="true">
                <Timer className="size-4" aria-hidden />
                {t("retryIn", { time: formatCountdown(remaining) })}
              </span>
            ) : (
              t("claim")
            )}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
        <PlatformIcon platform={entry.platform} label={entry.label} size="sm" />
        <p className="text-xs leading-relaxed text-foreground/70">{t("claimIntro", { label: entry.label })}</p>
      </div>

      <SectionLabel className="mt-5 text-center">{t("codeLabel")}</SectionLabel>
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          resetErrors();
        }}
        onPaste={handlePasted}
        onComplete={() => labelRef.current?.focus()}
        disabled={busy}
        invalid={shownError != null && !pasteNote}
        autoFocus={!initialCode}
        describedBy={shownError ? `${codeHintId} ${errorId}` : codeHintId}
      />
      <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-foreground/55">
        <span id={codeHintId}>{pasteNote ?? t("codeHint")}</span>
        <button
          type="button"
          onClick={() => void pasteFromClipboard()}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-primary hover:bg-primary/10"
        >
          <ClipboardPaste className="size-3.5" aria-hidden />
          {t("paste")}
        </button>
      </div>

      {shownError && (
        <InlineError id={errorId} className="mt-3" message={shownError} />
      )}
      {remaining > 0 && !shownError && (
        <p className="mt-3 text-center text-xs text-foreground/55" aria-live="polite">
          {t("retryIn", { time: formatCountdown(remaining) })}
        </p>
      )}

      <SectionLabel className="mt-5">{t("nameLabel")}</SectionLabel>
      <div className="relative">
        <input
          ref={labelRef}
          type="text"
          value={label}
          maxLength={PLATFORM_LABEL_MAX_LENGTH}
          placeholder={t("namePlaceholder")}
          aria-label={t("nameLabel")}
          onChange={(e) => {
            setLabel(e.target.value);
            resetErrors();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          className={cn(
            "h-12 w-full rounded-xl border border-input bg-card px-3.5 pe-14 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/35 focus:border-primary focus:ring-4 focus:ring-primary/10",
          )}
        />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-foreground/40" aria-hidden>
          {label.length}/{PLATFORM_LABEL_MAX_LENGTH}
        </span>
      </div>
      <p className="mt-1.5 px-0.5 text-xs text-foreground/55">{t("nameHint")}</p>
    </BottomSheet>
  );
}
