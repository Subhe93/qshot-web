"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  EMAIL_LABELS,
  FC,
  PHONE_LABELS,
  contactDisplayName,
  contactTagIds,
  createContact,
  entLimit,
  listContactTags,
  mergeContacts,
  readContactsError,
  updateContact,
  type Contact,
  type ContactEmail,
  type ContactPhone,
  type ContactWebsite,
  type ContactWriteBody,
} from "@/lib/api/contacts";
import {
  EMAIL_LABEL_KEY,
  PHONE_LABEL_KEY,
  TagChip,
  useContactsEntitlements,
} from "@/components/contacts/shared";

/**
 * Contact editor — web port of mobile `contact_editor_layout.dart`. One form
 * for create and edit. THE rule that must never break (api-spec §4.7): on
 * update, send ONLY the fields the user actually changed — every field sent
 * in PUT becomes permanently protected from live sync, so a whole-object PUT
 * would freeze everything.
 *
 * A 409 DUPLICATE_CANDIDATES on create is a question, not an error: merge
 * with an existing contact / keep both / cancel (feature-guide §6.1 — no
 * silent merging, ever).
 */

interface Draft {
  firstName: string;
  lastName: string;
  displayName: string;
  company: string;
  jobTitle: string;
  phones: ContactPhone[];
  emails: ContactEmail[];
  websites: ContactWebsite[];
  note: string;
  tags: string[];
}

function draftFrom(c?: Contact | null): Draft {
  return {
    firstName: c?.firstName ?? "",
    lastName: c?.lastName ?? "",
    displayName: c?.displayName ?? "",
    company: c?.company ?? "",
    jobTitle: c?.jobTitle ?? "",
    phones: (c?.phones ?? []).map((p) => ({ ...p })),
    emails: (c?.emails ?? []).map((p) => ({ ...p })),
    websites: (c?.websites ?? []).map((w) => ({ ...w })),
    note: c?.note ?? "",
    tags: c ? contactTagIds(c) : [],
  };
}

/** Strip rows the user added but left blank. */
function cleanDraft(d: Draft): Draft {
  return {
    ...d,
    phones: d.phones.filter((p) => (p.number ?? "").trim()),
    emails: d.emails.filter((p) => (p.address ?? "").trim()),
    websites: d.websites.filter((w) => (w.url ?? "").trim()),
  };
}

/** The changed subset of the draft — the ONLY thing an update may send. */
function dirtyFields(initial: Draft, current: Draft): Partial<ContactWriteBody> {
  const out: Partial<ContactWriteBody> = {};
  const a = cleanDraft(initial);
  const b = cleanDraft(current);
  for (const key of [
    "firstName",
    "lastName",
    "displayName",
    "company",
    "jobTitle",
    "note",
  ] as const) {
    if (a[key] !== b[key]) out[key] = b[key];
  }
  for (const key of ["phones", "emails", "websites"] as const) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out[key] = b[key];
  }
  if (JSON.stringify(a.tags) !== JSON.stringify(b.tags)) out.tags = b.tags;
  return out;
}

