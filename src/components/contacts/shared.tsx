"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Lock, Loader2, RefreshCw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  FC,
  entBool,
  getContactsEntitlements,
  contactDisplayName,
  type Contact,
  type ContactTag,
  type ContactsEntitlements,
} from "@/lib/api/contacts";
import { cdnUrl } from "@/lib/api/qrcodes";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for the contacts feature — the web mirror of mobile's
 * `contact_avatar.dart`, `locked_feature_placeholder.dart` and the
 * entitlements gate (`ContactsGate`: enabled / locked / UNKNOWN — a failed
 * plan fetch greys the feature with "couldn't load your plan", it never shows
 * an upgrade prompt).
 */

// ─── Entitlements gate ──────────────────────────────────────────────────────

export function useContactsEntitlements() {
  return useQuery({
    queryKey: ["contacts-entitlements"],
    queryFn: getContactsEntitlements,
    staleTime: 60_000,
  });
}

export type ContactsGate = "enabled" | "locked" | "unknown" | "loading";

export function resolveGate(
  q: { data?: ContactsEntitlements; isError: boolean; isLoading: boolean },
  code: string = FC.enabled,
): ContactsGate {
  if (q.isLoading) return "loading";
  if (q.isError || !q.data) return "unknown";
  return entBool(q.data, code) ? "enabled" : "locked";
}

/** Locked / unknown / loading states, full-page. Children render when enabled. */
export function GateBoundary({
  gate,
  lockedTitle,
  lockedBody,
  onRetry,
  children,
}: {
  gate: ContactsGate;
  lockedTitle: string;
  lockedBody: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("contacts");
  if (gate === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (gate === "unknown") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-bold text-foreground">{t("planLoadFailed")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("planUnknownFeature")}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        )}
      </div>
    );
  }
  if (gate === "locked") {
    return <LockedPlaceholder title={lockedTitle} body={lockedBody} />;
  }
  return <>{children}</>;
}

/** Mobile `locked_feature_placeholder.dart` — lock chip, copy, upgrade. */
export function LockedPlaceholder({ title, body }: { title: string; body: string }) {
  const t = useTranslations("contacts");
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="brand-gradient mx-auto mb-5 flex size-12 items-center justify-center rounded-full text-white">
        <Lock className="size-5" />
      </span>
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {/* Was /settings (a dead end) — the plan comparison page now exists. */}
      <Link href="/upgrade">
        <Button variant="gradient" className="mt-5">
          {t("upgrade")}
        </Button>
      </Link>
    </div>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

/** Deterministic hue from the contact id — stable initials disc. */
function hue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function ContactAvatar({
  contact,
  size = 44,
}: {
  contact: Contact;
  size?: number;
}) {
  const name = contactDisplayName(contact);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const avatar = (contact.avatarUrl ?? "").trim();
  const h = hue(contact._id ?? name);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: avatar ? undefined : `hsl(${h} 55% 55%)`,
      }}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={/^https?:\/\//.test(avatar) ? avatar : cdnUrl(avatar)}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        initials || "•"
      )}
    </span>
  );
}

// ─── Tag chip ───────────────────────────────────────────────────────────────

export function TagChip({
  tag,
  active,
  onClick,
}: {
  tag: ContactTag;
  active?: boolean;
  onClick?: () => void;
}) {
  const color = tag.color || "#8b8b94";
  const body = (
    <>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{tag.name}</span>
    </>
  );
  const className = cn(
    "inline-flex max-w-40 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
    active
      ? "border-transparent bg-foreground text-background"
      : "border-border bg-card text-foreground",
    onClick && "cursor-pointer hover:bg-muted",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  ) : (
    <span className={className}>{body}</span>
  );
}

// ─── Source label key ───────────────────────────────────────────────────────

export const SOURCE_LABEL_KEY: Record<string, string> = {
  manual: "sourceManual",
  qr_scan: "sourceQrScan",
  card_scan: "sourceCardScan",
  lead_form: "sourceLeadForm",
  booking: "sourceBooking",
};

export const PHONE_LABEL_KEY: Record<string, string> = {
  mobile: "phoneLabelMobile",
  mobile2: "phoneLabelMobile",
  landline: "phoneLabelHome",
  work: "phoneLabelWork",
  fax: "phoneLabelFax",
  whatsapp: "whatsapp",
  other: "phoneLabelOther",
};

export const EMAIL_LABEL_KEY: Record<string, string> = {
  personal: "emailLabelPersonal",
  work: "emailLabelWork",
  other: "emailLabelOther",
};
