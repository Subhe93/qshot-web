"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABEL_MAX_LENGTH, type PlatformCode, type PlatformEntry } from "@/lib/platform-redirect/model";
import type { PlatformRedirectError } from "@/lib/platform-redirect/errors";
import type { WriteOutcome } from "@/lib/platform-redirect/queries";
import { InlineError } from "./bits";
import { platformRedirectErrorMessage } from "./copy";

/** Rename a card (§7.5): up to 60 characters; an empty name sends `null`. */
export function RenameSheet({
  entry,
  code,
  busy,
  onRename,
  onClose,
}: {
  entry: PlatformEntry;
  code: PlatformCode;
  busy: boolean;
  onRename: (label: string | null) => Promise<WriteOutcome<unknown>>;
  onClose: () => void;
}) {
  const t = useTranslations("platformLinks");
  const tc = useTranslations("common");
  const ids = useId();
  const [label, setLabel] = useState(code.label ?? "");
  const [error, setError] = useState<PlatformRedirectError | null>(null);
  const trimmed = label.trim();
  const unchanged = (trimmed || null) === (code.label ?? null);

  async function save(next: string | null) {
    setError(null);
    const outcome = await onRename(next);
    if (outcome.ok) onClose();
    else setError(outcome.error);
  }

  return (
    <BottomSheet
      title={t("renameTitle")}
      subtitle={t("renameSubtitle", { code: code.code })}
      onClose={onClose}
      footer={
        <div className="flex gap-2 px-5 pb-4 pt-2.5">
          {code.label && (
            <Button
              variant="outline"
              className="h-12 rounded-2xl px-4 font-semibold text-error hover:bg-error/5"
              disabled={busy}
              onClick={() => void save(null)}
            >
              {t("clearName")}
            </Button>
          )}
          <Button
            variant="gradient"
            className="h-12 flex-1 rounded-2xl text-base font-semibold"
            disabled={busy || unchanged || trimmed.length > PLATFORM_LABEL_MAX_LENGTH}
            aria-busy={busy}
            onClick={() => void save(trimmed || null)}
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : tc("save")}
          </Button>
        </div>
      }
    >
      <div className="relative">
        <input
          autoFocus
          type="text"
          value={label}
          maxLength={PLATFORM_LABEL_MAX_LENGTH}
          placeholder={t("namePlaceholder")}
          aria-label={t("nameLabel")}
          aria-describedby={error ? `${ids}-error` : undefined}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !unchanged) void save(trimmed || null);
          }}
          className="h-12 w-full rounded-xl border border-input bg-card px-3.5 pe-14 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/35 focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-foreground/40" aria-hidden>
          {label.length}/{PLATFORM_LABEL_MAX_LENGTH}
        </span>
      </div>
      <p className="mt-1.5 px-0.5 text-xs text-foreground/55">{t("nameHint")}</p>
      {error && (
        <InlineError
          id={`${ids}-error`}
          className="mt-3"
          message={platformRedirectErrorMessage(error, t, entry.label, tc("genericError"))}
        />
      )}
    </BottomSheet>
  );
}
