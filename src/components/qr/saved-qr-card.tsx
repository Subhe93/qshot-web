"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  cdnUrl,
  deleteQrCode,
  getLaunchUrl,
  type UserQr,
} from "@/lib/api/qrcodes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { AppIcon } from "./app-icon";

export type QrView = "gallery" | "list";

const ICON = {
  download: "/qr/icons/icon_download.svg",
  open: "/qr/icons/icon_open.svg",
  copy: "/qr/icons/icon_copy.svg",
  share: "/qr/icons/icon_share.svg",
  delete: "/qr/icons/icon_delete.svg",
  edit: "/qr/icons/icon_edit.svg",
};

/** Fetches a CDN file as a blob, falling back to opening it in a new tab. */
async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

export function SavedQrCard({
  item,
  notify,
  view = "gallery",
}: {
  item: UserQr;
  notify: (msg: string) => void;
  view?: QrView;
}) {
  const t = useTranslations("qr");
  const tc = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [showDownload, setShowDownload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const launchUrl = getLaunchUrl(item);
  const ver = item.updatedAt ?? item.createdAt ?? "";
  const bust = ver ? `?v=${encodeURIComponent(ver)}` : "";
  const pngUrl = cdnUrl(item.pngImage) + bust;
  const svgUrl = cdnUrl(item.svgImage) + bust;

  const cfg = typeof item.qrCode === "object" ? item.qrCode : null;
  const dynamic = cfg?.qr_type === "dynamic";
  const typeName = cfg?.name;
  const typeIcon = cfg?.icon ? cdnUrl(cfg.icon) : null;
  const editHref = `/qr-codes/new?edit=${item._id}`;

  const del = useMutation({
    mutationFn: () => deleteQrCode(item._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
      setConfirmDelete(false);
    },
    onError: () => notify(t("actionFailed")),
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(launchUrl ?? pngUrl);
      notify(t("copied"));
    } catch {
      notify(t("actionFailed"));
    }
  }

  async function share() {
    const url = launchUrl ?? pngUrl;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: item.name, url });
      } catch {
        /* cancelled */
      }
    } else {
      copy();
    }
  }

  const createdAt = (() => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
        new Date(item.createdAt),
      );
    } catch {
      return "";
    }
  })();

  const badge = dynamic ? (
    <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
      {t("dynamic")}
    </span>
  ) : null;

  return (
    <>
      {view === "list" ? (
        // ─── List tile ───────────────────────────────────────────────
        // On mobile the actions wrap to their own row so the name/type aren't
        // squeezed by five icon buttons; on ≥sm everything sits inline.
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-white">
              {item.pngImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pngUrl} alt={item.name} className="size-14 object-contain" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {typeIcon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={typeIcon} alt="" className="size-4 shrink-0" />
                )}
                <p className="line-clamp-1 font-semibold text-foreground">
                  {item.name || "—"}
                </p>
                {badge}
              </div>
              {typeName && (
                <p className="line-clamp-1 text-xs text-muted-foreground">{typeName}</p>
              )}
              {createdAt && (
                <p className="text-xs text-muted-foreground/80">{createdAt}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-0.5 border-t border-border pt-1.5 sm:border-t-0 sm:pt-0">
            {launchUrl && (
              <IconBtn
                as="a"
                href={launchUrl}
                icon={ICON.open}
                label={t("open")}
                gradient
              />
            )}
            <IconBtn as="link" href={editHref} icon={ICON.edit} label={tc("edit")} />
            <IconBtn
              icon={ICON.download}
              label={t("downloadAction")}
              onClick={() => setShowDownload(true)}
            />
            <IconBtn icon={ICON.share} label={t("share")} onClick={share} />
            <IconBtn
              icon={ICON.delete}
              label={tc("delete")}
              onClick={() => setConfirmDelete(true)}
            />
          </div>
        </div>
      ) : (
        // ─── Gallery card ────────────────────────────────────────────
        <div className="rounded-2xl border border-border bg-muted p-2">
          <div className="flex items-center justify-center rounded-xl bg-white p-5">
            {item.pngImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pngUrl}
                alt={item.name}
                className="aspect-square w-full max-w-[200px] object-contain"
              />
            ) : (
              <div className="aspect-square w-full max-w-[200px]" />
            )}
          </div>

          <div className="mt-2 rounded-xl bg-card p-3">
            <div className="flex items-start gap-2">
              {typeIcon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={typeIcon} alt="" className="mt-0.5 size-7 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="line-clamp-1 font-semibold text-foreground">
                    {item.name || "—"}
                  </p>
                  {badge}
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {[typeName, createdAt].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Link
                href={editHref}
                className="brand-gradient inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-white hover:opacity-90"
              >
                <AppIcon src={ICON.edit} className="size-3.5" />
                {tc("edit")}
              </Link>
            </div>

            <div className="mt-3 flex items-center justify-between gap-1 border-t border-border pt-3">
              <ActionButton
                icon={ICON.download}
                label={t("downloadAction")}
                onClick={() => setShowDownload(true)}
              />
              {launchUrl && (
                <a
                  href={launchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-primary"
                >
                  <AppIcon src={ICON.open} className="size-4" />
                  {t("open")}
                </a>
              )}
              <ActionButton icon={ICON.copy} label={t("copy")} onClick={copy} />
              <ActionButton icon={ICON.share} label={t("share")} onClick={share} />
              <ActionButton
                icon={ICON.delete}
                label={tc("delete")}
                onClick={() => setConfirmDelete(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Download format chooser */}
      {showDownload && (
        <Modal onClose={() => setShowDownload(false)} title={t("imageFormat")}>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <FormatButton
              label="PNG"
              onClick={() => {
                downloadFile(pngUrl, `${item.name || "qrcode"}.png`);
                setShowDownload(false);
              }}
            />
            <FormatButton
              label="SVG"
              onClick={() => {
                downloadFile(svgUrl, `${item.name || "qrcode"}.svg`);
                setShowDownload(false);
              }}
            />
          </div>
        </Modal>
      )}

      {/* Delete confirmation — mobile-style dialog */}
      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={t("deleteTitle")}
        message={t("deleteMsg")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => del.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] hover:bg-muted",
        danger ? "text-error" : "text-muted-foreground hover:text-primary",
      )}
    >
      <AppIcon src={icon} className="size-4" />
      {label}
    </button>
  );
}

/** Compact icon-only action for the list view. */
function IconBtn({
  icon,
  label,
  onClick,
  href,
  as = "button",
  danger,
  gradient,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
  as?: "button" | "a" | "link";
  danger?: boolean;
  gradient?: boolean;
}) {
  const className = cn(
    "flex size-9 items-center justify-center rounded-lg hover:bg-muted",
    gradient
      ? "text-primary"
      : danger
        ? "text-error"
        : "text-muted-foreground hover:text-primary",
  );
  const inner = <AppIcon src={icon} className="size-[18px]" />;
  if (as === "link" && href)
    return (
      <Link href={href} aria-label={label} className={className}>
        {inner}
      </Link>
    );
  if (as === "a" && href)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={className}
      >
        {inner}
      </a>
    );
  return (
    <button type="button" aria-label={label} onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

function FormatButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:border-primary hover:bg-muted"
    >
      <span className="brand-gradient flex size-12 items-center justify-center rounded-xl text-white">
        <AppIcon src={ICON.download} className="size-5" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="shadow-soft w-full max-w-sm rounded-2xl bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
