"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Check } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { cdnUrl } from "@/lib/api/qrcodes";
import {
  FLOATING_VARIANTS,
  floatingIcon,
  secondaryField,
  hasCustomImage,
  isPhoneType,
  sanitizeValue,
  validateFloatingValue,
  floatingUrl,
} from "@/lib/builder/floating-button";
import type { FloatingButton, FloatingButtonVariant } from "@/lib/types/profile";
import { cn } from "@/lib/utils";

/**
 * Floating action button overlaid on the builder preview (bottom-end), mirroring
 * the mobile FloatingButtonWidget. Tapping it opens the type/value editor.
 */
export function FloatingButtonLayer({ preview = false }: { preview?: boolean }) {
  const t = useTranslations("builder.floatingButton");
  const settings = useEditorStore((s) => s.settings);
  const update = useEditorStore((s) => s.updateSettings);
  const [open, setOpen] = useState(false);

  const fb: FloatingButton = settings.floating_button ?? {
    type: null,
    hide: false,
    values: {},
  };
  const type = fb.type ?? null;
  const cur = type ? fb.values?.[type] ?? {} : {};
  const image = type === "customLink" ? cur.image : undefined;

  function setFb(patch: Partial<FloatingButton>) {
    update({ floating_button: { ...fb, ...patch } });
  }
  function setField(field: string, v: string) {
    if (!type) return;
    setFb({
      values: { ...fb.values, [type]: { ...(fb.values?.[type] ?? {}), [field]: v } },
    });
  }

  // Preview mode mirrors the live website: a hidden or unconfigured button is not
  // shown, and tapping it launches the destination instead of opening the editor.
  if (preview) {
    if (fb.hide || !type) return null;
    const value = (cur.value ?? "").trim();
    if (!value || validateFloatingValue(type, value)) return null;
    const href = floatingUrl(
      type,
      value,
      cur.message ?? undefined,
      cur.subject ?? undefined,
    );
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={t("title")}
        className="absolute bottom-4 end-4 z-20 flex size-[58px] items-center justify-center"
      >
        {hasCustomImage(type) && image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnUrl(image)}
            alt=""
            className="size-[50px] rounded-full object-cover shadow-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={floatingIcon(type)} alt="" className="size-[50px] drop-shadow-lg" />
        )}
      </a>
    );
  }

  return (
    <>
      {/* Button (always editable in the builder) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("title")}
        className={cn(
          "absolute bottom-4 end-4 z-20 flex size-[58px] items-center justify-center transition-opacity",
          fb.hide && "opacity-50",
        )}
      >
        {type ? (
          hasCustomImage(type) && image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cdnUrl(image)}
              alt=""
              className="size-[50px] rounded-full object-cover shadow-lg"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={floatingIcon(type)} alt="" className="size-[50px] drop-shadow-lg" />
          )
        ) : (
          <span className="flex size-[50px] items-center justify-center rounded-full border-[1.5px] border-primary/40 bg-primary/15 text-primary">
            <Plus className="size-6" />
          </span>
        )}
      </button>

      {open && (
        <BottomSheet title={t("title")} onClose={() => setOpen(false)}>
          {/* Hide toggle */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2.5">
            <span className="text-sm font-medium">{t("hide")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!fb.hide}
              onClick={() => setFb({ hide: !fb.hide })}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                fb.hide ? "bg-foreground" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                  fb.hide ? "start-[1.375rem]" : "start-0.5",
                )}
              />
            </button>
          </div>

          {/* Type grid */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("type")}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {FLOATING_VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFb({ type: v })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border-2 bg-card p-2.5 transition-colors",
                  type === v ? "border-primary" : "border-transparent hover:bg-muted",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={floatingIcon(v)} alt="" className="size-8" />
                <span className="text-[10px] font-medium text-foreground">
                  {t(`types.${v}`)}
                </span>
              </button>
            ))}
          </div>

          {/* Value fields */}
          {type && (
            <div className="mt-4 space-y-3">
              <Field label={t(`types.${type}`)}>
                <Input
                  value={cur.value ?? ""}
                  placeholder={t(`hints.${type}`)}
                  type={type === "email" ? "email" : "text"}
                  inputMode={isPhoneType(type) ? "tel" : type === "email" ? "email" : "url"}
                  maxLength={isPhoneType(type) ? 15 : undefined}
                  onChange={(e) => setField("value", sanitizeValue(type, e.target.value))}
                />
                {(() => {
                  const v = cur.value ?? "";
                  const err = v ? validateFloatingValue(type, v) : null;
                  return err ? (
                    <p className="mt-1 text-xs text-error">{t(`errors.${err}`)}</p>
                  ) : null;
                })()}
              </Field>

              {secondaryField(type) && (
                <Field label={t(secondaryField(type) === "subject" ? "subject" : "message")}>
                  <Input
                    value={cur[secondaryField(type)!] ?? ""}
                    onChange={(e) => setField(secondaryField(type)!, e.target.value)}
                  />
                </Field>
              )}

              {hasCustomImage(type) && (
                <Field label={t("imageUrl")}>
                  <Input
                    value={cur.image ?? ""}
                    placeholder="https://…"
                    onChange={(e) => setField("image", e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