export function ContactEditor({ contact }: { contact?: Contact | null }) {
  const t = useTranslations("contacts");
  const router = useRouter();
  const queryClient = useQueryClient();
  const ent = useContactsEntitlements();
  const tagsQ = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });

  const isEdit = contact != null;
  const initial = useMemo(() => draftFrom(contact), [contact]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Contact[] | null>(null);
  // The create id is stable across duplicate-sheet retries so the server can
  // recognise a replay (api-spec §4.4).
  const [clientRequestId] = useState(() => crypto.randomUUID());

  const noteMax = entLimit(ent.data, FC.noteMaxLength);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    void queryClient.invalidateQueries({ queryKey: ["contacts-summary"] });
  }

  async function submit(allowDuplicate = false) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const body = dirtyFields(initial, draft);
        if (Object.keys(body).length === 0) {
          router.push(`/contacts/${contact._id}`);
          return;
        }
        const updated = await updateContact(contact._id, body);
        queryClient.setQueryData(["contact", contact._id], updated);
        invalidate();
        router.push(`/contacts/${contact._id}`);
      } else {
        const clean = cleanDraft(draft);
        const res = await createContact({
          ...clean,
          kind: "person",
          clientRequestId,
          ...(allowDuplicate ? { allowDuplicate: true } : {}),
        });
        invalidate();
        router.push(`/contacts/${res.contact._id}`);
      }
    } catch (e) {
      const err = await readContactsError(e);
      if (err.code === "DUPLICATE_CANDIDATES" && err.duplicates?.length) {
        setDuplicates(err.duplicates);
      } else if (err.code === "LIMIT_REACHED" && err.featureCode === FC.noteMaxLength) {
        setError(
          err.limit != null
            ? t("noteTooLongForPlan", { limit: err.limit })
            : t("noteTooLong"),
        );
      } else if (err.code === "LIMIT_REACHED") {
        setError(
          err.limit != null && err.current != null
            ? t("limitMessage", { current: err.current, limit: err.limit })
            : t("limitMessageNoNumbers"),
        );
      } else {
        setError(err.message || t("genericError"));
      }
    } finally {
      setSaving(false);
    }
  }

  /** Merge the entered data into `existing`: force-create then server-merge —
   *  the server's merge keeps conflicting values side by side (§4.8). */
  async function mergeInto(existing: Contact) {
    setSaving(true);
    setError(null);
    try {
      const clean = cleanDraft(draft);
      const created = await createContact({
        ...clean,
        kind: "person",
        clientRequestId,
        allowDuplicate: true,
      });
      const merged = await mergeContacts(existing._id, created.contact._id);
      invalidate();
      setDuplicates(null);
      router.push(`/contacts/${merged._id ?? existing._id}`);
    } catch (e) {
      const err = await readContactsError(e);
      setDuplicates(null);
      setError(err.message || t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href={isEdit ? `/contacts/${contact._id}` : "/contacts"}
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label={t("cancel")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? t("editContact") : t("newContact")}
        </h1>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("firstName")}
            value={draft.firstName}
            onChange={(v) => patch({ firstName: v })}
          />
          <Field
            label={t("lastName")}
            value={draft.lastName}
            onChange={(v) => patch({ lastName: v })}
          />
        </div>
        <Field
          label={t("nickname")}
          hint={t("nicknameHint")}
          value={draft.displayName}
          onChange={(v) => patch({ displayName: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("company")}
            value={draft.company}
            onChange={(v) => patch({ company: v })}
          />
          <Field
            label={t("jobTitle")}
            value={draft.jobTitle}
            onChange={(v) => patch({ jobTitle: v })}
          />
        </div>

        {/* Phones */}
        <ListSection
          title={t("phones")}
          addLabel={t("addPhone")}
          onAdd={() =>
            patch({
              phones: [...draft.phones, { label: "mobile", number: "" }],
            })
          }
        >
          {draft.phones.map((p, i) => (
            <EntryRow
              key={i}
              label={p.label ?? "mobile"}
              labels={PHONE_LABELS}
              labelKey={(l) => PHONE_LABEL_KEY[l] ?? "phoneLabelOther"}
              value={p.number ?? ""}
              placeholder={t("phoneNumber")}
              inputMode="tel"
              onLabel={(label) =>
                patch({
                  phones: draft.phones.map((x, j) => (j === i ? { ...x, label } : x)),
                })
              }
              onValue={(number) =>
                patch({
                  phones: draft.phones.map((x, j) =>
                    j === i ? { ...x, number } : x,
                  ),
                })
              }
              onRemove={() =>
                patch({ phones: draft.phones.filter((_, j) => j !== i) })
              }
            />
          ))}
        </ListSection>

        {/* Emails */}
        <ListSection
          title={t("emails")}
          addLabel={t("addEmail")}
          onAdd={() =>
            patch({
              emails: [...draft.emails, { label: "personal", address: "" }],
            })
          }
        >
          {draft.emails.map((p, i) => (
            <EntryRow
              key={i}
              label={p.label ?? "personal"}
              labels={EMAIL_LABELS}
              labelKey={(l) => EMAIL_LABEL_KEY[l] ?? "emailLabelOther"}
              value={p.address ?? ""}
              placeholder={t("emailAddress")}
              inputMode="email"
              onLabel={(label) =>
                patch({
                  emails: draft.emails.map((x, j) => (j === i ? { ...x, label } : x)),
                })
              }
              onValue={(address) =>
                patch({
                  emails: draft.emails.map((x, j) =>
                    j === i ? { ...x, address } : x,
                  ),
                })
              }
              onRemove={() =>
                patch({ emails: draft.emails.filter((_, j) => j !== i) })
              }
            />
          ))}
        </ListSection>

        {/* Websites */}
        <ListSection
          title={t("websites")}
          addLabel={`+ ${t("websites")}`}
          onAdd={() =>
            patch({
              websites: [...draft.websites, { label: "website", url: "" }],
            })
          }
        >
          {draft.websites.map((w, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
              <input
                value={w.url ?? ""}
                onChange={(e) =>
                  patch({
                    websites: draft.websites.map((x, j) =>
                      j === i ? { ...x, url: e.target.value } : x,
                    ),
                  })
                }
                placeholder="https://"
                dir="ltr"
                className="h-9 w-full bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                aria-label={t("delete")}
                onClick={() =>
                  patch({ websites: draft.websites.filter((_, j) => j !== i) })
                }
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-error"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </ListSection>

        {/* Note — with the plan's counter; never silently truncated (§4.4). */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <label className="text-[13px] font-semibold text-foreground">
              {t("note")}
            </label>
            {noteMax != null && (
              <span className="text-[11px] text-muted-foreground">
                {t("noteCounter", { used: draft.note.length, max: noteMax })}
              </span>
            )}
          </div>
          <textarea
            value={draft.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder={t("noteHint")}
            rows={3}
            dir="auto"
            className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
          />
          {noteMax != null && draft.note.length > noteMax && (
            <p className="mt-1 px-1 text-xs text-error">{t("noteTooLong")}</p>
          )}
        </div>

        {/* Tags */}
        {(tagsQ.data ?? []).length > 0 && (
          <div>
            <p className="mb-1.5 px-1 text-[13px] font-semibold text-foreground">
              {t("tags")}
            </p>
            <div className="flex flex-wrap gap-2">
              {(tagsQ.data ?? []).map((tag) => (
                <TagChip
                  key={tag._id}
                  tag={tag}
                  active={draft.tags.includes(tag._id)}
                  onClick={() =>
                    patch({
                      tags: draft.tags.includes(tag._id)
                        ? draft.tags.filter((x) => x !== tag._id)
                        : [...draft.tags, tag._id],
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <Button
          variant="gradient"
          className="w-full"
          disabled={saving}
          onClick={() => void submit()}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : t("save")}
        </Button>
      </div>

      {duplicates && (
        <DuplicatesSheet
          duplicates={duplicates}
          busy={saving}
          onMerge={(c) => void mergeInto(c)}
          onKeepBoth={() => {
            setDuplicates(null);
            void submit(true);
          }}
          onClose={() => setDuplicates(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
      />
      {hint && <p className="mt-1 px-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ListSection({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[13px] font-semibold text-foreground">{title}</p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {children}
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted"
        >
          <Plus className="size-4" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function EntryRow({
  label,
  labels,
  labelKey,
  value,
  placeholder,
  inputMode,
  onLabel,
  onValue,
  onRemove,
}: {
  label: string;
  labels: readonly string[];
  labelKey: (l: string) => string;
  value: string;
  placeholder: string;
  inputMode: "tel" | "email";
  onLabel: (label: string) => void;
  onValue: (value: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("contacts");
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
      <select
        value={label}
        onChange={(e) => onLabel(e.target.value)}
        className="h-9 shrink-0 rounded-lg border border-input bg-card px-1.5 text-xs text-foreground outline-none"
      >
        {labels.map((l) => (
          <option key={l} value={l}>
            {t(labelKey(l))}
          </option>
        ))}
      </select>
      <input
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        dir="ltr"
        className="h-9 w-full bg-transparent text-sm outline-none"
      />
      <button
        type="button"
        aria-label={t("delete")}
        onClick={onRemove}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-error"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Mobile `duplicate_candidates_sheet.dart` — the 409 is a QUESTION: merge
 * with this one / keep both / cancel. Merging never destroys anything.
 */
function DuplicatesSheet({
  duplicates,
  busy,
  onMerge,
  onKeepBoth,
  onClose,
}: {
  duplicates: Contact[];
  busy: boolean;
  onMerge: (c: Contact) => void;
  onKeepBoth: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("contacts");
  return (
    <BottomSheet title={t("mayAlreadyHave")} onClose={onClose}>
      <div className="space-y-3 pb-4">
        <p className="text-sm text-muted-foreground">{t("mergeExplainer")}</p>
        <div className="overflow-hidden rounded-xl border border-border">
          {duplicates.map((c) => (
            <div
              key={c._id}
              className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground" dir="auto">
                  {contactDisplayName(c) || t("unnamed")}
                </span>
                <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                  {c.phones?.[0]?.number ?? c.emails?.[0]?.address ?? ""}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onMerge(c)}
              >
                {t("mergeWithThis")}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("duplicateExplainer")}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={onKeepBoth}
          >
            {t("keepBoth")}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
