"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { HISTORY_LABEL_MAX } from "@/lib/history/summary";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * §6.9 pin / rename: one label, 1–60 characters, trimmed, required. The same
 * sheet renames (the server treats pinning a pinned row as a rename).
 */
export function PinLabelDialog({
  initialLabel,
  busy,
  onSubmit,
  onClose,
}: {
  /** The current label when renaming; empty for a new pin. */
  initialLabel: string;
  busy: boolean;
  onSubmit: (label: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("history.pin");
  const tc = useTranslations("common");
  const [label, setLabel] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const rename = initialLabel.trim() !== "";
  const trimmed = label.trim();
  const valid = trimmed.length > 0 && trimmed.length <= HISTORY_LABEL_MAX;

  useEffect(() => {
    // Focus once the sheet has mounted (its portal lands after this effect).
    const handle = setTimeout(() => inputRef.current?.select(), 0);
    return () => clearTimeout(handle);
  }, []);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!valid || busy) return;
    onSubmit(trimmed);
  }

  return (
    <BottomSheet
      title={rename ? t("renameTitle") : t("title")}
      onClose={onClose}
      footer={
        <div className="flex gap-3 border-t border-border p-4">
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form={`${inputId}-form`}
            variant="gradient"
            className="flex-1 rounded-xl"
            disabled={!valid || busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : tc("save")}
          </Button>
        </div>
      }
    >
      <form id={`${inputId}-form`} onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <label htmlFor={inputId} className="block text-xs font-semibold text-foreground">
          {t("label")}
        </label>
        <Input
          id={inputId}
          ref={inputRef}
          value={label}
          dir="auto"
          maxLength={HISTORY_LABEL_MAX}
          placeholder={t("placeholder")}
          autoComplete="off"
          onChange={(e) => setLabel(e.target.value)}
        />
        <p className="text-end text-[11px] text-muted-foreground" aria-live="polite">
          {trimmed.length}/{HISTORY_LABEL_MAX}
        </p>
      </form>
    </BottomSheet>
  );
}
