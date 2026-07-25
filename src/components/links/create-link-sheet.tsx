"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LINK_PLATFORMS,
  checkSlug,
  createCustomLink,
  customLinksErrorMessage,
  platformShortHost,
  platformToType,
  previewMetadata,
  typeToPlatform,
  updateCustomLink,
  type CustomLink,
  type LinkInput,
  type LinkPlatform,
  type LinkType,
  type MetadataPreview,
} from "@/lib/api/custom-links";
import {
  buildDeepLinks,
  detectPlatform,
  normalizeUrl,
} from "@/lib/links/deep-links";

// Original, full-colour brand marks (same SVG set the social-links block uses),
// served from /brand-icons/colored. "x" shares the twitter mark; "custom"
// (hidden from the picker, legacy rows only) reuses the generic link glyph.
const BRAND_ICON_FILES: Record<string, string> = {
  youtube: "youtube.svg",
  spotify: "spotify.svg",
  tiktok: "tiktok.svg",
  vimeo: "vimeo.svg",
  instagram: "instagram.svg",
  facebook: "facebook.svg",
  twitter: "twitter.svg",
  x: "twitter.svg",
  custom: "link.svg",
};

/** Render a platform's original brand logo (falls back to a link glyph). */
function PlatformIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const file = BRAND_ICON_FILES[type] ?? "link.svg";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand-icons/colored/${file}`}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("object-contain", className)}
    />
  );
}

/** Sanitize free text into a slug: allowed chars only, spaces→dashes, single
 * dashes, no dangling separators, ≤191 — mirrors mobile's `_sanitizeSlug` so
 * the field always shows exactly what the backend will store (its `normalized`
 * form). */
function sanitizeSlug(raw: string): string {
  return raw
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 191)
    .replace(/^[-_]+|[-_]+$/g, "");
}

/** Auto-generate a slug candidate from a name (falls back to the URL host). */
function autoSlug(name: string, url: string): string {
  const fromName = sanitizeSlug(name.toLowerCase());
  if (fromName) return fromName;
  const norm = normalizeUrl(url);
  if (!norm) return "";
  try {
    const u = new URL(norm);
    const segs = u.pathname.split("/").filter(Boolean);
    const tail = segs[segs.length - 1] ?? u.hostname.replace(/^www\./, "");
    return sanitizeSlug(tail.toLowerCase());
  } catch {
    return "";
  }
}

/** Debounce any value by `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type SlugStatus = "idle" | "checking" | "available" | "taken";

/**
 * Create / edit a smart link. A BottomSheet form: pick the serving platform
 * (immutable after creation), paste a source URL (live cover preview), name it,
 * choose a custom slug (checked for availability WITHIN that platform), then
 * save — the per-platform deep links are derived locally via
 * {@link buildDeepLinks}. On success it shows the server's short_url
 * (`https://{platform}.qshot.it/{slug}`).
 */
