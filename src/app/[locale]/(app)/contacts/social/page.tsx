"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Check, Loader2, UserPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToggleSwitch } from "@/components/builder/editors/sheet-kit";
import {
  FC,
  addBack,
  blockUser,
  entBool,
  getSocialSettings,
  listAddedMe,
  listBlockedUsers,
  readContactsError,
  unblockUser,
  updateSocialSettings,
  type AddedMeItem,
} from "@/lib/api/contacts";
import { quickActionPref, type ContactQuickAction } from "@/lib/contacts-prefs";
import {
  LockedPlaceholder,
  useContactsEntitlements,
} from "@/components/contacts/shared";
import { cn } from "@/lib/utils";

/**
 * Privacy & notifications + the "who added me" list — web port of mobile
 * `contacts_social_settings_layout.dart` and `added_me_layout.dart`.
 *
 * Two contract points that must not drift (api-spec §6):
 *  - `allowAddedMeList` governs information about the USER that other people
 *    can see — surfaced with its full explanation, not a bare toggle.
 *  - Blocking stops notifications and hides the person from the list; it does
 *    NOT stop them saving the public profile, and the copy says so.
 */
export default function ContactsSocialPage() {
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const queryClient = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["contacts-social-settings"],
    queryFn: getSocialSettings,
  });
  const settings = settingsQ.data;

  const [error, setError] = useState<string | null>(null);
  const settingsM = useMutation({
    mutationFn: updateSocialSettings,
    onMutate: async (next) => {
      // Optimistic; a failure restores the server truth ("it was undone").
      const prev = queryClient.getQueryData(["contacts-social-settings"]);
      queryClient.setQueryData(["contacts-social-settings"], {
        ...(prev ?? {}),
        ...next,
      });
      return { prev };
    },
    onError: (_e, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["contacts-social-settings"], ctx.prev);
      setError(t("settingsSaveFailed"));
    },
    onSuccess: () => setError(null),
  });

  const addedMeAllowed = entBool(ent.data, FC.addedMe);

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
        <h1 className="text-2xl font-bold">{t("settingsTitle")}</h1>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </p>
      )}

      {/* Notifications */}
      <SectionCard title={t("notificationsSection")}>
        <SettingRow
          title={t("notifyWhenAdded")}
          control={
            <ToggleSwitch
              checked={settings?.addedYouNotifications ?? true}
              onChange={(v) => settingsM.mutate({ addedYouNotifications: v })}
            />
          }
        />
        <div className="border-t border-border px-3 py-2.5">
          <div className="flex gap-2">
            <ModeChip
              active={(settings?.addedYouMode ?? "instant") === "instant"}
              label={t("deliveryInstant")}
              onClick={() => settingsM.mutate({ addedYouMode: "instant" })}
            />
            <ModeChip
              active={settings?.addedYouMode === "digest"}
              label={t("deliveryDigest")}
              onClick={() => settingsM.mutate({ addedYouMode: "digest" })}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("deliverySubtitle")}</p>
        </div>
      </SectionCard>

      {/* Privacy */}
      <SectionCard title={t("privacySection")}>
        <SettingRow
          title={t("allowAddedMeTitle")}
          subtitle={t("allowAddedMeSubtitle")}
          control={
            <ToggleSwitch
              checked={settings?.allowAddedMeList ?? true}
              onChange={(v) => settingsM.mutate({ allowAddedMeList: v })}
            />
          }
        />
      </SectionCard>

      {/* Ease of use — the row's one-tap action (a DEVICE preference). */}
      <SectionCard title={t("easeOfUseSection")}>
        <QuickActionSetting />
      </SectionCard>

      {/* Who added me */}
      <SectionCard title={t("addedMeTitle")}>
        {addedMeAllowed ? (
          <AddedMeList />
        ) : (
          <div className="px-3 py-5">
            <LockedPlaceholder
              title={t("addedMeLockedTitle")}
              body={t("addedMeLockedBody")}
            />
          </div>
        )}
      </SectionCard>

      {/* Blocked */}
      <SectionCard title={t("blockedSection")}>
        <BlockedList />
      </SectionCard>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  title,
  subtitle,
  control,
}: {
  title: string;
  subtitle?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function ModeChip({
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
          : "border-border text-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function QuickActionSetting() {
  const t = useTranslations("contacts");
  const [value, setValue] = useState<ContactQuickAction>("call");
  useEffect(() => {
    const handle = setTimeout(() => setValue(quickActionPref.get()), 0);
    return () => clearTimeout(handle);
  }, []);
  function pick(next: ContactQuickAction) {
    setValue(next);
    quickActionPref.set(next);
  }
  return (
    <div className="px-3 py-2.5">
      <p className="text-sm font-medium text-foreground">{t("quickActionTitle")}</p>
      <div className="mt-2 flex gap-2">
        <ModeChip active={value === "call"} label={t("call")} onClick={() => pick("call")} />
        <ModeChip
          active={value === "whatsapp"}
          label={t("whatsapp")}
          onClick={() => pick("whatsapp")}
        />
        <ModeChip
          active={value === "email"}
          label={t("email")}
          onClick={() => pick("email")}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("quickActionFallback")}</p>
    </div>
  );
}

function AddedMeList() {
  const t = useTranslations("contacts");
  const queryClient = useQueryClient();
  const listQ = useQuery({
    queryKey: ["contacts-added-me"],
    queryFn: () => listAddedMe(1, 50),
  });
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const addBackM = useMutation({
    mutationFn: (item: AddedMeItem) => addBack(item.userId, crypto.randomUUID()),
    onSuccess: (res, item) => {
      setAdded((m) => ({ ...m, [item.userId]: true }));
      // notified:false ⇒ offer "share your card" instead of implying they know.
      setError(res.notified === false ? t("addBackNotNotified") : null);
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: async (e) => {
      const err = await readContactsError(e);
      setError(err.message || t("genericError"));
    },
  });

  const [blocking, setBlocking] = useState<{ userId: string; name: string } | null>(
    null,
  );
  const blockM = useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: () => {
      setBlocking(null);
      void queryClient.invalidateQueries({ queryKey: ["contacts-added-me"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts-blocked"] });
    },
  });

  const items = listQ.data?.items ?? [];
  if (listQ.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="px-3 py-5 text-center text-sm text-muted-foreground">
        {t("addedMeEmpty")}
      </p>
    );
  }
  return (
    <>
      {error && <p className="px-3 pt-2 text-xs text-muted-foreground">{error}</p>}
      {items.map((item) => {
        const name =
          item.profile?.displayName || item.profile?.name || t("unknownPerson");
        const inBook = item.alreadyInMyContacts || added[item.userId];
        return (
          <div
            key={item.userId}
            className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground" dir="auto">
                {name}
              </span>
            </span>
            {inBook ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check className="size-3.5" />
                {t("inYourContacts")}
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={addBackM.isPending}
                onClick={() => addBackM.mutate(item)}
              >
                <UserPlus className="size-4" />
                {t("addBack")}
              </Button>
            )}
            <button
              type="button"
              aria-label={t("blockAction")}
              onClick={() => setBlocking({ userId: item.userId, name })}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-error"
            >
              <Ban className="size-4" />
            </button>
          </div>
        );
      })}
      {/* Blocking stops notifications and the list entry; it does NOT stop
          them saving the public profile — the copy says both (api-spec §6.4). */}
      <ConfirmDialog
        open={blocking != null}
        type="danger"
        title={t("blockTitle", { name: blocking?.name ?? "" })}
        message={`${t("blockStops")} ${t("blockDoesNotStop")}`}
        confirmText={t("blockAction")}
        cancelText={t("cancel")}
        onConfirm={() => blocking && blockM.mutate(blocking.userId)}
        onCancel={() => setBlocking(null)}
      />
    </>
  );
}

function BlockedList() {
  const t = useTranslations("contacts");
  const queryClient = useQueryClient();
  const listQ = useQuery({
    queryKey: ["contacts-blocked"],
    queryFn: listBlockedUsers,
  });
  const [confirm, setConfirm] = useState<{ userId: string; name: string } | null>(
    null,
  );
  const unblockM = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => {
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: ["contacts-blocked"] });
    },
  });

  const items = listQ.data ?? [];
  if (items.length === 0) {
    return (
      <p className="px-3 py-5 text-center text-sm text-muted-foreground">
        {t("blockedEmpty")}
      </p>
    );
  }
  return (
    <>
      {items.map((b) => {
        const name = b.profile?.displayName || b.profile?.name || t("unknownPerson");
        return (
          <div
            key={b.userId}
            className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-foreground" dir="auto">
              {name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm({ userId: b.userId, name })}
            >
              {t("unblock")}
            </Button>
          </div>
        );
      })}
      <ConfirmDialog
        open={confirm != null}
        title={t("unblockTitle")}
        message={t("unblockMessage", { name: confirm?.name ?? "" })}
        confirmText={t("unblock")}
        cancelText={t("cancel")}
        onConfirm={() => confirm && unblockM.mutate(confirm.userId)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
