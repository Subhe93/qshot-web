"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Calendar,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  ScanLine,
  Search,
  Settings2,
  Star,
  Tags,
  Users,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  FC,
  callablePhone,
  contactDisplayName,
  dialNumber,
  downloadBulkExport,
  entBool,
  getContactsSummary,
  listContactTags,
  listContacts,
  primaryEmail,
  primaryPhone,
  readContactsError,
  toggleFavorite,
  whatsappNumber,
  type Contact,
} from "@/lib/api/contacts";
import {
  ContactAvatar,
  GateBoundary,
  TagChip,
  resolveGate,
  useContactsEntitlements,
} from "@/components/contacts/shared";
import {
  QUICK_ACTION_FALLBACK_ORDER,
  quickActionPref,
  type ContactQuickAction,
} from "@/lib/contacts-prefs";
import { cn } from "@/lib/utils";

/**
 * The contacts book — web port of mobile `contacts_fragment.dart` (branch
 * feature/contacts, dev build 179): summary/usage line, search, All/Favourites
 * + tag filter chips, rows with a one-tap action, and the tools row (tags,
 * scan, events, social settings, export). Entitlements gate first — api-spec
 * §3 says call /contacts/entitlements before drawing any screen.
 */
export default function ContactsPage() {
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const gate = resolveGate(ent);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <GateBoundary
        gate={gate}
        lockedTitle={t("contactsLockedTitle")}
        lockedBody={t("contactsLockedBody")}
        onRetry={() => void ent.refetch()}
      >
        <Book />
      </GateBoundary>
    </div>
  );
}

