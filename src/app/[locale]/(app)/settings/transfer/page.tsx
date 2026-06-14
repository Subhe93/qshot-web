"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  User,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  acceptTransferIn,
  deleteTransferOut,
  getTransferIn,
  getTransferOut,
  rejectTransferIn,
  type TransferProfile,
} from "@/lib/api/transfers";
import { getAccount } from "@/lib/api/account";
import { cdnUrl } from "@/lib/api/qrcodes";

type Tab = "in" | "out";

export default function TransferPage() {
  const t = useTranslations("settings.transferPage");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("in");
  const [copied, setCopied] = useState(false);

  const { data: account } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
  });
  const accountId = account?.user?._id ?? "";

  const inQuery = useQuery({ queryKey: ["transfer-in"], queryFn: getTransferIn });
  const outQuery = useQuery({
    queryKey: ["transfer-out"],
    queryFn: getTransferOut,
  });

  const acceptM = useMutation({
    mutationFn: (id: string) => acceptTransferIn(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transfer-in"] }),
  });
  const rejectM = useMutation({
    mutationFn: (id: string) => rejectTransferIn(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transfer-in"] }),
  });
  const cancelM = useMutation({
    mutationFn: (id: string) => deleteTransferOut(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["transfer-out"] }),
  });

  function copyId() {
    if (!accountId) return;
    navigator.clipboard?.writeText(accountId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const query = tab === "in" ? inQuery : outQuery;
  const items = query.data ?? [];
  const busy = acceptM.isPending || rejectM.isPending || cancelM.isPending;

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Your account ID */}
      <div className="mt-6">
        <label className="mb-1.5 block text-xs text-muted-foreground">
          {t("accountId")}
        </label>
        <div className="flex h-11 items-center rounded-[10px] border border-input bg-white pe-2 ps-3">
          <span className="flex-1 truncate font-mono text-sm text-foreground">
            {accountId || "—"}
          </span>
          <button
            type="button"
            onClick={copyId}
            className="brand-gradient-text flex items-center gap-1 text-sm font-semibold"
          >
            {copied ? (
              <>
                <Check className="size-4 text-primary" /> {t("copied")}
              </>
            ) : (
              <>
                <Copy className="size-4 text-primary" /> {t("share")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-border p-1">
        <TabButton
          active={tab === "in"}
          onClick={() => setTab("in")}
          icon={<ArrowDownLeft className="size-4" />}
          label={t("incoming")}
        />
        <TabButton
          active={tab === "out"}
          onClick={() => setTab("out")}
          icon={<ArrowUpRight className="size-4" />}
          label={t("outgoing")}
        />
      </div>

      {/* List */}
      <div className="mt-5">
        {query.isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[90px] animate-pulse rounded-[10px] border border-border bg-muted"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="font-bold text-foreground">{t("empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "in" ? t("noIncoming") : t("noOutgoing")}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <TransferTile
                key={item._id}
                item={item}
                date={dateFmt.format(new Date(item.createdAt))}
                busy={busy}
                actions={
                  tab === "in" ? (
                    <>
                      <ActionButton
                        variant="accept"
                        label={t("accept")}
                        icon={<Check className="size-4" />}
                        onClick={() => acceptM.mutate(item._id)}
                      />
                      <ActionButton
                        variant="reject"
                        label={t("reject")}
                        icon={<X className="size-4" />}
                        onClick={() => rejectM.mutate(item._id)}
                      />
                    </>
                  ) : (
                    <ActionButton
                      variant="reject"
                      label={t("cancel")}
                      icon={<X className="size-4" />}
                      onClick={() => cancelM.mutate(item._id)}
                    />
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TransferTile({
  item,
  date,
  actions,
  busy,
}: {
  item: TransferProfile;
  date: string;
  actions: React.ReactNode;
  busy: boolean;
}) {
  const image = item.userProfileTemplate.info.image
    ? cdnUrl(item.userProfileTemplate.info.image)
    : null;
  return (
    <div className="rounded-[10px] border border-border p-3">
      <div className="flex gap-3">
        <div className="brand-gradient size-12 shrink-0 rounded-full p-[2px]">
          <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-white">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="size-full object-cover" />
            ) : (
              <User className="size-5 text-black/20" />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-foreground">
              {item.userProfileTemplate.info.username}
            </span>
            {item.sourceUser && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {item.sourceUser.name}
              </span>
            )}
          </div>
          {item.userProfileTemplate.info.bio && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {item.userProfileTemplate.info.bio}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{date}</p>
        </div>
      </div>
      <div
        className={`mt-3 flex gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {actions}
      </div>
    </div>
  );
}

function ActionButton({
  variant,
  label,
  icon,
  onClick,
}: {
  variant: "accept" | "reject";
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
        variant === "accept"
          ? "bg-foreground text-background hover:opacity-90"
          : "border border-border text-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
