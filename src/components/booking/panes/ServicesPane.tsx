"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft,
  Plus,
  Package,
  Folder,
  CornerDownRight,
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
  Pencil,
  Search,
} from "lucide-react";
import {
  listServices,
  createService,
  updateService,
  deleteService,
  listExtras,
  createExtra,
  updateExtra,
  deleteExtra,
  idOf,
  type Service,
  type Extra,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
          {services
            .filter((s) => !s.parentId)
            .map((parent) => {
              const kids = services.filter((s) => s.parentId === idOf(parent));
              const isCategory = !!parent.hasChildren || kids.length > 0;
              return (
                <div key={idOf(parent)} className="space-y-2">
                  <ServiceRow
                    service={parent}
                    isCategory={isCategory}
                    selected={selId === idOf(parent)}
                    onSelect={() => selectService(parent)}
                    onAddSub={() => selectService({ parentId: idOf(parent) } as Service)}
                    t={t}
                  />
                  {kids.map((kid) => (
                    <div key={idOf(kid)} className="ms-6">
                      <ServiceRow
                        service={kid}
                        isCategory={false}
                        selected={selId === idOf(kid)}
                        onSelect={() => selectService(kid)}
                        t={t}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
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

// A single service row — a Package leaf or a Folder category (with an
// add-sub-service action). Children render indented under their parent.
function ServiceRow({
  service: s,
  isCategory,
  selected,
  onSelect,
  onAddSub,
  t,
}: {
  service: Service;
  isCategory: boolean;
  selected: boolean;
  onSelect: () => void;
  onAddSub?: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const inactive = s.isActive === false;
  const hidden = s.isVisible === false;
  const free = (s.defaultPrice ?? 0) <= 0;
  return (
    <div
      className={cn(
        "flex items-center rounded-xl border-2 bg-card",
        selected ? "border-primary" : "border-transparent hover:bg-muted/50",
        (inactive || hidden) && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 p-3 text-start"
      >
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            isCategory ? "bg-amber-500/10 text-amber-600" : "bg-teal-500/10 text-teal-600",
          )}
        >
          {isCategory ? <Folder className="size-5" /> : <Package className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{s.name}</p>
            {hidden && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-amber-600">
                {t("services.hidden")}
              </span>
            )}
            {isCategory ? (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-amber-600">
                {t("services.category")}
              </span>
            ) : (
              free && (
                <span className="shrink-0 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-success">
                  {t("free")}
                </span>
              )
            )}
          </div>
          {!isCategory && (
            <p className="text-xs text-muted-foreground">
              {free ? t("free") : `${s.defaultPrice ?? 0} ${s.currency ?? ""}`} · {fmtDuration(s.duration)}
            </p>
          )}
          {s.description && (
            <p className="truncate text-xs text-muted-foreground/80">{s.description}</p>
          )}
        </div>
        {inactive && <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />}
      </button>
      {onAddSub && (
        <button
          type="button"
          onClick={onAddSub}
          aria-label={t("services.addSub")}
          className="me-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}

const BLANK: Service = {
  name: "",
  description: "",
  duration: 30,
  defaultPrice: 0,
  currency: "USD",
  isActive: true,
  isVisible: true,
  paymentEnabled: false,
  gapBefore: 0,
  gapAfter: 0,
};

function ServiceEditor({ profileId, service }: { profileId: string; service: Service | null }) {
  const t = useTranslations("booking.services");
  const tb = useTranslations("booking");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const { clearDetail } = useBookingUi.getState();

  // A passed service may be a real one (has _id) OR a fresh sub-service stub
  // ({ parentId }) — merge over BLANK so defaults are always present, and treat
  // anything without an _id as a create.
  const [draft, setDraft] = useState<Service>({ ...BLANK, ...(service ?? {}) });
  const [sheet, setSheet] = useState<null | "duration" | "currency" | "gapBefore" | "gapAfter">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setDraft({ ...BLANK, ...(service ?? {}) }), [service]);

  const id = service?._id ? idOf(service) : null;
  const set = (p: Partial<Service>) => setDraft((d) => ({ ...d, ...p }));
  const isFree = (draft.defaultPrice ?? 0) <= 0;

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
      setConfirmDelete(false);
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
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={del.isPending} className="text-error" aria-label="Delete">
            {del.isPending ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
        {/* Sub-service banner (mobile shows the parent when parentId is set). */}
        {draft.parentId && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary">
            <CornerDownRight className="size-4 shrink-0" />
            {t("subService")}
          </div>
        )}
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

          {/* Duration — full width on its own */}
          <div className="lg:col-span-2">
            <PickerRow
              icon={<Clock className="size-4" />}
              color="#3b82f6"
              label={t("duration")}
              value={fmtDuration(draft.duration)}
              onClick={() => setSheet("duration")}
            />
          </div>

          {/* Free toggle — full width (mobile setFree: price 0 ↔ 1). */}
          <div className="flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2.5 lg:col-span-2">
            <span className="text-sm font-medium">{tb("free")}</span>
            <Switch
              on={isFree}
              onToggle={() =>
                set({ defaultPrice: isFree ? 1 : 0, paymentEnabled: isFree ? draft.paymentEnabled : false })
              }
            />
          </div>

          {/* Price + Currency + Payment mode — only for a paid service. */}
          {!isFree && (
            <>
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
              <PickerRow
                icon={<Coins className="size-4" />}
                color="#d97706"
                label={t("currency")}
                value={draft.currency ?? "USD"}
                onClick={() => setSheet("currency")}
              />
              {/* Pay online vs pay on site (mobile paymentEnabled). */}
              <div className="flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2.5 lg:col-span-2">
                <span className="text-sm font-medium">
                  {draft.paymentEnabled ? tb("payOnline") : tb("payOnSite")}
                </span>
                <Switch
                  on={!!draft.paymentEnabled}
                  onToggle={() => set({ paymentEnabled: !draft.paymentEnabled })}
                />
              </div>
            </>
          )}

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

          {/* Active — full width */}
          <div className="flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2.5 lg:col-span-2">
            <span className="text-sm font-medium">{t("active")}</span>
            <Switch on={draft.isActive ?? true} onToggle={() => set({ isActive: !(draft.isActive ?? true) })} />
          </div>

          {/* Visible on booking site — full width, independent of Active. */}
          <div className="rounded-xl border border-input bg-card px-3 py-2.5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("visible")}</span>
              <Switch
                on={draft.isVisible ?? true}
                onToggle={() => set({ isVisible: !(draft.isVisible ?? true) })}
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t("visibleHint")}</p>
          </div>
        </div>

        {(save.isError || del.isError) && (
          <p className="text-center text-sm text-error">{tc("genericError")}</p>
        )}

        {/* Extras (add-ons) — only for a saved service (need its id). */}
        <div className="mt-5">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("extras")}
          </h3>
          {id ? (
            <ServiceExtras
              profileId={profileId}
              serviceId={id}
              currency={draft.currency ?? "USD"}
            />
          ) : (
            <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              {t("extrasAfterSave")}
            </p>
          )}
        </div>
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

      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={tc("delete")}
        message={tb("deleteConfirm")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => del.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
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
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const showSearch = options.length > 5;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q),
    );
  }, [query, options]);

  return (
    <BottomSheet title={title} onClose={onClose}>
      {showSearch && (
        <div className="mb-2">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tc("search")}
              className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}
      <div className="space-y-1">
        {filtered.map((o) => (
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

// ─── Extras (add-ons) for a service ──────────────────────────────────────────
// MONEY UNITS: extras use WHOLE units (e.g. 15 = $15.00), consistent with
// Service.defaultPrice and the booking total. (The integration guide labels them
// "cents", but the shared booking system — mobile, public flow, services — uses
// whole units, and a booking total = service + extras must share one unit.)

function ServiceExtras({
  profileId,
  serviceId,
  currency,
}: {
  profileId: string;
  serviceId: string;
  currency: string;
}) {
  const t = useTranslations("booking.services");
  const tb = useTranslations("booking");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Extra | "new" | null>(null);
  const [confirmDel, setConfirmDel] = useState<Extra | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["service-extras", serviceId],
    queryFn: () => listExtras({ profileId, serviceId }),
  });
  const extras = data ?? [];
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["service-extras", serviceId] });

  const del = useMutation({
    mutationFn: (id: string) => deleteExtra(id),
    onSuccess: () => {
      invalidate();
      setConfirmDel(null);
    },
  });
  const toggleActive = useMutation({
    mutationFn: (e: Extra) => updateExtra(idOf(e), { isActive: !(e.isActive ?? true) }),
    onSuccess: invalidate,
  });

  const money = (amount?: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount ?? 0);

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-muted-foreground">{t("extraHint")}</p>

      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : isError ? (
        <button type="button" onClick={() => refetch()} className="text-xs font-medium text-primary">
          {tc("retry")}
        </button>
      ) : extras.length === 0 ? (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">{t("noExtras")}</p>
      ) : (
        <div className="space-y-2">
          {extras.map((e) => {
            const inactive = e.isActive === false;
            const free = (e.price ?? 0) <= 0;
            return (
              <div
                key={idOf(e)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-input bg-card p-2.5",
                  inactive && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {free ? tb("free") : money(e.price)} · +{e.duration ?? 0} {tb("units.min")}
                  </p>
                </div>
                <Switch on={!inactive} onToggle={() => toggleActive.mutate(e)} />
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  aria-label={tc("edit")}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDel(e)}
                  aria-label={tc("delete")}
                  className="flex size-8 items-center justify-center rounded-lg text-error"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
      >
        <Plus className="size-4" />
        {t("addExtra")}
      </button>

      {editing && (
        <ExtraEditorSheet
          profileId={profileId}
          serviceId={serviceId}
          currency={currency}
          extra={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        type="danger"
        title={tc("delete")}
        message={tb("deleteConfirm")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => confirmDel && del.mutate(idOf(confirmDel))}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

function ExtraEditorSheet({
  profileId,
  serviceId,
  currency,
  extra,
  onClose,
  onSaved,
}: {
  profileId: string;
  serviceId: string;
  currency: string;
  extra: Extra | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("booking.services");
  const tc = useTranslations("common");
  const [name, setName] = useState(extra?.name ?? "");
  const [description, setDescription] = useState(extra?.description ?? "");
  const [price, setPrice] = useState(String(extra?.price ?? 0));
  const [duration, setDuration] = useState(String(extra?.duration ?? 0));

  const save = useMutation({
    mutationFn: () => {
      const body: Partial<Extra> = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Math.max(0, Number(price) || 0),
        duration: Math.max(0, Math.round(Number(duration) || 0)),
        currency,
      };
      return extra
        ? updateExtra(idOf(extra), body)
        : createExtra(profileId, serviceId, body);
    },
    onSuccess: onSaved,
  });

  return (
    <BottomSheet
      title={extra ? t("editExtra") : t("addExtra")}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {tc("save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <ExtraField label={t("extraName")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </ExtraField>
        <ExtraField label={t("description")}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </ExtraField>
        <div className="grid grid-cols-2 gap-3">
          <ExtraField label={`${t("price")} (${currency})`}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </ExtraField>
          <ExtraField
            label={`${t("duration")} (${t("minutesUnit", { count: Number(duration) || 0 })})`}
          >
            <Input
              type="number"
              min={0}
              step={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </ExtraField>
        </div>
        {save.isError && <p className="text-sm text-error">{tc("genericError")}</p>}
      </div>
    </BottomSheet>
  );
}

function ExtraField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
