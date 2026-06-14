"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Search, Users, Loader2, MousePointer2, CalendarCheck, Banknote } from "lucide-react";
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

export function CustomersPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking.customers");
  const detail = useBookingUi((s) => s.detail);
  const selectCustomer = useBookingUi((s) => s.selectCustomer);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
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
      ) : customers.length === 0 ? (
        <EmptyState icon={<Users className="size-10 opacity-40" />} text={t("empty")} />
      ) : (
        <div className="space-y-2 p-3">
          {customers.map((c) => (
            <button
              key={idOf(c)}
              type="button"
              onClick={() => selectCustomer(c)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-start ${
                selId === idOf(c) ? "border-primary" : "border-transparent hover:bg-muted/50"
              }`}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-secondary/15 text-sm font-bold text-secondary">
                {c.name?.slice(0, 1).toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.email}</p>
              </div>
            </button>
          ))}
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
            {c.name?.slice(0, 1).toUpperCase() ?? "?"}
          </span>
          <p className="text-lg font-bold">{c.name}</p>
          <p className="text-sm text-muted-foreground">{c.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-blue-500/[0.06] p-4">
            <CalendarCheck className="size-5 text-blue-600" />
            <p className="mt-2 text-xl font-extrabold text-blue-600">{c.totalBookings ?? 0}</p>
            <p className="text-xs text-blue-600/70">{t("bookings")}</p>
          </div>
          <div className="rounded-2xl bg-green-500/[0.06] p-4">
            <Banknote className="size-5 text-green-600" />
            <p className="mt-2 text-xl font-extrabold text-green-600">{money(c.totalSpent)}</p>
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
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{t("history")}</label>
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
                  <p className="text-xs text-muted-foreground">
                    {b.startTimeUTC || b.slotStart
                      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(b.startTimeUTC || b.slotStart!))
                      : ""}
                  </p>
                </div>
                <StatusBadge status={b.status as BookingStatus} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
