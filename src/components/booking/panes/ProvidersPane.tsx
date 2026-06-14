"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, Contact, Loader2, Trash2, MousePointer2 } from "lucide-react";
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  listServices,
  listProviderServices,
  linkProviderService,
  updateProviderService,
  unlinkProviderService,
  idOf,
  type Provider,
  type Service,
  type ProviderService,
  type WorkingHours,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MasterDetail, PaneHeader, EmptyState, PaneLoading } from "../shared";
import { Switch } from "./ServicesPane";

export function ProvidersPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const detail = useBookingUi((s) => s.detail);
  const selectProvider = useBookingUi((s) => s.selectProvider);

  const { data, isLoading } = useQuery({
    queryKey: ["booking-providers", profileId],
    queryFn: () => listProviders(profileId),
  });
  const providers = data ?? [];
  const editing = detail.type === "provider";
  const selId = editing && detail.data ? idOf(detail.data) : null;

  const list = (
    <div>
      <PaneHeader
        title={t("providers.title")}
        action={
          <button
            type="button"
            onClick={() => selectProvider(null)}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-white"
            aria-label={t("providers.new")}
          >
            <Plus className="size-5" />
          </button>
        }
      />
      {isLoading ? (
        <PaneLoading />
      ) : providers.length === 0 ? (
        <EmptyState icon={<Contact className="size-10 opacity-40" />} text={t("providers.empty")} />
      ) : (
        <div className="space-y-2 p-3">
          {providers.map((p) => (
            <button
              key={idOf(p)}
              type="button"
              onClick={() => selectProvider(p)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-start ${
                selId === idOf(p) ? "border-primary" : "border-transparent hover:bg-muted/50"
              }`}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-bold text-indigo-600">
                {p.name?.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.specialization ?? p.email ?? ""}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const detailNode = editing ? (
    <ProviderEditor profileId={profileId} provider={detail.data} />
  ) : (
    <EmptyState icon={<MousePointer2 className="size-10 opacity-40" />} text={t("providers.selectHint")} />
  );

  return <MasterDetail list={list} detail={detailNode} hasDetail={editing} />;
}

const DEFAULT_PROVIDER: Provider = {
  name: "",
  timezone: "UTC",
  slotGranularity: 15,
  isActive: true,
  workingHours: [],
};

function ProviderEditor({ profileId, provider }: { profileId: string; provider: Provider | null }) {
  const t = useTranslations("booking.providers");
  const tc = useTranslations("common");
  const td = useTranslations("booking.days");
  const qc = useQueryClient();
  const { selectProvider, clearDetail } = useBookingUi.getState();

  const [draft, setDraft] = useState<Provider>(provider ?? DEFAULT_PROVIDER);
  useEffect(() => setDraft(provider ?? DEFAULT_PROVIDER), [provider]);

  const id = provider ? idOf(provider) : null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["booking-providers", profileId] });
  const save = useMutation({
    mutationFn: () => (id ? updateProvider(id, draft) : createProvider(profileId, draft)),
    onSuccess: (saved) => {
      invalidate();
      selectProvider(saved);
    },
  });
  const del = useMutation({
    mutationFn: () => deleteProvider(id!),
    onSuccess: () => {
      invalidate();
      clearDetail();
    },
  });

  const set = (p: Partial<Provider>) => setDraft((d) => ({ ...d, ...p }));
  const hours = draft.workingHours ?? [];
  const dayOf = (d: number) => hours.find((h) => h.dayOfWeek === d);
  function toggleDay(d: number) {
    if (dayOf(d)) set({ workingHours: hours.filter((h) => h.dayOfWeek !== d) });
    else set({ workingHours: [...hours, { dayOfWeek: d, startTime: "09:00", endTime: "17:00" }] });
  }
  function setTime(d: number, field: "startTime" | "endTime", value: string) {
    set({ workingHours: hours.map((h) => (h.dayOfWeek === d ? { ...h, [field]: value } : h)) });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
        <button type="button" onClick={clearDetail} className="md:hidden" aria-label="Back">
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <h2 className="flex-1 text-lg font-bold">{id ? t("edit") : t("new")}</h2>
        {id && (
          <button type="button" onClick={() => del.mutate()} disabled={del.isPending} className="text-error" aria-label="Delete">
            {del.isPending ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <L label={t("name")}>
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label={t("email")}>
            <Input type="email" value={draft.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
          </L>
          <L label={t("phone")}>
            <Input value={draft.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
          </L>
          <L label={t("specialization")}>
            <Input value={draft.specialization ?? ""} onChange={(e) => set({ specialization: e.target.value })} />
          </L>
          <L label={t("timezone")}>
            <Input value={draft.timezone ?? "UTC"} onChange={(e) => set({ timezone: e.target.value })} />
          </L>
        </div>
        <L label={t("bio")}>
          <Textarea value={draft.bio ?? ""} onChange={(e) => set({ bio: e.target.value })} />
        </L>

        {/* Working hours */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("workingHours")}
          </h3>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const wh = dayOf(d);
              return (
                <div
                  key={d}
                  className={`flex items-center gap-2 rounded-xl border bg-card px-3 py-2 ${wh ? "border-indigo-500/30" : "border-border"}`}
                >
                  <span className={`w-10 text-sm font-semibold ${wh ? "text-indigo-600" : "text-muted-foreground"}`}>
                    {td(String(d))}
                  </span>
                  {wh ? (
                    <div className="flex flex-1 items-center gap-1.5">
                      <input
                        type="time"
                        value={wh.startTime}
                        onChange={(e) => setTime(d, "startTime", e.target.value)}
                        className="rounded-md border border-input bg-card px-2 py-1 text-sm"
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={wh.endTime}
                        onChange={(e) => setTime(d, "endTime", e.target.value)}
                        className="rounded-md border border-input bg-card px-2 py-1 text-sm"
                      />
                    </div>
                  ) : (
                    <span className="flex-1 text-sm text-muted-foreground">{t("dayOff")}</span>
                  )}
                  <Switch on={!!wh} onToggle={() => toggleDay(d)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Advanced scheduling limits (mobile provider editor) */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("advanced")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Num label={t("slotGranularity")} value={draft.slotGranularity} onChange={(v) => set({ slotGranularity: v })} />
            <Num label={t("dailyBookingLimit")} value={draft.dailyBookingLimit} onChange={(v) => set({ dailyBookingLimit: v })} />
            <Num label={t("dailyHoursLimit")} value={draft.dailyHoursLimit} onChange={(v) => set({ dailyHoursLimit: v })} />
            <Num label={t("forcedBreakAfterCount")} value={draft.forcedBreakAfterCount} onChange={(v) => set({ forcedBreakAfterCount: v })} />
            <Num label={t("forcedBreakDuration")} value={draft.forcedBreakDuration} onChange={(v) => set({ forcedBreakDuration: v })} />
          </div>
          <BlackoutDates
            dates={draft.blackoutDates ?? []}
            onChange={(dates) => set({ blackoutDates: dates })}
            t={t}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-soft">
          <span className="text-sm font-medium">{t("isDefault")}</span>
          <Switch on={!!draft.isDefault} onToggle={() => set({ isDefault: !draft.isDefault })} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-soft">
          <span className="text-sm font-medium">{t("active")}</span>
          <Switch on={draft.isActive ?? true} onToggle={() => set({ isActive: !(draft.isActive ?? true) })} />
        </div>

        {/* Services offered (provider↔service links) — only for a saved provider. */}
        {id ? (
          <ServicesOffered profileId={profileId} providerId={id} t={t} />
        ) : (
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("servicesAfterSave")}
          </p>
        )}
      </div>

      <div className="border-t border-border bg-card p-3">
        <Button variant="gradient" className="w-full" disabled={!draft.name.trim() || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <L label={label}>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </L>
  );
}

function BlackoutDates({
  dates,
  onChange,
  t,
}: {
  dates: string[];
  onChange: (d: string[]) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="mt-3">
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
        {t("blackoutDates")}
      </label>
      <Input
        type="date"
        onChange={(e) => {
          const v = e.target.value;
          if (v && !dates.includes(v)) onChange([...dates, v].sort());
          e.target.value = "";
        }}
      />
      {dates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <span
              key={d}
              className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {d}
              <button
                type="button"
                onClick={() => onChange(dates.filter((x) => x !== d))}
                aria-label="Remove"
                className="text-muted-foreground hover:text-error"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Services offered (provider↔service pivot) ───────────────────────────────
function ServicesOffered({
  profileId,
  providerId,
  t,
}: {
  profileId: string;
  providerId: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const qc = useQueryClient();
  const servicesQ = useQuery({
    queryKey: ["booking-services", profileId],
    queryFn: () => listServices(profileId),
  });
  const linksQ = useQuery({
    queryKey: ["provider-services", providerId],
    queryFn: () => listProviderServices({ providerId }),
  });
  const services = servicesQ.data ?? [];
  const links = linksQ.data ?? [];
  const linkOf = (sid: string) => links.find((l) => l.serviceId === sid);
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["provider-services", providerId] });

  const toggle = useMutation({
    mutationFn: async (svc: Service) => {
      const sid = idOf(svc);
      const link = linkOf(sid);
      if (link) await unlinkProviderService(idOf(link));
      else await linkProviderService({ providerId, serviceId: sid });
    },
    onSuccess: invalidate,
  });

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("servicesOffered")}
      </h3>
      {servicesQ.isLoading || linksQ.isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : services.length === 0 ? (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("noServices")}
        </p>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => {
            const sid = idOf(svc);
            const link = linkOf(sid);
            return (
              <ServiceRow
                key={sid}
                service={svc}
                link={link}
                onToggle={() => toggle.mutate(svc)}
                onOverride={invalidate}
                t={t}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  link,
  onToggle,
  onOverride,
  t,
}: {
  service: Service;
  link?: ProviderService;
  onToggle: () => void;
  onOverride: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const offered = !!link;
  const [price, setPrice] = useState(link?.price != null ? String(link.price) : "");
  const [duration, setDuration] = useState(link?.duration != null ? String(link.duration) : "");
  useEffect(() => {
    setPrice(link?.price != null ? String(link.price) : "");
    setDuration(link?.duration != null ? String(link.duration) : "");
  }, [link?.price, link?.duration]);

  async function saveOverride() {
    if (!link) return;
    const body = {
      price: price.trim() === "" ? null : Number(price),
      duration: duration.trim() === "" ? null : Number(duration),
    };
    if (body.price === link.price && body.duration === link.duration) return;
    await updateProviderService(idOf(link), body);
    onOverride();
  }

  return (
    <div
      className={`rounded-xl border bg-card p-3 ${offered ? "border-indigo-500/30" : "border-border"}`}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{service.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {(service.defaultPrice ?? 0)} {service.currency ?? ""} · {service.duration ?? 0}m
          </p>
        </div>
        <Switch on={offered} onToggle={onToggle} />
      </div>
      {offered && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input
            type="number"
            value={price}
            placeholder={`${t("priceOverride")} (${service.defaultPrice ?? 0})`}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={saveOverride}
          />
          <Input
            type="number"
            value={duration}
            placeholder={`${t("durationOverride")} (${service.duration ?? 0})`}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={saveOverride}
          />
        </div>
      )}
    </div>
  );
}
