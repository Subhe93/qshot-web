"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  CreditCard,
  Globe,
  Info,
  Loader2,
  Megaphone,
  ShieldCheck,
  User,
  UserRoundCog,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlanCards } from "@/components/admin/plan-cards";
import {
  AdminShell,
  AdminHeader,
  AdminGrid,
  AdminCard,
} from "@/components/admin/admin-ui";
import {
  DomainsSheet,
  DuplicateSheet,
  MoveSheet,
  VerifyConfirmDialog,
} from "@/components/admin/profile-action-sheets";
import { apiErrorMessage } from "@/lib/api/client";
import { cdnUrl } from "@/lib/api/qrcodes";
import {
  activateCompany,
  getProfile,
  setProfileBannerMode,
  type AdminProfile,
  type BannerMode,
  type ProfileSettings,
} from "@/lib/api/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminProfilePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: rawName } = use(params);
  const name = decodeURIComponent(rawName);

  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["admin", "profile", name],
    queryFn: () => getProfile(name),
  });

  // Which capability sheet is open.
  const [sheet, setSheet] = useState<
    | null
    | "domains"
    | "duplicate"
    | "move"
    | "subscription"
    | "company"
    | "banner"
  >(null);

  // Mobile settings are NESTED objects, not flat strings.
  const settings: ProfileSettings | undefined = profile?.settings;
  const displayName = settings?.name?.text ?? profile?.name;
  const avatar = cdnUrl(settings?.profile_picture?.image_url);

  return (
    <AdminShell>
      <AdminHeader
        title={t("title")}
        description={profile ? `@${profile.name}` : undefined}
        backHref="/admin"
        Icon={UserRoundCog}
      />

      {isLoading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (isError || !profile) && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t("profile.notFound")}
        </p>
      )}

      {profile && (
        <>
          {/* Profile header card */}
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] sm:p-5">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="size-full object-cover" />
              ) : (
                <User className="size-7 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-lg font-bold text-foreground sm:text-xl">
                  {displayName}
                </span>
                {profile.verified && (
                  <BadgeCheck className="size-5 shrink-0 text-primary" />
                )}
              </div>
              <span className="block truncate text-sm text-muted-foreground">
                @{profile.name}
              </span>
              {profile.verified && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <ShieldCheck className="size-3" />
                  {t("verified")}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <AdminGrid cols={2}>
            <AdminCard
              Icon={Info}
              title={t("profile.editTitle")}
              description={t("actions.info.desc")}
              onClick={() =>
                router.push(
                  `/admin/profiles/${encodeURIComponent(name)}/edit?pid=${encodeURIComponent(profile.id)}`,
                )
              }
            />
            <VerifyCard profile={profile} name={name} />
            <AdminCard
              Icon={Globe}
              title={t("extDomains.title")}
              description={t("actions.domains.desc")}
              accent="#34c759"
              onClick={() => setSheet("domains")}
            />
            <AdminCard
              Icon={Copy}
              title={t("duplicate.title")}
              description={t("actions.duplicate.desc")}
              accent="#4488ff"
              onClick={() => setSheet("duplicate")}
            />
            <AdminCard
              Icon={UserRoundCog}
              title={t("move.title")}
              description={t("actions.move.desc")}
              danger
              onClick={() => setSheet("move")}
            />
            <AdminCard
              Icon={CreditCard}
              title={t("plans.title")}
              description={t("actions.subscription.desc")}
              accent="#ff9500"
              onClick={() => setSheet("subscription")}
            />
            <AdminCard
              Icon={Building2}
              title={t("company.title")}
              description={t("actions.company.desc")}
              accent="#5856d6"
              onClick={() => setSheet("company")}
            />
            <AdminCard
              Icon={Megaphone}
              title={t("banner.title")}
              description={t("banner.desc")}
              accent="#c389ff"
              onClick={() => setSheet("banner")}
            />
          </AdminGrid>

          {sheet === "domains" && (
            <DomainsSheet
              profileId={profile.id}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "duplicate" && (
            <DuplicateSheet
              profileId={profile.id}
              profileName={profile.name}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "move" && (
            <MoveSheet
              profileName={profile.name}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "subscription" && (
            <SubscriptionSheet onClose={() => setSheet(null)} />
          )}
          {sheet === "company" && (
            <CompanySheet onClose={() => setSheet(null)} />
          )}
          {sheet === "banner" && (
            <BannerSheet
              profile={profile}
              queryName={name}
              onClose={() => setSheet(null)}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}

// ─── (b) Verify toggle card ───────────────────────────────────────────────────

function VerifyCard({ profile, name }: { profile: AdminProfile; name: string }) {
  const t = useTranslations("admin");
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <AdminCard
        Icon={ShieldCheck}
        title={profile.verified ? t("unverify") : t("verify")}
        description={t("actions.verify.desc")}
        accent={profile.verified ? undefined : "#ff9500"}
        danger={profile.verified}
        onClick={() => setConfirm(true)}
      />
      <VerifyConfirmDialog
        open={confirm}
        profileName={name}
        verified={profile.verified}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}

// ─── (f) Subscription — mobile-style plan cards + assign ──────────────────────

function SubscriptionSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin");
  return (
    <BottomSheet title={t("plans.title")} onClose={onClose}>
      <PlanCards single />
    </BottomSheet>
  );
}

// ─── Promo-banner mode (PATCH dashboard/profile/banner) ───────────────────────

const BANNER_MODES: BannerMode[] = ["auto", "always", "never"];

function BannerSheet({
  profile,
  queryName,
  onClose,
}: {
  profile: AdminProfile;
  queryName: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();
  // Absent field on older rows = "auto" (backend default).
  const current: BannerMode = profile.bannerMode ?? "auto";
  const [status, setStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (mode: BannerMode) => setProfileBannerMode(profile.id, mode),
    onSuccess: () => {
      setStatus(t("banner.done"));
      queryClient.invalidateQueries({
        queryKey: ["admin", "profile", queryName],
      });
    },
    onError: async (e) => {
      setStatus(await apiErrorMessage(e, t("search.error")));
    },
  });

  return (
    <BottomSheet title={t("banner.title")} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("banner.sheetDesc")}</p>
        {BANNER_MODES.map((mode) => {
          const active = current === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                setStatus(null);
                mutation.mutate(mode);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-start transition-colors ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground">
                  {t(`banner.${mode}`)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`banner.${mode}Desc`)}
                </span>
              </span>
              {mutation.isPending && mutation.variables === mode ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                active && <Check className="size-4 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
        {status && (
          <p className="text-center text-sm text-muted-foreground">{status}</p>
        )}
      </div>
    </BottomSheet>
  );
}

// ─── (g) Convert to company ───────────────────────────────────────────────────

function CompanySheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => activateCompany(email.trim()),
    onSuccess: () => {
      setConfirm(false);
      setStatus(t("company.done"));
    },
    onError: async (e) => {
      setConfirm(false);
      setStatus(await apiErrorMessage(e, t("search.error")));
    },
  });

  function onSubmit() {
    setStatus(null);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t("company.emailLabel"));
      return;
    }
    setEmailError(null);
    setConfirm(true);
  }

  return (
    <BottomSheet
      title={t("company.title")}
      onClose={onClose}
      footer={
        <div className="border-t border-border p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={mutation.isPending}
            onClick={onSubmit}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("company.title")
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("company.desc")}</p>
        <FancyField
          id="admin-company-email"
          type="email"
          label={t("company.emailLabel")}
          iconSrc="/brand/ic_gradient_email.svg"
          value={email}
          error={emailError ?? undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        {status && (
          <p className="text-center text-sm text-muted-foreground">{status}</p>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        type="warning"
        title={t("company.confirmTitle")}
        message={t("company.confirmMsg", { email: email.trim() })}
        confirmText={tc("create")}
        cancelText={tc("cancel")}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </BottomSheet>
  );
}
