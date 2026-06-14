"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { uploadQrPdf, type QrAttribute } from "@/lib/api/qrcodes";
import { InstructionsDialog } from "./instructions-dialog";
import { PhoneField } from "./phone-field";
import { QrFormField } from "./qr-form-field";

/** Light gradient tint used by the mobile field icon boxes. */
const GRADIENT_TINT =
  "linear-gradient(135deg, rgba(195,137,255,0.1), rgba(68,136,255,0.1))";

const FIELD_LABEL = "mb-1.5 block text-xs font-normal text-muted-foreground";

/**
 * The `?` instruction box shown inside string fields — a gradient-tinted square
 * with the gradient question icon, matching the mobile FancyTextField suffix.
 */
function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Help"
      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundImage: GRADIENT_TINT }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ic-gradient-question.svg" alt="" className="size-5" aria-hidden />
    </button>
  );
}

/** Renders a single QR data field driven by its config attribute (mirrors mobile QrFormBuilder). */
export function AttributeField({
  attr,
  value,
  error,
  requiredText,
  onChange,
}: {
  attr: QrAttribute;
  value: unknown;
  error?: boolean;
  requiredText: string;
  onChange: (v: unknown) => void;
}) {
  const c = attr.customization ?? {};
  const [showHelp, setShowHelp] = useState(false);
  const hasHelp = Boolean(attr.instructions);

  const errorNode = error ? (
    <p className="mt-1 text-xs text-error">{requiredText}</p>
  ) : null;

  const help =
    hasHelp && showHelp ? (
      <InstructionsDialog
        instructions={attr.instructions!}
        title={attr.label}
        onClose={() => setShowHelp(false)}
      />
    ) : null;

  // ---- bool → switch ------------------------------------------------------
  if (attr.type === "bool") {
    const on = Boolean(value);
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm">{attr.label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            on ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
              on ? "start-[22px]" : "start-0.5"
            }`}
          />
        </button>
      </div>
    );
  }

  // ---- selection → pill toggle group -------------------------------------
  if (attr.type === "selection") {
    return (
      <div>
        <span className={FIELD_LABEL}>{attr.label}</span>
        <div className="flex flex-wrap gap-2">
          {(c.values ?? []).map((v) => {
            const active = String(value ?? "") === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(v)}
                className={`h-8 rounded-lg px-4 text-sm font-medium transition-colors ${
                  active
                    ? "brand-gradient text-white"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
        {errorNode}
      </div>
    );
  }

  // ---- phone → country picker (no help icon, like the mobile phone field) -
  if (attr.type === "phone") {
    return (
      <div>
        <span className={FIELD_LABEL}>{attr.label}</span>
        <PhoneField
          value={String(value ?? "")}
          placeholder={c.hint ?? ""}
          onChange={onChange}
        />
        {errorNode}
      </div>
    );
  }

  // ---- file → PDF upload (the mobile FormFile) ---------------------------
  if (attr.type === "file") {
    return (
      <div>
        <span className={FIELD_LABEL}>{attr.label}</span>
        <FileField
          value={typeof value === "string" ? value : ""}
          accept={c.accepted_file_types ?? undefined}
          error={error}
          onChange={onChange}
        />
        {errorNode}
        {help}
      </div>
    );
  }

  // ---- form → question builder (the mobile FormBuilder) ------------------
  if (attr.type === "form") {
    return (
      <div>
        <span className={FIELD_LABEL}>{attr.label}</span>
        <QrFormField value={value} onChange={onChange} />
        {errorNode}
        {help}
      </div>
    );
  }

  // ---- multiline text (multi-line string) --------------------------------
  const multiline = (c.max_line ?? 1) > 1;
  if (multiline) {
    return (
      <div>
        <span className={FIELD_LABEL}>{attr.label}</span>
        <div className="relative">
          <Textarea
            value={String(value ?? "")}
            placeholder={c.hint ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={hasHelp ? "pe-12" : undefined}
          />
          {hasHelp && (
            <div className="absolute end-1.5 top-1.5">
              <HelpButton onClick={() => setShowHelp(true)} />
            </div>
          )}
        </div>
        {errorNode}
        {help}
      </div>
    );
  }

  // ---- single-line text (string / file) — mobile FancyTextField style -----
  return (
    <div>
      <span className={FIELD_LABEL}>{attr.label}</span>
      <div
        className={`flex h-11 items-center rounded-[10px] border bg-white ps-3 ${
          hasHelp ? "pe-1.5" : "pe-3"
        } ${error ? "border-error" : "border-input"}`}
      >
        <input
          type="text"
          value={String(value ?? "")}
          placeholder={c.hint ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-[#bbbdc3]"
        />
        {hasHelp && <HelpButton onClick={() => setShowHelp(true)} />}
      </div>
      {errorNode}
      {help}
    </div>
  );
}

/** PDF picker that uploads on select and stores the returned fileName. */
function FileField({
  value,
  accept,
  error,
  onChange,
}: {
  value: string;
  accept?: string[] | null;
  error?: boolean;
  onChange: (v: unknown) => void;
}) {
  const t = useTranslations("qr");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // accepted_file_types may be [".pdf"] or ["pdf"]; normalize for the input.
  const acceptAttr =
    (accept ?? [".pdf"])
      .map((e) => (e.startsWith(".") ? e : `.${e}`))
      .join(",") || ".pdf";

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFailed(false);
    setBusy(true);
    try {
      const fileName = await uploadQrPdf(file);
      if (fileName) onChange(fileName);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const name = value ? value.split("/").pop() : "";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={onPick}
      />
      {value ? (
        <div
          className={`flex h-11 items-center gap-2 rounded-[10px] border bg-white px-3 ${
            error ? "border-error" : "border-input"
          }`}
        >
          <FileText className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 text-xs font-medium text-primary"
          >
            <Upload className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove"
            className="shrink-0 text-muted-foreground hover:text-error"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed text-sm font-medium transition-colors ${
            error ? "border-error text-error" : "border-primary/40 text-primary hover:bg-primary/5"
          }`}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Upload className="size-4" /> {t("uploadPdf")}
            </>
          )}
        </button>
      )}
      {failed && <p className="mt-1 text-xs text-error">{t("uploadFailed")}</p>}
    </div>
  );
}
