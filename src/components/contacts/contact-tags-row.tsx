"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Plus, Tag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  FC,
  createContactTag,
  listContactTags,
  readContactsError,
  type ContactTag,
} from "@/lib/api/contacts";
import {
  resolveGate,
  useContactsEntitlements,
} from "@/components/contacts/shared";
import { cn } from "@/lib/utils";

/**
 * Choosing tags BEFORE (or while) the contact exists — web port of mobile
 * `contact_tags_row.dart` (v2.4.0). One always-visible line, whatever the
 * plan says, so the form's footer never jumps between states:
 *
 * - loading: greyed "Tags" label, no action;
 * - entitlements UNKNOWN (fetch failed): "couldn't load your plan" + Retry —
 *   NEVER the upgrade sheet (a failed fetch is unknown, not locked);
 * - locked (`contacts_tags_enabled` off): lock icon + title + Upgrade, which
 *   opens the locked sheet — locked-not-hidden (§8);
 * - enabled: the selected tags as chips (or the "Tags" label when empty) and
 *   an "Add tags" action opening the picker.
 *
 * An id the catalogue can't resolve to a name (tag deleted elsewhere) is
 * counted as a trailing "+n", never shown as a raw id.
 */
export function ContactTagsRow({
  selected,
  onChange,
  seedTags = [],
  disabled = false,
  className,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Populated tag objects already on the contact — resolves chip names when
   *  the editor opens before the catalogue loads (mobile
   *  `ContactTagsCubit.remember`). */
  seedTags?: ContactTag[];
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const gate = resolveGate(ent, FC.tagsEnabled);
  const tagsQ = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);

  function shell({
    busy = false,
    locked = false,
    message,
    action,
    body,
  }: {
    busy?: boolean;
    locked?: boolean;
    message?: string;
    action?: React.ReactNode;
    body?: React.ReactNode;
  }) {
    const Icon = locked ? Lock : Tag;
    return (
      <div className={cn("flex min-h-9 items-center", className)}>
        <Icon className="size-[13px] shrink-0 text-muted-foreground" />
        <div className="ms-2.5 min-w-0 flex-1">
          {body ?? (
            <p
              className={cn(
                "truncate text-[13px]",
                busy ? "text-muted-foreground/60" : "text-muted-foreground",
              )}
            >
              {message ?? t("tags")}
            </p>
          )}
        </div>
        {action}
      </div>
    );
  }

  const actionClass =
    "ms-2 shrink-0 text-[13px] font-semibold text-primary hover:opacity-80 disabled:opacity-50";

  if (gate === "loading") return shell({ busy: true });

  if (gate === "unknown") {
    return shell({
      message: t("planUnknownFeature"),
      action: (
        <button
          type="button"
          className={actionClass}
          onClick={() => void ent.refetch()}
        >
          {t("retry")}
        </button>
      ),
    });
  }

  if (gate === "locked") {
    return (
      <>
        {shell({
          locked: true,
          message: t("tagsLockedTitle"),
          action: (
            <button
              type="button"
              className={actionClass}
              onClick={() => setLockedOpen(true)}
            >
              {t("upgrade")}
            </button>
          ),
        })}
        {lockedOpen && (
          <TagsLockedSheet onClose={() => setLockedOpen(false)} />
        )}
      </>
    );
  }

  // Enabled — chips resolve against the catalogue plus the contact's own
  // populated tag objects.
  const byId = new Map<string, ContactTag>();
  for (const tag of seedTags) byId.set(tag._id, tag);
  for (const tag of tagsQ.data ?? []) byId.set(tag._id, tag);
  const known = selected
    .map((id) => byId.get(id))
    .filter((tag): tag is ContactTag => tag != null);
  const unresolved = selected.length - known.length;

  return (
    <>
      {shell({
        body:
          selected.length === 0 ? undefined : (
            <div className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {known.map((tag) => {
                const color = tag.color || "#8b8b94";
                return (
                  <span
                    key={tag._id}
                    className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      color,
                      backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                    }}
                  >
                    {tag.name}
                  </span>
                );
              })}
              {unresolved > 0 && (
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  +{unresolved}
                </span>
              )}
            </div>
          ),
        action: (
          <button
            type="button"
            className={actionClass}
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            {t("scanAddTags")}
          </button>
        ),
      })}
      {pickerOpen && (
        <TagPickerSheet
          initial={selected}
          onClose={() => setPickerOpen(false)}
          onDone={(ids) => {
            setPickerOpen(false);
            onChange(ids);
          }}
        />
      )}
    </>
  );
}

