"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

type ConfirmType = "danger" | "warning" | "info";

const TYPE = {
  danger: { color: "var(--error)", Icon: AlertCircle },
  warning: { color: "var(--warning)", Icon: AlertTriangle },
  info: { color: "var(--success)", Icon: Info },
} as const;

/**
 * Modal confirmation dialog mirroring the mobile ConfirmationDialog: a brand
 * gradient header with a type-colored icon + title, a centered message, and
 * outline-cancel / gradient-confirm buttons. `danger` keeps backward compat.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText,
  cancelText,
  danger,
  type,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger?: boolean;
  type?: ConfirmType;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const { color, Icon } = TYPE[type ?? (danger ? "danger" : "warning")];

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-6"
      onMouseDown={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-popover-in w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="brand-gradient flex flex-col items-center px-5 pb-5 pt-6 text-center">
          <span
            className="flex size-12 items-center justify-center rounded-2xl"
            style={{ background: `color-mix(in srgb, ${color} 25%, transparent)` }}
          >
            <Icon className="size-7" style={{ color }} />
          </span>
          <h2 className="mt-2.5 text-lg font-bold -tracking-[0.01em] text-white">
            {title}
          </h2>
        </div>

        {/* Message */}
        <p className="px-5 pt-5 text-center text-sm font-medium text-muted-foreground">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 p-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-foreground/30 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="brand-gradient flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(68,136,255,0.35)] hover:opacity-90"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