function Book() {
  const t = useTranslations("contacts");
  const router = useRouter();
  const queryClient = useQueryClient();
  const ent = useContactsEntitlements();

  const [q, setQ] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [tagId, setTagId] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  // Device preference for the row's one-tap action (mobile ContactQuickAction).
  // Read deferred so the SSR markup (fallback "call") matches hydration.
  const [quickAction, setQuickAction] = useState<ContactQuickAction>("call");
  useEffect(() => {
    const handle = setTimeout(() => setQuickAction(quickActionPref.get()), 0);
    return () => clearTimeout(handle);
  }, []);
  const [exportOpen, setExportOpen] = useState(false);
  // Favourite toggles patch rows locally — the list itself is cache-derived.
  const [patched, setPatched] = useState<Record<string, Contact>>({});

  // Debounce the search like mobile's book (the query key carries the text).
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(handle);
  }, [q]);

  const summary = useQuery({
    queryKey: ["contacts-summary"],
    queryFn: getContactsSummary,
  });
  const tags = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });

  // Rows are DERIVED from the query cache (an infinite query accumulates the
  // pages). Filling component state from inside queryFn broke on any cache
  // hit — returning to the page, or re-picking a filter already fetched,
  // skipped queryFn entirely and left the list blank (seen live 2026-08-27).
  const list = useInfiniteQuery({
    queryKey: ["contacts", debouncedQ, favorite, tagId, source],
    queryFn: ({ pageParam }) =>
      listContacts({
        q: debouncedQ || undefined,
        favorite: favorite || undefined,
        tag: tagId ?? undefined,
        source: source ?? undefined,
        page: pageParam,
        limit: 30,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages
        ? last.pagination.page + 1
        : undefined,
  });
  const rows = (list.data?.pages ?? [])
    .flatMap((p) => p.contacts)
    .map((c) => patched[c._id] ?? c);

  const favM = useMutation({
    mutationFn: (id: string) => toggleFavorite(id),
    onSuccess: (updated) => {
      setPatched((prev) => ({ ...prev, [updated._id]: updated }));
      void queryClient.invalidateQueries({ queryKey: ["contacts-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  function resetTo(next: {
    q?: string;
    favorite?: boolean;
    tag?: string | null;
    source?: string | null;
  }) {
    if (next.q !== undefined) setQ(next.q);
    if (next.favorite !== undefined) setFavorite(next.favorite);
    if (next.tag !== undefined) setTagId(next.tag);
    if (next.source !== undefined) setSource(next.source);
  }

  const hasMore = list.hasNextPage;
  const total = summary.data?.total ?? 0;
  const limit = summary.data?.limit;
  const empty = !list.isLoading && rows.length === 0;
  const filtered = Boolean(debouncedQ || favorite || tagId || source);
  const canScan = entBool(ent.data, FC.cardScanEnabled);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("contactsTab")}</h1>
          {limit != null && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("contactsUsed", { current: total, limit })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canScan && (
            <Link href="/contacts/scan">
              <Button variant="outline" size="sm">
                <ScanLine className="size-4" />
                {t("scanCardEntry")}
              </Button>
            </Link>
          )}
          <Link href="/contacts/new">
            <Button variant="gradient" size="sm">
              <Plus className="size-4" />
              {t("addContact")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Tools row */}
      <div className="mt-4 flex flex-wrap gap-2">
        <ToolLink href="/contacts/tags" Icon={Tags} label={t("tagsTitle")} />
        <ToolLink href="/contacts/social" Icon={Settings2} label={t("settingsTitle")} />
        {entBool(ent.data, FC.eventMode) && (
          <ToolLink href="/contacts/events" Icon={Calendar} label={t("evTitle")} />
        )}
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <Download className="size-3.5" />
          {t("exportEntry")}
        </button>
      </div>

      {/* Search */}
      <div className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => resetTo({ q: e.target.value })}
          placeholder={t("searchHint")}
          className="h-full w-full bg-transparent text-sm outline-none"
        />
      </div>

      {/* Filter chips: All / Favourites / tags */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip
          active={!favorite && !tagId && !source}
          label={t("filterAll")}
          onClick={() => resetTo({ favorite: false, tag: null, source: null })}
        />
        <FilterChip
          active={favorite}
          label={t("filterFavourites")}
          onClick={() => resetTo({ favorite: !favorite })}
        />
        {/* Source chips — mobile contacts_fragment order: Scanned (qr_scan),
            Leads, Bookings, Manual. */}
        {(
          [
            ["qr_scan", "chipScanned"],
            ["lead_form", "chipLeads"],
            ["booking", "chipBookings"],
            ["manual", "chipManual"],
          ] as const
        ).map(([value, key]) => (
          <FilterChip
            key={value}
            active={source === value}
            label={t(key)}
            onClick={() => resetTo({ source: source === value ? null : value })}
          />
        ))}
        {(tags.data ?? []).map((tag) => (
          <TagChip
            key={tag._id}
            tag={tag}
            active={tagId === tag._id}
            onClick={() => resetTo({ tag: tagId === tag._id ? null : tag._id })}
          />
        ))}
      </div>

      {/* List */}
      <div className="mt-4">
        {list.isLoading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : empty ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Users className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-bold text-foreground">
              {filtered
                ? debouncedQ
                  ? t("emptySearch")
                  : t("emptyFiltered")
                : t("emptyTitle")}
            </p>
            {!filtered && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("emptyFirstRunNoScan")}
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {rows.map((c) => (
              <ContactRow
                key={c._id}
                contact={c}
                quickAction={quickAction}
                onOpen={() => router.push(`/contacts/${c._id}`)}
                onToggleFavorite={() => favM.mutate(c._id)}
              />
            ))}
          </div>
        )}

        {/* Infinite scroll, like the mobile book — the sentinel pulls the
            next page in as it becomes visible. */}
        {hasMore && (
          <LoadMoreSentinel
            busy={list.isFetchingNextPage}
            onVisible={() => void list.fetchNextPage()}
          />
        )}
      </div>

      {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} />}
    </>
  );
}

function LoadMoreSentinel({
  busy,
  onVisible,
}: {
  busy: boolean;
  onVisible: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || busy) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onVisible();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [busy, onVisible]);
  return (
    <div ref={ref} className="flex justify-center py-4">
      {busy && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
    </div>
  );
}

function ToolLink({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
    >
      <Icon className="size-3.5" />
      {label}
    </Link>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

/**
 * One book row — avatar, name, company · phone, the one-tap action and the
 * favourite star. The action is the user's DEVICE preference (mobile
 * ContactQuickAction), falling back call → WhatsApp → email when the chosen
 * one has nothing to act on; a fax-only contact never shows a call button,
 * and a row with nothing to act on shows no dead icon at all.
 */
function ContactRow({
  contact,
  quickAction,
  onOpen,
  onToggleFavorite,
}: {
  contact: Contact;
  quickAction: ContactQuickAction;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const t = useTranslations("contacts");
  const name = contactDisplayName(contact) || t("unnamed");
  const phone = primaryPhone(contact);
  const call = callablePhone(contact);
  const email = primaryEmail(contact);
  const subtitle = [contact.company, phone?.number].filter(Boolean).join(" · ");

  // The preferred action first, then the fixed fallback order.
  const order: ContactQuickAction[] = [
    quickAction,
    ...QUICK_ACTION_FALLBACK_ORDER.filter((a) => a !== quickAction),
  ];
  let action: { href: string; Icon: typeof Phone; label: string } | null = null;
  for (const kind of order) {
    if (kind === "call" && call) {
      action = { href: `tel:${dialNumber(call)}`, Icon: Phone, label: t("call") };
      break;
    }
    if (kind === "whatsapp" && call) {
      action = {
        href: `https://wa.me/${whatsappNumber(call)}`,
        Icon: MessageCircle,
        label: t("whatsapp"),
      };
      break;
    }
    if (kind === "email" && email) {
      action = { href: `mailto:${email.address}`, Icon: Mail, label: t("email") };
      break;
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <ContactAvatar contact={contact} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {name}
          </span>
          {subtitle && (
            <span className="block truncate text-xs text-muted-foreground" dir="auto">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {action && (
        <a
          href={action.href}
          target={action.href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          aria-label={action.label}
          className="shrink-0 rounded-full border border-border p-2 text-foreground hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <action.Icon className="size-4" />
        </a>
      )}
      <button
        type="button"
        aria-label={t("filterFavourites")}
        onClick={onToggleFavorite}
        className="shrink-0 rounded-full p-2"
      >
        <Star
          className={cn(
            "size-4",
            contact.isFavorite
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground",
          )}
        />
      </button>
    </div>
  );
}

/**
 * Bulk export sheet — mobile `contacts_export_sheet.dart`. Scope (all / a
 * tag), format (CSV / vCard). Locked body when the plan lacks
 * `contacts_export_bulk`; the single-contact vCard stays on the detail page
 * for every plan (api-spec §8.4).
 */
function ExportSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const tags = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });
  const allowed = entBool(ent.data, FC.exportBulk);

  const [format, setFormat] = useState<"csv" | "vcf">("csv");
  const [tagId, setTagId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await downloadBulkExport(format, { tag: tagId ?? undefined });
      onClose();
    } catch (e) {
      const err = await readContactsError(e);
      // 3 requests / 5 minutes — surface the wait copy, not a generic error.
      setError(err.status === 429 ? t("exportThrottled") : t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet title={t("exportTitle")} onClose={onClose}>
      {!allowed ? (
        <div className="py-6 text-center">
          <p className="font-bold text-foreground">{t("exportLockedTitle")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("exportLockedBody")}</p>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          <p className="text-sm text-muted-foreground">{t("exportSubtitle")}</p>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-foreground">
              {t("exportFormat")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <FormatOption
                active={format === "csv"}
                title="CSV"
                hint={t("exportCsvHint")}
                onClick={() => setFormat("csv")}
              />
              <FormatOption
                active={format === "vcf"}
                title="vCard"
                hint={t("exportVcardHint")}
                onClick={() => setFormat("vcf")}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-foreground">
              {t("exportScope")}
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={tagId == null}
                label={t("exportScopeAll")}
                onClick={() => setTagId(null)}
              />
              {(tags.data ?? []).map((tag) => (
                <TagChip
                  key={tag._id}
                  tag={tag}
                  active={tagId === tag._id}
                  onClick={() => setTagId(tagId === tag._id ? null : tag._id)}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button variant="gradient" className="w-full" disabled={busy} onClick={run}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : t("exportAction")}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

function FormatOption({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-start",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
      )}
    >
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}
