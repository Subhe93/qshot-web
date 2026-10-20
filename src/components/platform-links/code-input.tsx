"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { normalizeDigits, PLATFORM_CODE_LENGTH } from "@/lib/platform-redirect/model";

/**
 * Five separate digit boxes (integration guide §7.4: numeric keypad, length
 * exactly 5). Typing auto-advances, Backspace walks back, arrows move, and a
 * paste of five digits — or of anything longer, such as a full card URL — is
 * handed to `onPaste` so the sheet can parse it (§7.4 steps 1–4).
 *
 * Always LTR: a code is read left to right in every language.
 */
export function CodeInput({
  value,
  onChange,
  onPaste,
  onComplete,
  disabled,
  invalid,
  autoFocus,
  describedBy,
}: {
  /** Up to 5 ASCII digits. */
  value: string;
  onChange: (next: string) => void;
  /** Raw pasted text when it is not simply ≤ 5 digits. */
  onPaste: (text: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("platformLinks");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: PLATFORM_CODE_LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, PLATFORM_CODE_LENGTH - 1)]?.focus();
    // Focus only on mount — a later `value` change must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function focusAt(index: number) {
    const i = Math.max(0, Math.min(PLATFORM_CODE_LENGTH - 1, index));
    const el = refs.current[i];
    el?.focus();
    el?.select();
  }

  function setDigits(next: string) {
    const clipped = next.slice(0, PLATFORM_CODE_LENGTH);
    onChange(clipped);
    if (clipped.length === PLATFORM_CODE_LENGTH) onComplete?.();
  }

  function handleInput(index: number, raw: string) {
    let typed = normalizeDigits(raw);
    if (!typed) {
      // Non-digit keystroke: keep the box as it was.
      onChange(value);
      return;
    }
    // The box held a digit and the browser appended instead of replacing.
    if (digits[index] && typed.length === 2 && typed.startsWith(digits[index])) typed = typed.slice(1);
    // Digits are always contiguous from the left: typing into an empty box past
    // the end appends; typing into a filled box replaces it.
    const at = Math.min(index, value.length);
    const next = (value.slice(0, at) + typed + value.slice(at + 1)).slice(0, PLATFORM_CODE_LENGTH);
    // Move focus first: a completed code hands focus to the sheet (onComplete
    // inside setDigits), and that hand-off must win over our own advance.
    focusAt(at + typed.length);
    setDigits(next);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigits(value.slice(0, index) + value.slice(index + 1));
        focusAt(index);
      } else if (index > 0) {
        setDigits(value.slice(0, index - 1) + value.slice(index));
        focusAt(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
    } else if (e.key === "Enter" && value.length === PLATFORM_CODE_LENGTH) {
      onComplete?.();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    const only = normalizeDigits(text);
    const plain = text.trim().replace(/[\s-]/g, "");
    if (only.length === plain.length && only.length > 0 && only.length <= PLATFORM_CODE_LENGTH) {
      setDigits(only);
      focusAt(only.length);
      return;
    }
    onPaste(text);
  }

  return (
    <div dir="ltr" className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label={t("codeLabel")}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={PLATFORM_CODE_LENGTH}
          value={digit}
          disabled={disabled}
          aria-label={t("codeDigit", { n: index + 1 })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => handleInput(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-14 w-11 rounded-xl border-2 bg-card text-center font-mono text-2xl font-bold tabular-nums text-foreground outline-none transition-colors sm:h-16 sm:w-12",
            "focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50",
            invalid ? "border-error" : digit ? "border-foreground/30" : "border-input",
          )}
        />
      ))}
    </div>
  );
}
