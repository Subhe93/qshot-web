"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Plus, Contact, Loader2, Trash2, MousePointer2, Star, Check, Pencil, Copy, Eye, EyeOff, RefreshCw, Search, ChevronsUpDown } from "lucide-react";
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  getProvider,
  regenerateProviderCode,
  listServices,
  listProviderServices,
  linkProviderService,
  updateProviderService,
  unlinkProviderService,
  getGoogleCalendarStatus,
  getGoogleCalendarConnectUrl,
  disconnectGoogleCalendar,
  idOf,
  type Provider,
  type Service,
  type ProviderService,
  type WorkingHours,
} from "@/lib/api/booking";
import { uploadProfileImage } from "@/lib/api/profiles";
import { cdnUrl } from "@/lib/api/qrcodes";
import { useBookingUi } from "@/stores/booking-store";
import { Input } from "@/components/ui/input";
import { PhoneField } from "@/components/qr/phone-field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { MasterDetail, PaneHeader, EmptyState, PaneLoading } from "../shared";
import { Switch } from "./ServicesPane";

const SLOT_GRANULARITIES = [5, 10, 15, 20, 30, 45, 60];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Stockholm",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Baghdad",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Africa/Cairo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/** The browser's IANA timezone (falls back to UTC if unavailable). */
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Every IANA timezone the runtime knows about (falls back to a common subset
 * on older engines without Intl.supportedValuesOf). */
function allTimezones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    if (typeof supported === "function") {
      const list = supported("timeZone");
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    /* not supported — fall through */
  }
  return COMMON_TIMEZONES;
}

/** Professional searchable timezone picker: a field that opens a bottom-sheet
 * (mobile) / panel sub-view (desktop) with a search box and a filtered list. */
function TimezonePicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (tz: string) => void;
}) {
  const t = useTranslations("booking.providers");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Match on the zone and on a humanized form ("America/New_York" → "new york").
    return options.filter(
      (tz) =>
        tz.toLowerCase().includes(q) ||
        tz.toLowerCase().replace(/[_/]/g, " ").includes(q),
    );
  }, [query, options]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
      >
        <span className="truncate">{value}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <BottomSheet title={t("timezone")} onClose={() => setOpen(false)} bodyClassName="p-0">
          <div className="flex max-h-[70vh] flex-col">
            {/* Search header (pinned) */}
            <div className="shrink-0 border-b border-border p-3">
              <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchTimezone")}
                  className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            {/* Results */}
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("noTimezones")}</p>
              ) : (
                <div className="space-y-0.5">
                  {filtered.map((tz) => (
                    <button
                      key={tz}
                      type="button"
                      onClick={() => {
                        onChange(tz);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm",
                        tz === value
                          ? "bg-primary/10 font-semibold text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <span className="truncate">{tz}</span>
                      {tz === value && <Check className="size-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

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
          {providers.map((p) => {
            const inactive = p.isActive === false;
            return (
              <button
                key={idOf(p)}
                type="button"
                onClick={() => selectProvider(p)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-start",
                  selId === idOf(p) ? "border-primary" : "border-transparent hover:bg-muted/50",
                  inactive && "opacity-60",
                )}
              >
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cdnUrl(p.avatar)}
                    alt=""
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-bold text-indigo-600">
                    {p.name?.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {p.isDefault && (
                      <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{p.specialization ?? p.email ?? ""}</p>
                  {(p.timezone || p.slotGranularity || (p.dailyBookingLimit ?? 0) > 0) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.timezone && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {p.timezone}
                        </span>
                      )}
                      {p.slotGranularity != null && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {p.slotGranularity} {t("units.min")}
                        </span>
                      )}
                      {(p.dailyBookingLimit ?? 0) > 0 && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {t("providers.dailyBookingLimit")}: {p.dailyBookingLimit}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {inactive && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {t("providers.inactive")}
                  </span>
                )}
              </button>
            );
          })}
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
  slotGranularity: 30,
  isActive: true,
  workingHours: [],
};

type ProviderTab = "info" | "hours" | "services" | "links";

/** Tabbed navigation for the provider editor (Services/Integrations only show
 *  once the provider is saved). */
function ProviderTabBar({
  tab,
  onChange,
  hasId,
  t,
}: {
  tab: ProviderTab;
  onChange: (t: ProviderTab) => void;
  hasId: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const tabs: { k: ProviderTab; label: string }[] = [
    { k: "info", label: t("tabInfo") },
    { k: "hours", label: t("workingHours") },
    ...(hasId
      ? [
          { k: "services" as const, label: t("servicesOffered") },
          { k: "links" as const, label: t("tabIntegrations") },
        ]
      : []),
  ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((x) => (
        <button
          key={x.k}
          type="button"
          onClick={() => onChange(x.k)}
          className={cn(
            "shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
            tab === x.k
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}

function ProviderEditor({ profileId, provider }: { profileId: string; provider: Provider | null }) {
  const t = useTranslations("booking.providers");
  const tb = useTranslations("booking");
  const tc = useTranslations("common");
  const td = useTranslations("booking.days");
  const qc = useQueryClient();
  const { selectProvider, clearDetail } = useBookingUi.getState();

  const [draft, setDraft] = useState<Provider>(provider ?? DEFAULT_PROVIDER);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [tab, setTab] = useState<ProviderTab>("info");
  const [phoneValid, setPhoneValid] = useState(true);
  useEffect(() => {
    // New providers default to the browser's timezone (resolved on the client to
    // avoid an SSR/server-tz mismatch); existing ones keep their saved value.
    setDraft(provider ?? { ...DEFAULT_PROVIDER, timezone: browserTimezone() });
    setLocalPreview(null);
    setUploadError(false);
    setPhoneValid(true);
    setTab("info");
  }, [provider]);

  // Full world timezone list for the dropdown, guaranteed to include the current
  // value (e.g. a saved zone not in the runtime's set).
  const timezoneOptions = useMemo(() => {
    const list = allTimezones();
    const current = draft.timezone;
    return current && !list.includes(current) ? [current, ...list] : list;
  }, [draft.timezone]);

  const id = provider ? idOf(provider) : null;
  // Services & integrations only exist for a saved provider; if somehow active
  // while unsaved, fall back to Info.
  const activeTab: ProviderTab =
    !id && (tab === "services" || tab === "links") ? "info" : tab;
  const email = draft.email ?? "";
  const emailInvalid = email.trim() !== "" && !EMAIL_RE.test(email.trim());
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
      setConfirmDelete(false);
      clearDetail();
    },
  });

  const set = (p: Partial<Provider>) => setDraft((d) => ({ ...d, ...p }));
  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Show the picked image immediately (independent of the upload round-trip).
    setLocalPreview(URL.createObjectURL(file));
    setUploadError(false);
    setUploading(true);
    try {
      const fileName = await uploadProfileImage(file);
      if (fileName) set({ avatar: cdnUrl(fileName) });
      else setUploadError(true);
    } catch {
      setUploadError(true);
    } finally {
      setUploading(false);
    }
  }
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
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={del.isPending} className="text-error" aria-label="Delete">
            {del.isPending ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}
          </button>
        )}
      </div>

      <ProviderTabBar tab={activeTab} onChange={setTab} hasId={!!id} t={t} />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {activeTab === "info" && (
        <>
        <div className="flex flex-col items-center gap-1.5">
          <label className="relative cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} disabled={uploading} />
            {localPreview || draft.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localPreview ?? cdnUrl(draft.avatar ?? undefined)}
                alt=""
                className="size-20 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-full bg-indigo-500/10 text-2xl font-bold text-indigo-600">
                {draft.name?.slice(0, 1).toUpperCase() || <Contact className="size-8 opacity-40" />}
              </span>
            )}
            <span className="absolute bottom-0 end-0 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-white">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
            </span>
          </label>
          {uploadError && (
            <p className="text-xs text-error">{tc("genericError")}</p>
          )}
        </div>
        <L label={t("name")}>
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label={t("email")}>
            <Input
              type="email"
              value={draft.email ?? ""}
              onChange={(e) => set({ email: e.target.value })}
              className={emailInvalid ? "border-error focus-visible:ring-error" : undefined}
            />
          </L>
          <L label={t("phone")}>
            <PhoneField
              key={id ?? "new"}
              value={draft.phone ?? ""}
              onChange={(v) => set({ phone: v })}
              onValidChange={setPhoneValid}
            />
          </L>
          <L label={t("specialization")}>
            <Input value={draft.specialization ?? ""} onChange={(e) => set({ specialization: e.target.value })} />
          </L>
          <L label={t("timezone")}>
            <TimezonePicker
              value={draft.timezone ?? "UTC"}
              options={timezoneOptions}
              onChange={(tz) => set({ timezone: tz })}
            />
          </L>
        </div>
        <L label={t("bio")}>
          <Textarea value={draft.bio ?? ""} onChange={(e) => set({ bio: e.target.value })} />
        </L>
        </>
        )}

        {activeTab === "hours" && (
        <>
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
            <L label={t("slotGranularity")}>
              <SearchableSelect
                value={draft.slotGranularity ?? 30}
                options={SLOT_GRANULARITIES.map((v) => ({
                  value: v,
                  label: `${v} ${tb("units.min")}`,
                }))}
                onChange={(v) => set({ slotGranularity: v })}
                title={t("slotGranularity")}
                searchPlaceholder={tc("search")}
              />
            </L>
            <Num label={t("dailyBookingLimit")} value={draft.dailyBookingLimit} onChange={(v) => set({ dailyBookingLimit: v })} min={0} />
            <Num label={t("dailyHoursLimit")} value={draft.dailyHoursLimit} onChange={(v) => set({ dailyHoursLimit: v })} min={0} />
            <Num label={t("forcedBreakAfterCount")} value={draft.forcedBreakAfterCount} onChange={(v) => set({ forcedBreakAfterCount: v })} min={0} />
            <Num label={t("forcedBreakDuration")} value={draft.forcedBreakDuration} onChange={(v) => set({ forcedBreakDuration: v })} min={5} step={5} />
          </div>
          <BlackoutDates
            dates={draft.blackoutDates ?? []}
            onChange={(dates) => set({ blackoutDates: dates })}
            t={t}
          />
        </div>
        </>
        )}

        {activeTab === "info" && (
        <>
        <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-soft">
          <span className="text-sm font-medium">{t("isDefault")}</span>
          <Switch on={!!draft.isDefault} onToggle={() => set({ isDefault: !draft.isDefault })} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-soft">
          <span className="text-sm font-medium">{t("active")}</span>
          <Switch on={draft.isActive ?? true} onToggle={() => set({ isActive: !(draft.isActive ?? true) })} />
        </div>
        </>
        )}

        {/* Services offered (provider↔service links) — saved provider only. */}
        {activeTab === "services" && id && (
          <ServicesOffered profileId={profileId} providerId={id} t={t} />
        )}

        {/* Google Calendar sync + portal access code — saved provider only.
            The default provider (the owner) manages bookings from the platform,
            so it has no portal access code; other providers keep it because they
            rely on the portal dashboard to view their bookings. */}
        {activeTab === "links" && id && (
          <>
            <ProviderGoogleCalendar providerId={id} />
            {!draft.isDefault && <ProviderAccessCode providerId={id} />}
          </>
        )}
      </div>

      <div className="border-t border-border bg-card p-3">
        <Button
          variant="gradient"
          className="w-full"
          disabled={!draft.name.trim() || emailInvalid || !phoneValid || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {tc("save")}
        </Button>
      </div>

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

// ─── Google Calendar sync (per-provider OAuth connection) ────────────────────
function ProviderGoogleCalendar({ providerId }: { providerId: string }) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ["gcal-status", providerId],
    queryFn: () => getGoogleCalendarStatus(providerId),
  });

  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["gcal-status", providerId] });

  // Track listeners so we can clean them up on unmount / after completion.
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  async function onConnect() {
    setErrorMsg(null);
    setConnecting(true);
    try {
      const { authUrl, error } = await getGoogleCalendarConnectUrl(providerId);
      if (error) {
        setErrorMsg(
          error.toLowerCase().includes("not configured")
            ? t("gcal.unavailable")
            : tc("genericError"),
        );
        setConnecting(false);
        return;
      }
      if (!authUrl) {
        setErrorMsg(tc("genericError"));
        setConnecting(false);
        return;
      }
      window.open(authUrl, "gcal", "width=520,height=640");

      const finish = () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        setConnecting(false);
        refresh();
      };
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === "gcal") finish();
      };
      const onFocus = () => finish();
      window.addEventListener("message", onMessage);
      window.addEventListener("focus", onFocus, { once: true });
      cleanupRef.current = () => {
        window.removeEventListener("message", onMessage);
        window.removeEventListener("focus", onFocus);
      };
    } catch {
      setErrorMsg(tc("genericError"));
      setConnecting(false);
    }
  }

  const disconnectM = useMutation({
    mutationFn: () => disconnectGoogleCalendar(providerId),
    onSuccess: () => {
      setConfirmDisconnect(false);
      refresh();
    },
  });

  const data = statusQ.data;
  const status = data?.status ?? null;
  const connected = data?.connected === true && status !== "revoked" && status !== "error";

  const connectBtn = (label: string) => (
    <Button variant="gradient" size="sm" disabled={connecting} onClick={onConnect}>
      {connecting && <Loader2 className="size-4 animate-spin" />}
      {connecting ? t("gcal.connecting") : label}
    </Button>
  );
  const disconnectBtn = (
    <Button
      variant="outline"
      size="sm"
      disabled={disconnectM.isPending}
      onClick={() => setConfirmDisconnect(true)}
    >
      {disconnectM.isPending && <Loader2 className="size-4 animate-spin" />}
      {t("gcal.disconnect")}
    </Button>
  );

  const lastSynced = (() => {
    if (!data?.lastSyncedAt) return null;
    const d = new Date(data.lastSyncedAt);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  })();

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("gcal.title")}
      </h3>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-3 text-xs text-muted-foreground">{t("gcal.subtitle")}</p>
        {statusQ.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : connected ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("gcal.connected")}
              {data?.googleEmail ? ` · ${data.googleEmail}` : ""}
            </p>
            {lastSynced && (
              <p className="text-xs text-muted-foreground">
                {t("gcal.lastSynced")}: {lastSynced}
              </p>
            )}
            <div className="flex flex-wrap gap-2">{disconnectBtn}</div>
          </div>
        ) : status === "revoked" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-error">{t("gcal.revoked")}</p>
            <div className="flex flex-wrap gap-2">{connectBtn(t("gcal.reconnect"))}</div>
          </div>
        ) : status === "error" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-error">{t("gcal.syncError")}</p>
            <div className="flex flex-wrap gap-2">
              {disconnectBtn}
              {connectBtn(t("gcal.reconnect"))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("gcal.notConnected")}</p>
            <div className="flex flex-wrap gap-2">{connectBtn(t("gcal.connect"))}</div>
          </div>
        )}
        {errorMsg && <p className="mt-2 text-xs text-error">{errorMsg}</p>}
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        type="danger"
        title={t("gcal.disconnect")}
        message={t("gcal.disconnectConfirm")}
        confirmText={t("gcal.disconnect")}
        cancelText={tc("cancel")}
        onConfirm={() => disconnectM.mutate()}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}

