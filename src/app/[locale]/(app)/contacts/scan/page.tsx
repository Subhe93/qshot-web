"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ImagePlus,
  Info,
  Loader2,
  ScanLine,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FC,
  contactDisplayName,
  discardCardScan,
  fetchCardImage,
  getCardScanJob,
  getCardScanQuota,
  listCardScans,
  readContactsError,
  saveCardScan,
  scanCard,
  type CardScanResult,
  type Contact,
  type ContactWriteBody,
} from "@/lib/api/contacts";
import {
  GateBoundary,
  resolveGate,
  useContactsEntitlements,
} from "@/components/contacts/shared";
import { cn } from "@/lib/utils";

/**
 * Business-card scanning — web port of mobile `card_scan_layout.dart` +
 * `card_scan_review_layout.dart`, with a file picker where mobile has the
 * viewfinder (the web has no camera flow; `<input capture>` still opens the
 * camera on phones).
 *
 * Contract rules kept exactly (api-spec §7):
 *  - Credits are shown BEFORE anything uploads.
 *  - The review screen is MANDATORY — nothing is saved until the user checks
 *    the fields beside the photo; low-confidence fields carry a hint and a
 *    bilingual card's other language is one toggle away.
 *  - A failed scan costs nothing, and the copy says so.
 */
export default function CardScanPage() {
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const gate = resolveGate(ent, FC.cardScanEnabled);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/contacts"
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label={t("close")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("scanTitle")}</h1>
      </div>

      <div className="mt-5">
        <GateBoundary
          gate={gate}
          lockedTitle={t("scanLockedTitle")}
          lockedBody={t("scanLockedBody")}
          onRetry={() => void ent.refetch()}
        >
          <Scanner />
        </GateBoundary>
      </div>
    </div>
  );
}

interface ScanFailure {
  code: string;
  /** The server's own message, shown verbatim under the localized copy. */
  serverMessage: string;
  quotaConsumed?: boolean;
}

