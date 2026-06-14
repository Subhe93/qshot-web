"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { STATUS_META, type BookingStatus } from "@/lib/api/booking";
import { useIsBookingWide } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations("booking.status");
  const meta = STATUS_META[status] ?? STATUS_META.cancelled;
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
    >
      {t(meta.key)}
    </span>
  );
}

export function SectionCard({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-card shadow-[0_2px_12px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      {title && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {icon}
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
}

export function InfoRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value?: React.ReactNode;
  bold?: boolean;
  color?: string;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn("text-sm", bold ? "font-bold" : "font-medium")}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function EmptyState({
  icon,
  text,
}: {
  icon?: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function PaneLoading() {
  return (
    <div className="flex h-full min-h-48 items-center justify-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

/**
 * Master-detail layout: side-by-side on desktop (≥900px), single-pane on mobile
 * (detail replaces the list when an item is selected).
 */
export function MasterDetail({
  list,
  detail,
  hasDetail,
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  hasDetail: boolean;
}) {
  const wide = useIsBookingWide();
  if (wide) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="w-[360px] shrink-0 overflow-y-auto border-e border-border">
          {list}
        </div>
        <div className="flex-1 overflow-y-auto bg-muted/30">{detail}</div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto">{hasDetail ? detail : list}</div>
  );
}

export function PaneHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {action}
    </div>
  );
}