// ─── Provider portal access code (owner shares the secret code) ──────────────
function ProviderAccessCode({ providerId }: { providerId: string }) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const qc = useQueryClient();

  const codeQ = useQuery({
    queryKey: ["provider-code", providerId],
    queryFn: () => getProvider(providerId),
  });

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const code = codeQ.data?.secretCode ?? null;

  const regen = useMutation({
    mutationFn: () => regenerateProviderCode(providerId),
    onSuccess: (res) => {
      setConfirmRegen(false);
      setRevealed(true);
      if (res?.secretCode) {
        qc.setQueryData<Provider | null>(["provider-code", providerId], (prev) =>
          prev ? { ...prev, secretCode: res.secretCode } : prev,
        );
      }
      qc.invalidateQueries({ queryKey: ["provider-code", providerId] });
    },
  });

  async function onCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("providers.accessCode")}
      </h3>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-3 text-xs text-muted-foreground">{t("providers.accessCodeHint")}</p>
        {codeQ.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : code ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-sm tracking-wider">
                {revealed ? code : "•".repeat(Math.max(8, code.length))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? t("providers.hideCode") : t("providers.showCode")}
              >
                {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {revealed ? t("providers.hideCode") : t("providers.showCode")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopy}
                aria-label={t("providers.copyCode")}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t("providers.copied") : null}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {t("providers.portalHint")}: <span className="font-medium">provider.qshot.com</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={regen.isPending}
                onClick={() => setConfirmRegen(true)}
              >
                {regen.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("providers.regenerateCode")}
              </Button>
            </div>
          </div>
        ) : (
          // No code yet (e.g. a provider created before the feature) — let the
          // owner generate one on demand (regenerate-code creates a fresh code).
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t("providers.noCodeYet")}</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {t("providers.portalHint")}: <span className="font-medium">provider.qshot.com</span>
              </p>
              <Button
                variant="gradient"
                size="sm"
                disabled={regen.isPending}
                onClick={() => regen.mutate()}
              >
                {regen.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("providers.generateCode")}
              </Button>
            </div>
            {regen.isError && (
              <p className="text-xs text-error">{tc("genericError")}</p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRegen}
        type="danger"
        title={t("providers.regenerateCode")}
        message={t("providers.regenerateConfirm")}
        confirmText={t("providers.regenerateCode")}
        cancelText={tc("cancel")}
        onConfirm={() => regen.mutate()}
        onCancel={() => setConfirmRegen(false)}
      />
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
  min,
  step,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number;
}) {
  return (
    <L label={label}>
      <Input
        type="number"
        min={min}
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === "") return onChange(undefined);
          let n = Number(e.target.value);
          if (min != null && n < min) n = min;
          onChange(n);
        }}
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
    // The backend requires profileId on this list (403 "Profile ID is required"
    // without it). Missing it returned an empty list, so the toggle always tried
    // to re-create an existing link → 400 duplicate key.
    queryFn: () => listProviderServices({ profileId, providerId }),
  });
  // Only bookable leaves can be linked — the backend rejects linking a category
  // (a service with children) with 400 (mobile filters services.where(!isCategory)).
  const services = (servicesQ.data ?? []).filter((s) => !s.hasChildren);
  const links = linksQ.data ?? [];
  const linkOf = (sid: string) => links.find((l) => l.serviceId === sid);
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["provider-services", providerId] });

  const toggle = useMutation({
    mutationFn: async (svc: Service) => {
      const sid = idOf(svc);
      const link = linkOf(sid);
      if (link) await unlinkProviderService(idOf(link));
      else await linkProviderService({ profileId, providerId, serviceId: sid });
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