/** Mobile's locked sheet — `LockedFeaturePlaceholder` with the TAG icon. */
function TagsLockedSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("contacts");
  return (
    <BottomSheet onClose={onClose}>
      <div className="flex flex-col items-center px-2 pb-4 pt-2 text-center">
        <span className="brand-gradient flex size-12 items-center justify-center rounded-full text-white">
          <Tag className="size-5" />
        </span>
        <p className="mt-4 text-lg font-bold text-foreground">
          {t("tagsLockedTitle")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t("tagsLockedBody")}</p>
        <Link href="/upgrade" className="mt-5 w-full">
          <Button variant="gradient" className="w-full">
            {t("upgrade")}
          </Button>
        </Link>
      </div>
    </BottomSheet>
  );
}

/**
 * The one tag picker — web port of mobile `tag_picker_sheet.dart`: a
 * checklist of the account's tags plus create-on-type, and NOTHING else. It
 * assigns nothing and knows nothing about contacts, so it works before a
 * contact exists just as well as after. "Done" hands the chosen set back;
 * closing the sheet changes nothing.
 */
export function TagPickerSheet({
  initial,
  onDone,
  onClose,
}: {
  initial: string[];
  onDone: (ids: string[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("contacts");
  const queryClient = useQueryClient();
  const tagsQ = useQuery({ queryKey: ["contact-tags"], queryFn: listContactTags });
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: (tagName: string) => createContactTag(tagName),
    onSuccess: ({ tag }) => {
      // The server may answer alreadyExisted with the existing tag — either
      // way it belongs in the catalogue and in the selection.
      queryClient.setQueryData<ContactTag[]>(["contact-tags"], (prev) => {
        const list = prev ?? [];
        return list.some((x) => x._id === tag._id) ? list : [...list, tag];
      });
      setSelected((prev) => new Set(prev).add(tag._id));
      setName("");
      setError(null);
    },
    onError: (e) => {
      void readContactsError(e).then((err) => {
        if (err.code === "LIMIT_REACHED" && err.limit != null) {
          setError(t("tagLimitReached", { max: err.limit }));
        } else {
          setError(err.message || t("genericError"));
        }
      });
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed || createM.isPending) return;
    createM.mutate(trimmed);
  }

  const tags = tagsQ.data ?? [];

  return (
    <BottomSheet title={t("assignTagsTitle")} onClose={onClose}>
      <div className="space-y-4 pb-4">
        {tagsQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : tagsQ.isError ? (
          // Mobile tag_picker_sheet.dart: a failed catalogue fetch shows the
          // resolved error + Retry — never the "no tags yet" empty state.
          <div className="flex flex-col items-center gap-2 px-6 py-4">
            <p className="text-center text-sm text-muted-foreground">
              {(tagsQ.error instanceof Error && tagsQ.error.message) ||
                t("genericError")}
            </p>
            <button
              type="button"
              onClick={() => tagsQ.refetch()}
              className="text-sm font-semibold text-primary"
            >
              {t("retry")}
            </button>
          </div>
        ) : tags.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("assignTagsEmpty")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {tags.map((tag) => (
              <label
                key={tag._id}
                className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(tag._id)}
                  onChange={() => toggle(tag._id)}
                  className="size-4 accent-foreground"
                />
                <span
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color || "#8b8b94" }}
                />
                <span
                  className="min-w-0 flex-1 truncate text-sm text-foreground"
                  dir="auto"
                >
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Create-on-type — mobile's "New tag" entry, inline. */}
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder={t("tagNameHint")}
            dir="auto"
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!name.trim() || createM.isPending}
            onClick={create}
          >
            {createM.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="size-4" />
                {t("newTag")}
              </>
            )}
          </Button>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <Button
          variant="gradient"
          className="w-full"
          onClick={() => onDone([...selected])}
        >
          {t("done")}
        </Button>
      </div>
    </BottomSheet>
  );
}
