"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  deleteCustomLink,
  listCustomLinks,
  platformShortHost,
  refreshMetadata,
  type CustomLink,
} from "@/lib/api/custom-links";
import { detectPlatform } from "@/lib/links/deep-links";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/** Public share URL for a link row — ALWAYS the server's `short_url`
 * (`https://{platform}.qshot.it/{slug}` since the qshot.it migration; never
 * compose it). The subdomain build is a last-resort for a malformed row only. */
function shareUrl(link: CustomLink): string {
  return (
    link.short_url || `https://${platformShortHost(link.platform)}/${link.link}`
  );
}

export function LinksList({
  onEdit,
  onCreate,
}: {
  onEdit: (link: CustomLink) => void;
  onCreate: () => void;
}) {
  const t = useTranslations("smartLinks");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["custom-links"],
    queryFn: listCustomLinks,
  });

  const items = data ?? [];
  const empty = !isLoading && (isError || items.length === 0);

  return (
    <div>
      {/* Create lives in the page header now; the empty state keeps its own CTA. */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-border bg-muted"
            />
          ))}
        </div>
      )}

      {empty && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Link2 className="size-12 text-muted-foreground/50" />
          <p className="mt-4 font-semibold text-foreground">{t("empty")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("emptyDesc")}
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="brand-gradient mt-5 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" />
            {t("create")}
          </button>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((link) => (
            <LinkCard key={link.id} link={link} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkCard({
  link,
  onEdit,
}: {
  link: CustomLink;
  onEdit: (link: CustomLink) => void;
}) {
  const t = useTranslations("smartLinks");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = shareUrl(link);
  const cover = link.payload?.image;
  const title = link.name || link.payload?.title || link.link;

  const del = useMutation({
    mutationFn: () => deleteCustomLink(link.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-links"] });
      setConfirmDelete(false);
    },
  });

  // Re-pull cover art/title from the source (POST /custom-links/:id/refresh-metadata).
  // Pass explicit hints (browser Fallback URL + detected platform) rather than
  // letting Suwut fall back to the stored semantic `payload.type` ("video"…),
  // which often fails to re-resolve and blanks the cover.
  const refresh = useMutation({
    mutationFn: () => {
      const sourceUrl =
        (typeof link.source_url === "string" && link.source_url) ||
        link.Fallback ||
        "";
      const detected = detectPlatform(sourceUrl);
      return refreshMetadata(
        link.id,
        sourceUrl
          ? { source_url: sourceUrl, ...(detected ? { type: detected } : {}) }
          : undefined,
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["custom-links"] }),
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* Cover */}
      {/* Absolutely positioned image: the intrinsic size of a tall cover must
          never stretch the aspect box, or card heights diverge across the grid. */}
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-muted">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={title}
            className="absolute inset-0 size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="brand-gradient flex size-14 items-center justify-center rounded-2xl text-white">
            <Link2 className="size-6" />
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-1 font-semibold text-foreground">{title}</p>

        {/* Share URL row: copy + open */}
        <div className="mt-1 flex items-center gap-1">
          <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">
            {url}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label={t("copy")}
            title={copied ? t("copied") : t("copy")}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted",
              copied ? "text-primary" : "text-muted-foreground hover:text-primary",
            )}
          >
            <Copy className="size-4" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("open")}
            title={t("open")}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>

        {/* Footer: clicks + edit/delete */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MousePointerClick className="size-3.5 shrink-0" />
            {t("clicks", { count: link.total_clicks ?? 0 })}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              aria-label={t("refreshCover")}
              title={t("refreshCover")}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-60"
            >
              {refresh.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onEdit(link)}
              aria-label={t("edit")}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label={tc("delete")}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-error/10 hover:text-error"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={t("delete")}
        message={t("deleteConfirm")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => del.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