export function CreateLinkSheet({
  editing,
  onClose,
  onSaved,
}: {
  editing?: CustomLink | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("smartLinks");
  // `builder.form.close` is a shared, already-translated "Close" label reused
  // for the success sheet's dismiss button (no dedicated key in this namespace).
  const tClose = useTranslations("builder.form");
  const queryClient = useQueryClient();

  const initialUrl = useMemo(
    () =>
      editing
        ? (typeof editing.source_url === "string" && editing.source_url) ||
          editing.Fallback ||
          ""
        : "",
    [editing],
  );
  // The serving platform (UpdatedApi.md): the row's own `platform` when
  // editing (immutable — the picker is read-only in that case); legacy rows
  // without one derive it from the source URL. A NEW link opens with
  // "youtube" auto-selected (product decision).
  const initialPlatform = useMemo<LinkPlatform>(() => {
    if (!editing) return "youtube";
    // typeToPlatform also normalizes an unexpected stored value to "custom".
    if (editing.platform) return typeToPlatform(String(editing.platform));
    return typeToPlatform(detectPlatform(initialUrl));
  }, [editing, initialUrl]);

  const [platform, setPlatform] = useState<LinkPlatform>(initialPlatform);
  // Metadata + deep-link derivation use the metadata `type` (x → twitter).
  const type = platformToType(platform);
  const [url, setUrl] = useState<string>(initialUrl);
  const [name, setName] = useState<string>(editing?.name ?? "");
  const [slug, setSlug] = useState<string>(editing?.link ?? "");
  const [error, setError] = useState<string | null>(null);

  // Track manual edits so auto-fill never clobbers user input.
  const typeTouched = useRef(false);
  const nameTouched = useRef(Boolean(editing?.name));
  const slugTouched = useRef(Boolean(editing?.link));

  // ── Live cover preview ──────────────────────────────────────────────────────
  const debouncedUrl = useDebounced(url, 500);
  // The cover the link was saved with — shown immediately when editing, and kept
  // as a fallback so a failed/empty live re-fetch of the same URL never wipes it.
  const editingMeta = useMemo<MetadataPreview | null>(
    () =>
      editing?.payload &&
      (editing.payload.title || editing.payload.subtitle || editing.payload.image)
        ? {
            title: editing.payload.title,
            subtitle: editing.payload.subtitle,
            image: editing.payload.image,
          }
        : null,
    [editing],
  );
  const [metadata, setMetadata] = useState<MetadataPreview | null>(editingMeta);
  // When editing, the stored cover is already resolved — show it, don't spinner.
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaResolved, setMetaResolved] = useState(Boolean(editingMeta));

  useEffect(() => {
    const norm = normalizeUrl(debouncedUrl);
    let cancelled = false;
    // Deferred a tick so no set-state runs synchronously in the effect body
    // (react-hooks/set-state-in-effect); the input is already 500ms-debounced.
    const t = setTimeout(() => {
      if (cancelled) return;
      if (!norm) {
        setMetadata(null);
        setMetaResolved(false);
        setMetaLoading(false);
        return;
      }
      // Editing an existing link: its source URL is unchanged, so keep the stored
      // cover if the live re-fetch can't resolve one (Suwut often returns nothing
      // for an already-shortened/deep-link URL) instead of blanking the preview.
      const keepEditing = editing != null && norm === normalizeUrl(initialUrl);
      setMetaLoading(true);
      previewMetadata(type, norm)
        .then((meta) => {
          if (cancelled) return;
          // Only accept a fetched result that actually carries a cover/title; a
          // content-less response must not overwrite the stored cover when editing.
          const usable = meta && (meta.title || meta.image) ? meta : null;
          setMetadata(usable ?? (keepEditing ? editingMeta : null));
          setMetaResolved(true);
          // Prefill the name from the resolved title (only if untouched/empty).
          if (meta?.title && !nameTouched.current && !name.trim()) {
            setName(meta.title);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setMetadata(keepEditing ? editingMeta : null);
          setMetaResolved(true);
        })
        .finally(() => {
          if (!cancelled) setMetaLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // `name` is intentionally excluded — we only react to url/type changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUrl, type]);

  // ── Slug availability ─────────────────────────────────────────────────────────
  const debouncedSlug = useDebounced(slug, 500);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [suggestion, setSuggestion] = useState<string>("");

  useEffect(() => {
    const candidate = debouncedSlug.trim();
    let cancelled = false;
    // Deferred a tick so no set-state runs synchronously in the effect body
    // (react-hooks/set-state-in-effect); the input is already 500ms-debounced.
    const t = setTimeout(() => {
      if (cancelled) return;
      if (!candidate) {
        setSlugStatus("idle");
        setSuggestion("");
        return;
      }
      // The link keeps its own slug — no need to check when unchanged while editing.
      if (editing && candidate === editing.link) {
        setSlugStatus("available");
        setSuggestion("");
        return;
      }
      setSlugStatus("checking");
      // Slug uniqueness is per platform (§2.2) — the check must carry the
      // platform, and `platform` in the deps re-runs it on every change (the
      // previous answer is meaningless for another platform).
      checkSlug(candidate, platform, editing?.id)
        .then((res) => {
          if (cancelled) return;
          setSlugStatus(res.available ? "available" : "taken");
          setSuggestion(res.available ? "" : res.suggestion || "");
          // "available" refers to the backend's normalized form — reflect it in
          // the field so the user sees the slug that will actually be saved.
          if (res.available && res.normalized && res.normalized !== candidate)
            setSlug(res.normalized);
        })
        .catch(() => {
          if (!cancelled) setSlugStatus("idle");
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [debouncedSlug, editing, platform]);

  // Auto-suggest a slug from the name/url until the user edits it themselves.
  // (Deferred a tick — react-hooks/set-state-in-effect.)
  useEffect(() => {
    if (slugTouched.current) return;
    const next = autoSlug(name, url);
    if (!next) return;
    const t = setTimeout(() => setSlug(next), 0);
    return () => clearTimeout(t);
  }, [name, url]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const [savedLink, setSavedLink] = useState<CustomLink | null>(null);

  const mutation = useMutation({
    mutationFn: (body: LinkInput) =>
      editing
        ? updateCustomLink(editing.id, body)
        : createCustomLink({ ...body, platform }),
    onSuccess: (link) => {
      queryClient.invalidateQueries({ queryKey: ["custom-links"] });
      setSavedLink(link);
      onSaved?.();
    },
    onError: async (e) => {
      // §6: rely on the status code — 400 carries a displayable message array,
      // 422 is "slug taken on this platform" (race with the live check): show
      // the local message and refresh the suggestion via check-slug.
      const { message, status } = await customLinksErrorMessage(e, {
        taken: t("slugTaken"),
        generic: t("error"),
      });
      setError(message);
      if (status === 422) {
        setSlugStatus("taken");
        checkSlug(slug.trim(), platform, editing?.id)
          .then((res) => setSuggestion(res.available ? "" : res.suggestion || ""))
          .catch(() => {});
      }
    },
  });

  function handleSave() {
    setError(null);
    const norm = normalizeUrl(url);
    if (!norm) {
      setError(t("error"));
      return;
    }
    const links = buildDeepLinks(type, norm);
    const body: LinkInput = {
      // Sanitize again at the boundary (mobile parity) — never send a slug the
      // backend would silently rewrite.
      link: sanitizeSlug(slug),
      name: name.trim(),
      iOS: links.iOS,
      iPad: links.iPad,
      Android: links.Android,
      Fallback: links.Fallback,
      // Mobile always sends the four extra-device keys as explicit nulls
      // (LinkInputModel.toJson) — omitting them could mean "keep" on update.
      non_Google_Huawei: null,
      Blackberry: null,
      Fire_OS: null,
      Windows_Mobile: null,
      type: links.type as LinkType,
      source_url: links.source_url,
    };
    mutation.mutate(body);
  }

  const canSave =
    Boolean(normalizeUrl(url)) &&
    Boolean(name.trim()) &&
    Boolean(slug.trim()) &&
    slugStatus !== "taken" &&
    slugStatus !== "checking" &&
    !mutation.isPending;

  // ── Success view ──────────────────────────────────────────────────────────────
  if (savedLink) {
    return (
      <ShareSuccess
        link={savedLink}
        onClose={onClose}
        label={{
          shareUrl: t("shareUrl"),
          copy: t("copy"),
          copied: t("copied"),
          saved: t("saved"),
          done: tClose("close"),
        }}
      />
    );
  }

  return (
    <BottomSheet
      title={editing ? t("edit") : t("create")}
      onClose={onClose}
      footer={
        <div className="space-y-2 p-4">
          {error && (
            <p className="text-center text-xs font-medium text-error">{error}</p>
          )}
          <Button
            variant="gradient"
            className="w-full"
            disabled={!canSave}
            onClick={handleSave}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("save")
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Platform picker — the serving platform (subdomain + slug scope).
            Read-only when editing: the platform is immutable after creation
            (§2.3); to change it the user must delete and recreate the link. */}
        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">
            {t("typeLabel")}
          </span>
          <div className={cn("grid grid-cols-3 gap-2", editing && "opacity-60")}>
            {LINK_PLATFORMS.map(({ platform: p, label }) => {
              const active = platform === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={Boolean(editing)}
                  onClick={() => {
                    typeTouched.current = true;
                    setPlatform(p);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-[11px] font-medium transition-all",
                    active
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border text-muted-foreground",
                    !editing &&
                      !active &&
                      "hover:border-primary/40 hover:bg-surface",
                    editing && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-white ring-1 ring-primary/20 shadow-sm"
                        : "bg-surface",
                    )}
                  >
                    <PlatformIcon type={p} className="size-6" />
                  </span>
                  <span className="max-w-full truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Source URL */}
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">
            {t("urlLabel")}
          </span>
          <Input
            value={url}
            placeholder={t("urlPlaceholder")}
            inputMode="url"
            autoComplete="off"
            onChange={(e) => {
              const v = e.target.value;
              setUrl(v);
              // Auto-detect the platform until the user picks one explicitly.
              // Only switch to platforms visible in the picker ("custom" is
              // hidden for now, and vimeo has no serving platform).
              if (!typeTouched.current && !editing) {
                const detected = typeToPlatform(detectPlatform(v));
                if (LINK_PLATFORMS.some((p) => p.platform === detected)) {
                  setPlatform(detected);
                }
              }
            }}
          />
        </label>

        {/* Cover preview */}
        <MetadataCard
          metadata={metadata}
          loading={metaLoading}
          resolved={metaResolved}
          emptyText={t("preview.noMetadata")}
        />

        {/* Name */}
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">
            {t("nameLabel")}
          </span>
          <Input
            value={name}
            placeholder={t("namePlaceholder")}
            onChange={(e) => {
              nameTouched.current = true;
              setName(e.target.value);
            }}
          />
        </label>

        {/* Slug */}
        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">
            {t("slugLabel")}
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-input bg-card px-3">
            {/* Display hint only — the real share URL is the server's
                short_url ({platform}.qshot.it since the qshot.it migration). */}
            <span className="shrink-0 text-sm text-muted-foreground">
              {platformShortHost(platform)}/
            </span>
            <input
              value={slug}
              placeholder={t("slugPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                slugTouched.current = true;
                setSlug(sanitizeSlug(e.target.value));
              }}
              className="h-11 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <SlugIndicator status={slugStatus} />
          </div>
          <SlugHint
            status={slugStatus}
            suggestion={suggestion}
            onUseSuggestion={() => {
              slugTouched.current = true;
              setSlug(sanitizeSlug(suggestion));
            }}
            labels={{
              available: t("slugAvailable"),
              taken: t("slugTaken"),
              checking: t("slugChecking"),
              suggestion: (s) => t("slugSuggestion", { suggestion: s }),
            }}
          />
        </div>
      </div>
    </BottomSheet>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetadataCard({
  metadata,
  loading,
  resolved,
  emptyText,
}: {
  metadata: MetadataPreview | null;
  loading: boolean;
  resolved: boolean;
  emptyText: string;
}) {
  // Prefer showing whatever cover we already have over a skeleton — this keeps
  // the stored cover visible while a live re-fetch runs (e.g. when editing).
  if (metadata && (metadata.title || metadata.image)) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-opacity",
          loading && "opacity-60",
        )}
      >
        {metadata.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={metadata.image}
            alt=""
            referrerPolicy="no-referrer"
            className="size-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Link2 className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {metadata.title && (
            <p className="truncate text-sm font-semibold text-foreground">
              {metadata.title}
            </p>
          )}
          {metadata.subtitle && (
            <p className="truncate text-xs text-muted-foreground">
              {metadata.subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  // No cover yet, but a fetch is in flight — show a skeleton.
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="size-14 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  // Only show the empty hint once we've actually tried to resolve something.
  if (resolved) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return null;
}

function SlugIndicator({ status }: { status: SlugStatus }) {
  if (status === "checking")
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
  if (status === "available")
    return <Check className="size-4 shrink-0 text-success" />;
  return null;
}

function SlugHint({
  status,
  suggestion,
  onUseSuggestion,
  labels,
}: {
  status: SlugStatus;
  suggestion: string;
  onUseSuggestion: () => void;
  labels: {
    available: string;
    taken: string;
    checking: string;
    suggestion: (s: string) => string;
  };
}) {
  if (status === "checking")
    return <p className="mt-1 text-xs text-muted-foreground">{labels.checking}</p>;
  if (status === "available")
    return <p className="mt-1 text-xs text-success">{labels.available}</p>;
  if (status === "taken")
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-error">
        <span>{labels.taken}</span>
        {suggestion && (
          <button
            type="button"
            onClick={onUseSuggestion}
            className="font-semibold text-primary underline underline-offset-2"
          >
            {labels.suggestion(suggestion)}
          </button>
        )}
      </p>
    );
  return null;
}

function ShareSuccess({
  link,
  onClose,
  label,
}: {
  link: CustomLink;
  onClose: () => void;
  label: {
    shareUrl: string;
    copy: string;
    copied: string;
    saved: string;
    done: string;
  };
}) {
  // §2.5: ALWAYS read short_url from the response. The subdomain build is a
  // last-resort fallback for a malformed response only (suwut.com is dead).
  const shareUrl =
    link.short_url ||
    `https://${platformShortHost(link.platform)}/${link.link}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the URL is still visible to copy manually */
    }
  }

  return (
    <BottomSheet
      title={label.saved}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button variant="gradient" className="w-full" onClick={onClose}>
            {label.done}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/15">
            <Check className="size-7 text-success" />
          </span>
          {link.name && (
            <p className="text-sm font-semibold text-foreground">{link.name}</p>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-muted-foreground">
            {label.shareUrl}
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={copy}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" /> {label.copied}
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> {label.copy}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
