"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FC,
  createContactTag,
  deleteContactTag,
  entLimit,
  listContactTags,
  readContactsError,
  updateContactTag,
  type ContactTag,
} from "@/lib/api/contacts";
import {
  GateBoundary,
  resolveGate,
  useContactsEntitlements,
} from "@/components/contacts/shared";
import { cn } from "@/lib/utils";

/** Preset tag colors — the palette mobile's tag editor offers. */
const TAG_COLORS = [
  "#22aa55",
  "#2f80ed",
  "#9b51e0",
  "#eb5757",
  "#f2994a",
  "#f2c94c",
  "#00b8d9",
  "#8b8b94",
];

/**
 * Tags management — web port of mobile `contact_tags_layout.dart` +
 * `tag_editor_sheet.dart`. Gated by `contacts_tags_enabled` with
 * `contacts_tags_max` as the ceiling; deleting a tag detaches it from every
 * contact first (api-spec §5), which the confirm copy says plainly.
 */
export default function ContactTagsPage() {
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const gate = resolveGate(ent, FC.tagsEnabled);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/contacts"
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label={t("close")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("tagsTitle")}</h1>
          <p className="text-xs text-muted-foreground">{t("tagsSubtitle")}</p>
        </div>
      </div>

      <div className="mt-5">
        <GateBoundary
          gate={gate}
          lockedTitle={t("tagsLockedTitle")}
          lockedBody={t("tagsLockedBody")}
          onRetry={() => void ent.refetch()}
        >
          <TagsList />
        </GateBoundary>
      </div>
    </div>
  );
}

function TagsList() {
  const t = useTranslations("contacts");
  const queryClient = useQueryClient();
  const ent = useContactsEntitlements();
  const tagsQ = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });

  const [editing, setEditing] = useState<ContactTag | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContactTag | null>(null);

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteContactTag(id),
    onSuccess: () => {
      setConfirmDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const tags = tagsQ.data ?? [];
  const max = entLimit(ent.data, FC.tagsMax);
  const atLimit = max != null && tags.length >= max;

  return (
    <>
      <div className="flex items-center justify-between">
        {max != null ? (
          <p className="text-xs text-muted-foreground">
            {t("tagCounter", { count: tags.length, max })}
          </p>
        ) : (
          <span />
        )}
        <Button
          variant="gradient"
          size="sm"
          disabled={atLimit}
          onClick={() => setEditing("new")}
        >
          <Plus className="size-4" />
          {t("createTag")}
        </Button>
      </div>
      {atLimit && (
        <p className="mt-2 text-xs text-error">{t("tagLimitReached", { max })}</p>
      )}

      <div className="mt-4">
        {tagsQ.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : tags.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-bold text-foreground">{t("tagsEmptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("tagsEmptyBody")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {tags.map((tag) => (
              <div
                key={tag._id}
                className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color || "#8b8b94" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" dir="auto">
                  {tag.name}
                </span>
                <button
                  type="button"
                  aria-label={t("editTag")}
                  onClick={() => setEditing(tag)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={t("delete")}
                  onClick={() => setConfirmDelete(tag)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-error"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <TagEditorSheet
          tag={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete != null}
        type="danger"
        title={t("deleteTagTitle")}
        message={t("deleteTagMessage", { name: confirmDelete?.name ?? "" })}
        confirmText={t("deleteTagConfirm")}
        cancelText={t("cancel")}
        onConfirm={() => confirmDelete && deleteM.mutate(confirmDelete._id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function TagEditorSheet({
  tag,
  onClose,
}: {
  tag: ContactTag | null;
  onClose: () => void;
}) {
  const t = useTranslations("contacts");
  const queryClient = useQueryClient();
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color || TAG_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const clean = name.trim();
    if (!clean) {
      setError(t("tagNameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (tag) await updateContactTag(tag._id, { name: clean, color });
      else await createContactTag(clean, color);
      void queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      onClose();
    } catch (e) {
      const err = await readContactsError(e);
      // Renaming onto an existing name returns 409 (api-spec §5).
      setError(err.status === 409 ? t("tagNameTaken") : t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet title={tag ? t("editTag") : t("newTag")} onClose={onClose}>
      <div className="space-y-4 pb-4">
        <div>
          <label className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground">
            {t("tagName")}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("tagNameHint")}
            dir="auto"
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
          />
        </div>
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-semibold text-foreground">
            {t("tagColor")}
          </p>
          <div className="flex flex-wrap gap-2">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-8 rounded-full border-2",
                  color === c ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <Button variant="gradient" className="w-full" disabled={busy} onClick={save}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : t("save")}
        </Button>
      </div>
    </BottomSheet>
  );
}
