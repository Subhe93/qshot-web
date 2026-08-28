"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  contactDisplayName,
  contactTagIds,
  deleteContact,
  dialNumber,
  downloadVcard,
  fetchCardImage,
  getContact,
  listContactTags,
  resetContactField,
  resolveContactTags,
  setContactTags,
  toggleFavorite,
  whatsappNumber,
  type Contact,
} from "@/lib/api/contacts";
import {
  ContactAvatar,
  EMAIL_LABEL_KEY,
  PHONE_LABEL_KEY,
  SOURCE_LABEL_KEY,
  TagChip,
} from "@/components/contacts/shared";
import { cn } from "@/lib/utils";

/**
 * Contact detail — web port of mobile `contact_details_layout.dart`: header
 * with avatar/name/source, action row (call / WhatsApp / email / website),
 * field sections, the owner's note and tags ("your memory"), card photos
 * (authenticated), live-sync affordances (an "edited by you" row can be
 * handed back to sync), vCard export (every plan) and delete.
 *
 * `linkState: "frozen"` is NEVER surfaced (api-spec §4.3) — only `live` is
 * shown, positively, as "updated from their profile".
 */
export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("contacts");
  const router = useRouter();
  const queryClient = useQueryClient();

  const contactQ = useQuery({
    queryKey: ["contact", id],
    queryFn: () => getContact(id),
  });
  const contact = contactQ.data;
  // Some responses carry tags as bare ids — resolve names from the tag list.
  const tagsQ = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const favM = useMutation({
    mutationFn: () => toggleFavorite(id),
    onSuccess: (updated) => queryClient.setQueryData(["contact", id], updated),
  });
  const deleteM = useMutation({
    mutationFn: () => deleteContact(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      router.push("/contacts");
    },
  });
  const resetM = useMutation({
    mutationFn: (field: string) => resetContactField(id, field),
    onSuccess: (updated) => queryClient.setQueryData(["contact", id], updated),
  });

  if (contactQ.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!contact) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        {t("somethingWentWrong")}
      </div>
    );
  }

  const name = contactDisplayName(contact) || t("unnamed");
  const overrides = contact.overrides ?? [];
  const live = contact.linkState === "live";
  const phones = (contact.phones ?? []).filter((p) => (p.number ?? "").trim());
  const emails = (contact.emails ?? []).filter((p) => (p.address ?? "").trim());
  const websites = (contact.websites ?? []).filter((w) => (w.url ?? "").trim());
  const socials = (contact.socials ?? []).filter((s) => (s.url ?? "").trim());
  const address = contact.address;
  const addressLine = [
    address?.street,
    address?.city,
    address?.state,
    address?.zip,
    address?.country,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const call = phones.find((p) => p.label !== "fax");
  const whatsapp = phones.find((p) => p.label === "whatsapp");
  const sourceKey = SOURCE_LABEL_KEY[contact.source ?? ""] ?? null;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/contacts"
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label={t("close")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("filterFavourites")}
            onClick={() => favM.mutate()}
            className="rounded-full p-2 hover:bg-muted"
          >
            <Star
              className={cn(
                "size-5",
                contact.isFavorite
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground",
              )}
            />
          </button>
          <Link
            href={`/contacts/${id}/edit`}
            aria-label={t("edit")}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-5" />
          </Link>
          <button
            type="button"
            aria-label={t("delete")}
            onClick={() => setConfirmDelete(true)}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-error"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="mt-4 flex flex-col items-center text-center">
        <ContactAvatar contact={contact} size={72} />
        <h1 className="mt-3 text-xl font-bold text-foreground" dir="auto">
          {name}
        </h1>
        {(contact.jobTitle || contact.company) && (
          <p className="mt-0.5 text-sm text-muted-foreground" dir="auto">
            {[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {sourceKey && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {t(sourceKey)}
            </span>
          )}
          {live && (
            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              {t("liveUpdated")}
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        <QuickAction
          Icon={Phone}
          label={t("call")}
          href={call ? `tel:${dialNumber(call)}` : undefined}
        />
        <QuickAction
          Icon={MessageCircle}
          label={t("whatsapp")}
          href={
            whatsapp ? `https://wa.me/${whatsappNumber(whatsapp)}` : undefined
          }
        />
        <QuickAction
          Icon={Mail}
          label={t("email")}
          href={emails[0] ? `mailto:${emails[0].address}` : undefined}
        />
        <QuickAction
          Icon={Globe}
          label={t("scanWebsite")}
          href={websites[0]?.url}
          external
        />
      </div>

      {/* Fields */}
      <div className="mt-6 space-y-4">
        {phones.length > 0 && (
          <Section title={t("phones")}>
            {phones.map((p, i) => (
              <FieldRow
                key={i}
                label={t(PHONE_LABEL_KEY[p.label ?? "other"] ?? "phoneLabelOther")}
                value={p.number ?? ""}
                href={p.label === "fax" ? undefined : `tel:${dialNumber(p)}`}
                ltr
              />
            ))}
          </Section>
        )}
        {emails.length > 0 && (
          <Section title={t("emails")}>
            {emails.map((p, i) => (
              <FieldRow
                key={i}
                label={t(EMAIL_LABEL_KEY[p.label ?? "other"] ?? "emailLabelOther")}
                value={p.address ?? ""}
                href={`mailto:${p.address}`}
                ltr
              />
            ))}
          </Section>
        )}
        {websites.length > 0 && (
          <Section title={t("websites")}>
            {websites.map((w, i) => (
              <FieldRow key={i} label={w.label ?? ""} value={w.url ?? ""} href={w.url} external ltr />
            ))}
          </Section>
        )}
        {socials.length > 0 && (
          <Section title={t("socials")}>
            {socials.map((s, i) => (
              <FieldRow
                key={i}
                label={s.platform ?? ""}
                value={s.url ?? ""}
                href={s.url}
                external
                ltr
              />
            ))}
          </Section>
        )}
        {addressLine && (
          <Section title={t("address")}>
            <div className="flex items-start gap-2 px-3 py-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground" dir="auto">
                {addressLine}
              </p>
            </div>
          </Section>
        )}

        {/* Your memory: note + tags — never synced (feature-guide §6.2). */}
        <Section title={t("yourMemory")}>
          {contact.note ? (
            <p className="whitespace-pre-line px-3 py-2.5 text-sm text-foreground" dir="auto">
              {contact.note}
            </p>
          ) : (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">{t("noteHint")}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5">
            {resolveContactTags(contact, tagsQ.data ?? []).map((tag) => (
              <TagChip key={tag._id} tag={tag} />
            ))}
            <button
              type="button"
              onClick={() => setTagsOpen(true)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              + {t("tags")}
            </button>
          </div>
        </Section>

        {/* Edited-by-you fields — hand one back to sync (live contacts only). */}
        {live && overrides.length > 0 && (
          <Section title={t("editedByYou")}>
            {overrides.map((field) => (
              <div
                key={field}
                className="flex items-center justify-between px-3 py-2.5"
              >
                <span className="text-sm text-foreground">{field}</span>
                <button
                  type="button"
                  disabled={resetM.isPending}
                  onClick={() => resetM.mutate(field)}
                  className="flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  <RotateCcw className="size-3.5" />
                  {t("resync")}
                </button>
              </div>
            ))}
          </Section>
        )}

        {/* Card photos — authenticated, never public (api-spec §7.5). */}
        {(contact.cardImages ?? []).length > 0 && (
          <Section title={t("scanCardPhotos")}>
            <div className="flex gap-2 p-3">
              {(contact.cardImages ?? []).map((img, i) => (
                <CardImage key={i} contact={contact} side={img.side ?? "front"} />
              ))}
            </div>
          </Section>
        )}

        {/* Save to phone: single-contact vCard, every plan (api-spec §4.9). */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void downloadVcard(id, name)}
        >
          <Download className="size-4" />
          {t("saveToPhone")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        onConfirm={() => deleteM.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />

      {tagsOpen && (
        <AssignTagsSheet contact={contact} onClose={() => setTagsOpen(false)} />
      )}
    </div>
  );
}

/** One button of the action row — greyed when the contact has no such detail. */
function QuickAction({
  Icon,
  label,
  href,
  external,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <Icon className="size-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </>
  );
  const base =
    "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5";
  if (!href) {
    return (
      <div className={cn(base, "border-border text-muted-foreground/40")}>{body}</div>
    );
  }
  return (
    <a
      href={href}
      target={external || href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className={cn(base, "border-border text-foreground hover:bg-muted")}
    >
      {body}
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {children}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  href,
  external,
  ltr,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
  ltr?: boolean;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">{label}</span>
        <span
          className="block truncate text-sm text-foreground"
          dir={ltr ? "ltr" : "auto"}
        >
          {value}
        </span>
      </span>
    </>
  );
  const className =
    "flex w-full items-center gap-2 border-b border-border px-3 py-2 text-start last:border-b-0";
  return href ? (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(className, "hover:bg-muted")}
    >
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Authenticated card photo → object URL, revoked on unmount. */
function CardImage({ contact, side }: { contact: Contact; side: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let stale = false;
    // The image route is keyed by the SCAN, but the contact carries the URL;
    // extract the scan id from it (`/contacts/card-scan/<id>/image/<side>`).
    const raw = (contact.cardImages ?? []).find((i) => i.side === side)?.url ?? "";
    const m = raw.match(/card-scan\/([^/]+)\/image/);
    if (!m) return;
    void fetchCardImage(m[1], side)
      .then((u) => {
        if (stale) URL.revokeObjectURL(u);
        else {
          revoke = u;
          setUrl(u);
        }
      })
      .catch(() => undefined);
    return () => {
      stale = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [contact, side]);
  if (!url) return <div className="h-24 w-36 animate-pulse rounded-lg bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-24 rounded-lg object-cover" />;
}

/** Mobile `assign_tags_sheet.dart` — replaces the contact's tag list. */
function AssignTagsSheet({
  contact,
  onClose,
}: {
  contact: Contact;
  onClose: () => void;
}) {
  const t = useTranslations("contacts");
  const queryClient = useQueryClient();
  const tagsQ = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });
  const [selected, setSelected] = useState<string[]>(contactTagIds(contact));
  const saveM = useMutation({
    mutationFn: () => setContactTags(contact._id, selected),
    onSuccess: (updated) => {
      queryClient.setQueryData(["contact", contact._id], updated);
      onClose();
    },
  });

  return (
    <BottomSheet title={t("assignTagsTitle")} onClose={onClose}>
      <div className="space-y-4 pb-4">
        {(tagsQ.data ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("assignTagsEmpty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(tagsQ.data ?? []).map((tag) => (
              <TagChip
                key={tag._id}
                tag={tag}
                active={selected.includes(tag._id)}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(tag._id)
                      ? prev.filter((x) => x !== tag._id)
                      : [...prev, tag._id],
                  )
                }
              />
            ))}
          </div>
        )}
        <Button
          variant="gradient"
          className="w-full"
          disabled={saveM.isPending}
          onClick={() => saveM.mutate()}
        >
          {saveM.isPending ? <Loader2 className="size-4 animate-spin" /> : t("save")}
        </Button>
      </div>
    </BottomSheet>
  );
}