function Scanner() {
  const t = useTranslations("contacts");
  const quotaQ = useQuery({
    queryKey: ["card-scan-quota"],
    queryFn: getCardScanQuota,
  });
  const quota = quotaQ.data;
  // A card that was READ but never saved (a consumed scan!) must not be
  // lost — mobile offers resume-or-discard on entering the scanner.
  const historyQ = useQuery({
    queryKey: ["card-scan-history"],
    queryFn: () => listCardScans(10),
  });
  const unfinished = (historyQ.data ?? []).find((j) => j.status === "review");

  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const [result, setResult] = useState<CardScanResult | null>(null);
  // One request id per picked photo set, so RETRY replays the same key and
  // the server can recognise it (api-spec §8.3); a new photo gets a new id.
  const reqIdRef = useRef(crypto.randomUUID());

  const remaining = quota?.remaining;
  const outOfCredits = remaining != null && remaining <= 0;

  function pickFront(f: File | null) {
    reqIdRef.current = crypto.randomUUID();
    setFailure(null);
    setFront(f);
  }
  function pickBack(f: File | null) {
    reqIdRef.current = crypto.randomUUID();
    setFailure(null);
    setBack(f);
  }

  async function run() {
    if (!front || scanning) return;
    setScanning(true);
    setFailure(null);
    try {
      const res = await scanCard(back ? [front, back] : [front], reqIdRef.current);
      setResult(res);
      void quotaQ.refetch();
    } catch (e) {
      const err = await readContactsError(e);
      setFailure({
        code: err.code,
        serverMessage: err.message,
        quotaConsumed: err.quotaConsumed,
      });
    } finally {
      setScanning(false);
    }
  }

  if (result) {
    return (
      <ScanReview
        result={result}
        onDone={() => {
          setResult(null);
          void historyQ.refetch();
        }}
        onDiscarded={() => {
          setResult(null);
          void historyQ.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {unfinished && (
        <UnfinishedScanBanner
          jobId={unfinished._id}
          onResume={(res) => setResult(res)}
          onDiscarded={() => void historyQ.refetch()}
        />
      )}

      {/* Credits — before the camera (api-spec §10). */}
      <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground">
        {quotaQ.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : remaining == null ? null : outOfCredits ? (
          <div>
            <p className="font-bold">
              {quota?.monthlyLimit != null
                ? t("scanQuotaMonthlyTitle", { limit: quota.monthlyLimit })
                : t("scanQuotaTrialTitle", { limit: quota?.trialLimit ?? 0 })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("scanQuotaBody")}</p>
          </div>
        ) : quota?.monthlyLimit != null ? (
          t("scanCreditsMonthly", { n: remaining })
        ) : (
          t("scanCreditsTrial", { n: remaining })
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t("scanCaptureHint")}</p>

      <div className="grid grid-cols-2 gap-3">
        <CardSlot
          label={t("scanFront")}
          file={front}
          onPick={pickFront}
          hint={t("scanTakePhoto")}
        />
        <CardSlot
          label={t("scanBack")}
          file={back}
          onPick={pickBack}
          hint={t("scanAddBack")}
          removable
        />
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {t("scanAddBackHint")}
      </p>

      {failure && (
        <ScanFailureCard
          failure={failure}
          onChooseAnother={() => {
            pickFront(null);
            setBack(null);
          }}
          onTryAgain={() => void run()}
        />
      )}

      <Button
        variant="gradient"
        className="w-full"
        disabled={!front || scanning || outOfCredits}
        onClick={run}
      >
        {scanning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("scanReading")}
          </>
        ) : (
          <>
            <ScanLine className="size-4" />
            {t("scanReadCard")}
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Mobile's unfinished-scan prompt: a card was read (the scan WAS charged) but
 * never saved. Pick up where you left off, or discard it and start fresh.
 */
function UnfinishedScanBanner({
  jobId,
  onResume,
  onDiscarded,
}: {
  jobId: string;
  onResume: (res: CardScanResult) => void;
  onDiscarded: () => void;
}) {
  const t = useTranslations("contacts");
  const [busy, setBusy] = useState(false);

  async function resume() {
    setBusy(true);
    try {
      const res = await getCardScanJob(jobId);
      if (res.job?.status === "review") onResume(res);
      else onDiscarded();
    } catch {
      onDiscarded();
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await discardCardScan(jobId);
    } finally {
      setBusy(false);
      onDiscarded();
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-bold text-amber-900">{t("scanUnfinishedTitle")}</p>
      <p className="mt-0.5 text-xs text-amber-800">{t("scanUnfinishedBody")}</p>
      <div className="mt-2.5 flex gap-2">
        <Button variant="gradient" size="sm" disabled={busy} onClick={resume}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : t("scanResume")}
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={discard}>
          {t("scanStartFresh")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Mobile `card_scan_failure_card.dart` (spec §13.4): what to do first, then
 * the reassurance that a failed scan cost nothing. The localized copy leads;
 * the SERVER's own message is shown verbatim under it (when it adds detail),
 * so backend wording is never hidden. A deployment problem
 * (`scan_not_configured`) never blames the user.
 */
function ScanFailureCard({
  failure,
  onChooseAnother,
  onTryAgain,
}: {
  failure: ScanFailure;
  onChooseAnother: () => void;
  onTryAgain: () => void;
}) {
  const t = useTranslations("contacts");
  const KEY: Record<string, string> = {
    no_card_detected: "scanFailNoCard",
    blurry_image: "scanFailBlurry",
    provider_error: "scanFailProvider",
    unsupported_file: "scanFailUnsupported",
    scan_not_configured: "scanFailNotConfigured",
    QUOTA_EXCEEDED: "scanQuotaBody",
    LIMIT_REACHED: "scanLimitReachedNoNumbers",
  };
  const known = KEY[failure.code];
  const message = failure.serverMessage || (known ? t(known) : t("genericError"));

  // (label, action) pairs, primary first — the mobile table. On the web
  // "retake" and "choose another" are both the picker, so they collapse.
  const actions: { label: string; run: () => void; primary?: boolean }[] =
    failure.code === "no_card_detected" ||
    failure.code === "blurry_image" ||
    failure.code === "unsupported_file"
      ? [{ label: t("scanChooseAnother"), run: onChooseAnother, primary: true }]
      : failure.code === "scan_not_configured"
        ? []
        : [{ label: t("retry"), run: onTryAgain, primary: true }];

  return (
    <div className="rounded-[14px] border border-border bg-card px-5 py-5 text-center shadow-sm">
      <Info className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 text-sm text-foreground">{message}</p>
      {/* The backend's own wording, verbatim — kept visible even when a
          localized line leads, so nothing the server says is swallowed. */}
      {known && failure.serverMessage && failure.serverMessage !== message && (
        <p className="mt-1.5 text-xs text-muted-foreground" dir="auto">
          {failure.serverMessage}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            variant={a.primary ? "gradient" : "outline"}
            className="w-full"
            onClick={a.run}
          >
            {a.label}
          </Button>
        ))}
        <Link href="/contacts/new" className="block">
          <Button variant="outline" className="w-full">
            <UserPlus className="size-4" />
            {t("addManually")}
          </Button>
        </Link>
      </div>
      {failure.quotaConsumed === false && (
        <p className="mt-3.5 text-xs text-muted-foreground">
          {t("scanNothingDeducted")}
        </p>
      )}
    </div>
  );
}

function CardSlot({
  label,
  file,
  onPick,
  hint,
  removable,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
  hint: string;
  removable?: boolean;
}) {
  const t = useTranslations("contacts");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    const handle = setTimeout(() => {
      url = file ? URL.createObjectURL(file) : null;
      setPreview(url);
    }, 0);
    return () => {
      clearTimeout(handle);
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div>
      <p className="mb-1.5 px-1 text-[13px] font-semibold text-foreground">{label}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex aspect-[8/5] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-card hover:bg-muted"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <ImagePlus className="size-6" />
            <span className="text-xs">{hint}</span>
          </span>
        )}
      </button>
      {file && removable && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="mt-1 flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-error"
        >
          <X className="size-3.5" />
          {t("scanRemoveBack")}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Review (mandatory — api-spec §7.3) ─────────────────────────────────────

const REVIEW_FIELDS = [
  ["firstName", "firstName"],
  ["lastName", "lastName"],
  ["company", "company"],
  ["jobTitle", "jobTitle"],
] as const;

function ScanReview({
  result,
  onDone,
  onDiscarded,
}: {
  result: CardScanResult;
  onDone: () => void;
  onDiscarded: () => void;
}) {
  const t = useTranslations("contacts");
  const router = useRouter();
  const queryClient = useQueryClient();
  const job = result.job;

  const [fields, setFields] = useState<ContactWriteBody>(() => ({
    ...(job.fields ?? {}),
  }));
  const [altLang, setAltLang] = useState(false);
  const [linkProfile, setLinkProfile] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Save answered 409: this person already exists. Merge/keep-both stay
  // hidden here (open backend question — mobile does the same); the offer is
  // "view the existing contact" or keep editing.
  const [savedDuplicates, setSavedDuplicates] = useState<Contact[] | null>(null);

  const alternates = job.alternates ?? [];
  const hasAlternates = alternates.length > 0;

  // Toggle to the card's other language (mobile's عربي/English switch) —
  // applied right in the click, preserving any edits to untouched fields.
  function toggleAltLang() {
    const next = !altLang;
    setAltLang(next);
    setFields((prev) => {
      const out = { ...prev };
      for (const alt of alternates) {
        if (!alt.field) continue;
        const original = (job.fields ?? {})[alt.field];
        out[alt.field] = next ? (alt.value ?? original) : original;
      }
      return out;
    });
  }

  function confidenceLow(field: string): boolean {
    const c = job.confidence?.[field];
    return c != null && c < 1;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Send only the user's view of the fields (their corrections included).
      const res = await saveCardScan(job._id, {
        fields,
        linkProfile: Boolean(result.detectedProfile?.profileId) && linkProfile,
        clientRequestId: crypto.randomUUID(),
      });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts-summary"] });
      router.push(`/contacts/${res.contact._id}`);
    } catch (e) {
      const err = await readContactsError(e);
      if (err.status === 409 && err.duplicates?.length) {
        setSavedDuplicates(err.duplicates);
      } else {
        setError(
          err.code === "LIMIT_REACHED"
            ? t("scanLimitReachedNoNumbers")
            : err.message || t("genericError"),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setConfirmDiscard(false);
    try {
      await discardCardScan(job._id);
    } finally {
      onDiscarded();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">{t("scanReviewTitle")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("scanReviewSubtitle")}
        </p>
      </div>

      {/* The photo beside the fields — check them against it (§7.3). */}
      <div className="flex gap-2 overflow-x-auto">
        {(job.images ?? []).map((img, i) => (
          <ScanImage key={i} jobId={job._id} side={img.side ?? "front"} />
        ))}
      </div>

      {hasAlternates && (
        <button
          type="button"
          onClick={toggleAltLang}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            altLang
              ? "border-transparent bg-foreground text-background"
              : "border-border text-foreground hover:bg-muted",
          )}
        >
          {t("scanLanguageHint")}
        </button>
      )}

      <div className="space-y-3">
        {REVIEW_FIELDS.map(([field, labelKey]) => (
          <div key={field}>
            <div className="mb-1 flex items-baseline justify-between px-1">
              <label className="text-[13px] font-semibold text-foreground">
                {t(labelKey)}
              </label>
              {confidenceLow(field) && (
                <span className="text-[11px] font-medium text-amber-600">
                  {t("checkThis")}
                </span>
              )}
            </div>
            <input
              value={String(fields[field] ?? "")}
              onChange={(e) => setFields((f) => ({ ...f, [field]: e.target.value }))}
              dir="auto"
              className={cn(
                "h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none",
                confidenceLow(field) ? "border-amber-400" : "border-input",
              )}
            />
          </div>
        ))}

        {/* Phones / emails read from the card (labels included). */}
        {(fields.phones ?? []).map((p, i) => (
          <div key={`p${i}`}>
            <label className="mb-1 block px-1 text-[13px] font-semibold text-foreground">
              {t("phones")} {i + 1}
            </label>
            <input
              value={p.number ?? ""}
              dir="ltr"
              onChange={(e) =>
                setFields((f) => ({
                  ...f,
                  phones: (f.phones ?? []).map((x, j) =>
                    j === i ? { ...x, number: e.target.value } : x,
                  ),
                }))
              }
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
            />
          </div>
        ))}
        {(fields.emails ?? []).map((p, i) => (
          <div key={`e${i}`}>
            <label className="mb-1 block px-1 text-[13px] font-semibold text-foreground">
              {t("emails")} {i + 1}
            </label>
            <input
              value={p.address ?? ""}
              dir="ltr"
              onChange={(e) =>
                setFields((f) => ({
                  ...f,
                  emails: (f.emails ?? []).map((x, j) =>
                    j === i ? { ...x, address: e.target.value } : x,
                  ),
                }))
              }
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
            />
          </div>
        ))}
      </div>

      {/* Qshot profile detected → offer the live link (§7.3). */}
      {result.detectedProfile?.profileId && (
        <label className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <input
            type="checkbox"
            checked={linkProfile}
            onChange={(e) => setLinkProfile(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-foreground">{t("scanProfileMatch")}</span>
        </label>
      )}

      {savedDuplicates && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-bold text-foreground">
            {t("alreadyInContactsTitle")}
          </p>
          <div className="mt-2 overflow-hidden rounded-lg border border-border">
            {savedDuplicates.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground" dir="auto">
                    {contactDisplayName(c) || t("unnamed")}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                    {c.phones?.[0]?.number ?? c.emails?.[0]?.address ?? ""}
                  </span>
                </span>
                <Link href={`/contacts/${c._id}`}>
                  <Button variant="outline" size="sm">
                    {t("viewExisting")}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSavedDuplicates(null)}
            className="mt-2.5 text-xs font-semibold text-primary"
          >
            {t("backToEditing")}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => setConfirmDiscard(true)}
        >
          <Trash2 className="size-4" />
          {t("scanDiscard")}
        </Button>
        <Button variant="gradient" className="flex-1" disabled={busy} onClick={save}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : t("saveContact")}
        </Button>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mx-auto block text-xs text-muted-foreground hover:text-foreground"
      >
        {t("backToEditing")}
      </button>

      <ConfirmDialog
        open={confirmDiscard}
        type="danger"
        title={t("scanDiscardTitle")}
        message={t("scanDiscardMessage")}
        confirmText={t("scanDiscard")}
        cancelText={t("cancel")}
        onConfirm={() => void discard()}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

/** Authenticated scan photo (no public URL, no public caching — §7.5). */
function ScanImage({ jobId, side }: { jobId: string; side: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let stale = false;
    void fetchCardImage(jobId, side)
      .then((u) => {
        if (stale) URL.revokeObjectURL(u);
        else {
          revoke = u;
          setUrl(u);
        }
      })
      .catch(() => undefined);
    return () => {
      stale = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [jobId, side]);
  if (!url) return <div className="h-32 w-52 shrink-0 animate-pulse rounded-xl bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-32 shrink-0 rounded-xl object-cover" />;
}
