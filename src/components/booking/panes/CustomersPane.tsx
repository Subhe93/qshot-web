"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Search, Users, Loader2, MousePointer2, CalendarCheck, Banknote, MapPin, Clock, CalendarDays } from "lucide-react";
import {
  listCustomers,
  getCustomer,
  updateCustomer,
  idOf,
  type Customer,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StatusBadge, MasterDetail, PaneHeader, EmptyState, PaneLoading } from "../shared";
import type { BookingStatus } from "@/lib/api/booking";

function initials(name?: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function CustomersPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking.customers");
  const tc = useTranslations("common");
  const locale = useLocale();
  const detail = useBookingUi((s) => s.detail);
  const selectCustomer = useBookingUi((s) => s.selectCustomer);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booking-customers", profileId, search],
    queryFn: () => listCustomers({ profileId, search }),
  });
  const customers = data?.items ?? [];
  const selId = detail.type === "customer" ? detail.id : null;

  const list = (
    <div>
      <PaneHeader title={t("title")} />
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>
      {isLoading ? (
        <PaneLoading />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">{tc("genericError")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {tc("retry")}
          </Button>
        </div>
      ) : customers.length === 0 ? (
        <EmptyState icon={<Users className="size-10 opacity-40" />} text={t("empty")} />
      ) : (
        <div className="space-y-2 p-3">
          {customers.map((c) => {
            const inactive = c.isActive === false;
            return (
              <button
                key={idOf(c)}
                type="button"
                onClick={() => selectCustomer(c)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-start ${
                  selId === idOf(c) ? "border-primary" : "border-transparent hover:bg-muted/50"
                } ${inactive ? "opacity-60" : ""}`}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary/15 text-sm font-bold text-secondary">
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  {c.phone && <p className="truncate text-xs text-muted-foreground">{c.phone}</p>}
                  {c.createdAt && (
                    <p className="truncate text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(c.createdAt))}
                    </p>
                  )}
                </div>
                {inactive && <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const detailNode = selId ? (
    <CustomerDetail id={selId} profileId={profileId} />
  ) : (
    <EmptyState icon={<MousePointer2 className="size-10 opacity-40" />} text={t("selectHint")} />
  );

  return <MasterDetail list={list} detail={detailNode} hasDetail={!!selId} />;
}

function CustomerDetail({ id, profileId }: { id: string; profileId: string }) {
  const t = useTranslations("booking.customers");
  const tc = useTranslations("common");
  const tp = useTranslations("booking.providers");
  const locale = useLocale();
  const qc = useQueryClient();
  const clearDetail = useBookingUi((s) => s.clearDetail);

  const { data: c, isLoading } = useQuery({
    queryKey: ["booking-customer", id],
    queryFn: () => getCustomer(id),
  });

  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (c) {
      setPhone(c.phone ?? "");
      setNotes(c.notes ?? "");
    }
  }, [c]);

  const save = useMutation({
    mutationFn: () => updateCustomer(id, { phone, notes } as Partial<Customer>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-customer", id] });
      qc.invalidateQueries({ queryKey: ["booking-customers", profileId] });
    },
  });

  if (isLoading) return <PaneLoading />;
  if (!c) return <EmptyState text={t("empty")} />;
  const money = (n?: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
  const fmtDate = (s?: string) =>
    s ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(s)) : "";

  // Mobile computes these from the embedded bookings; fall back to API fields.
  const bookingCount = c.bookings ? c.bookings.length : c.totalBookings ?? 0;
  const spent = c.bookings
    ? c.bookings.reduce((sum, b) => sum + (b.totalAmount ?? 0), 0)
    : c.totalSpent;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
        <button type="button" onClick={clearDetail} className="md:hidden" aria-label="Back">
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <h2 className="flex-1 text-lg font-bold">{t("title")}</h2>
        <Button variant="gradient" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {tc("save")}
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Hero */}
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-secondary/15 bg-secondary/[0.06] p-5 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-secondary/15 text-xl font-bold text-secondary">
            {initials(c.name)}
          </span>
          <p className="text-lg font-bold">{c.name}</p>
          <p className="text-sm text-muted-foreground">{c.email}</p>
          {c.address && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {c.address}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
            {c.timezone && (
              <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1 text-xs text-secondary">
                <Clock className="size-3" />
                {c.timezone}
              </span>
            )}
            {c.createdAt && (
              <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1 text-xs text-secondary">
                <CalendarDays className="size-3" />
                {fmtDate(c.createdAt)}
              </span>
            )}
            {c.isActive && (
              <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1 text-xs text-secondary">
                {tp("active")}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-blue-500/[0.06] p-4">
            <CalendarCheck className="size-5 text-blue-600" />
            <p className="mt-2 text-xl font-extrabold text-blue-600">{bookingCount}</p>
            <p className="text-xs text-blue-600/70">{t("bookings")}</p>
          </div>
          <div className="rounded-2xl bg-green-500/[0.06] p-4">
            <Banknote className="size-5 text-green-600" />
            <p className="mt-2 text-xl font-extrabold text-green-600">{money(spent)}</p>
            <p className="text-xs text-green-600/70">{t("totalSpent")}</p>
          </div>
        </div>

        {/* Editable */}
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{tp("phone")}</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{tp("bio")}</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* History */}
        {(c.bookings ?? []).length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("history")}
            </p>
            {c.bookings!.map((b) => (
              <div key={b.bookingRef} className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">#{b.bookingRef}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(b.startTimeUTC || b.slotStart)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{money(b.totalAmount)}</span>
                  <StatusBadge status={b.status as BookingStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
