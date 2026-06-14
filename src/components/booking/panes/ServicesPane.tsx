"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Plus,
  Package,
  Loader2,
  Trash2,
  MousePointer2,
  FileText,
  Clock,
  Tag,
  Coins,
  Hourglass,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  listServices,
  createService,
  updateService,
  deleteService,
  idOf,
  type Service,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MasterDetail, PaneHeader, EmptyState, PaneLoading } from "../shared";
import { cn } from "@/lib/utils";

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const GAPS = [0, 5, 10, 15, 20, 30, 45, 60];
const CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "EGP", "SEK", "TRY", "KWD"];

function fmtDuration(m?: number) {
  if (!m) return "0 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function ServicesPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const detail = useBookingUi((s) => s.detail);
  const selectService = useBookingUi((s) => s.selectService);

  const { data, isLoading } = useQuery({
    queryKey: ["booking-services", profileId],
    queryFn: () => listServices(profileId),
  });
  const services = data ?? [];
  const editing = detail.type === "service";
  const selId = editing && detail.data ? idOf(detail.data) : editing ? "__new" : null;

  const list = (
    <div>
      <PaneHeader
        title={t("services.title")}
        action={
          <button
            type="button"
            onClick={() => selectService(null)}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-white"
            aria-label={t("services.new")}
          >
            <Plus className="size-5" />
          </button>
        }
      />
      {isLoading ? (
        <PaneLoading />
      ) : services.length === 0 ? (
        <EmptyState icon={<Package className="size-10 opacity-40" />} text={t("services.empty")} />
      ) : (
        <div className="space-y-2 p-3">
          {services.map((s) => (
            <button
              key={idOf(s)}
              type="button"
              onClick={() => selectService(s)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-start",
                selId === idOf(s) ? "border-primary" : "border-transparent hover:bg-muted/50",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
                <Package className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.defaultPrice ?? 0} {s.currency ?? ""} · {fmtDuration(s.duration)}
                </p>
              </div>
              {s.isActive === false && <span className="size-2 rounded-full bg-muted-foreground/40" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const detailNode = editing ? (
    <ServiceEditor profileId={profileId} service={detail.data} />
  ) : (
    <EmptyState icon={<MousePointer2 className="size-10 opacity-40" />} text={t("services.selectHint")} />
  );

  return <MasterDetail list={list} detail={detailNode} hasDetail={editing} />;
}

const BLANK: Service = {
  name: "",
  description: "",
  duration: 30,
  defaultPrice: 0,
  currency: "USD",
  isActive: true,
  gapBefore: 0,
  gapAfter: 0,
};

function ServiceEditor({ profileId, service }: { profileId: string; service: Service | null }) {
  const t = useTranslations("booking.services");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const { clearDetail } = useBookingUi.getState();

  const [draft, setDraft] = useState<Service>(service ?? BLANK);
  const [sheet, setSheet] = useState<null | "duration" | "currency" | "gapBefore" | "gapAfter">(null);
  useEffect(() => setDraft(service ?? BLANK), [service]);

  const id = service ? idOf(service) : null;
  const set = (p: Partial<Service>) => setDraft((d) => ({ ...d, ...p }));

  const save = useMutation({
    mutationFn: () => (id ? updateService(id, draft) : createService(profileId, draft)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-services", profileId] });
      clearDetail();
    },
  });
  const del = useMutation({
    mutationFn: () => deleteService(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking-services", profileId] });
      clearDetail();
    },
  });

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

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
        {/* 1 column on mobile, 2 columns on desktop for a roomier UX. */}
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {/* Name — full width */}
          <div className="lg:col-span-2">
            <FieldRow icon={<Package className="size-4" />} color="#7c3aed" label={t("name")}>
              <input
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                className="w-full bg-transparent text-end text-sm font-medium outline-none"
              />
            </FieldRow>
          </div>

          {/* Description — full width */}
          <div className="rounded-xl border border-input bg-card p-3 lg:col-span-2">
            <div className="mb-2 flex items-center gap-2">
              <IconBox icon={<FileText className="size-4" />} color="#818490" />
              <span className="text-sm font-medium">{t("description")}</span>
            </div>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              className="border-0 bg-muted/40 p-2"
            />
          </div>

          {/* Duration | Price */}
          <PickerRow
            icon={<Clock className="size-4" />}
            color="#3b82f6"
            label={t("duration")}
            value={fmtDuration(draft.duration)}
            onClick={() => setSheet("duration")}
          />
          <FieldRow icon={<Tag className="size-4" />} color="#34c360" label={t("price")}>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.defaultPrice ?? 0}
              onChange={(e) => set({ defaultPrice: Number(e.target.value) })}
              className="w-full bg-transparent text-end text-sm font-semibold outline-none"
            />
          </FieldRow>

          {/* Gap before | Gap after */}
          <PickerRow
            icon={<Hourglass className="size-4" />}
            color="#ff9500"
            label={t("gapBefore")}
            value={`${draft.gapBefore ?? 0} min`}
            onClick={() => setSheet("gapBefore")}
          />
          <PickerRow
            icon={<Hourglass className="size-4 rotate-180" />}
            color="#ff9500"
            label={t("gapAfter")}
            value={`${draft.gapAfter ?? 0} min`}
            onClick={() => setSheet("gapAfter")}
          />

          {/* Currency — full width */}
          <div className="lg:col-span-2">
            <PickerRow
              icon={<Coins className="size-4" />}
              color="#d97706"
              label={t("currency")}
              value={draft.currency ?? "USD"}
              onClick={() => setSheet("currency")}
            />
          </div>

          {/* Active — full width */}
          <div className="flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2.5 lg:col-span-2">
            <span className="text-sm font-medium">{t("active")}</span>
            <Switch on={draft.isActive ?? true} onToggle={() => set({ isActive: !(draft.isActive ?? true) })} />
          </div>
        </div>

        {save.isError && (
          <p className="text-center text-sm text-error">{tc("genericError")}</p>
        )}
      </div>

      <div className="border-t border-border bg-card p-3">
        <div className="mx-auto max-w-lg">
          <Button
            variant="gradient"
            className="w-full"
            disabled={!draft.name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {tc("save")}
          </Button>
        </div>
      </div>

      {/* Option sheets */}
      {sheet === "duration" && (
        <OptionSheet
          title={t("duration")}
          options={DURATIONS.map((d) => ({ value: d, label: fmtDuration(d) }))}
          selected={draft.duration ?? 30}
          onSelect={(v) => set({ duration: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "currency" && (
        <OptionSheet
          title={t("currency")}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          selected={draft.currency ?? "USD"}
          onSelect={(v) => set({ currency: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {(sheet === "gapBefore" || sheet === "gapAfter") && (
        <OptionSheet
          title={t(sheet)}
          options={GAPS.map((g) => ({ value: g, label: `${g} min` }))}
          selected={(sheet === "gapBefore" ? draft.gapBefore : draft.gapAfter) ?? 0}
          onSelect={(v) => set(sheet === "gapBefore" ? { gapBefore: v } : { gapAfter: v })}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ── Reusable rows ──────────────────────────────────────────────
function IconBox({ icon, color }: { icon: React.ReactNode; color: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {icon}
    </span>
  );
}

function FieldRow({
  icon,
  color,
  label,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-input bg-card px-3 py-2.5">
      <IconBox icon={icon} color={color} />
      <span className="shrink-0 text-sm font-medium">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function PickerRow({
  icon,
  color,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-input bg-card px-3 py-2.5 text-start"
    >
      <IconBox icon={icon} color={color} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-sm font-semibold text-muted-foreground">{value}</span>
      <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
    </button>
  );
}

function OptionSheet<T extends string | number>({
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  title: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="space-y-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => {
              onSelect(o.value);
              onClose();
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-3 py-3 text-start text-sm",
              o.value === selected ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted",
            )}
          >
            {o.label}
            {o.value === selected && <Check className="size-4" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

export function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-success" : "bg-input")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", on ? "start-[1.375rem]" : "start-0.5")} />
    </button>
  );
}
