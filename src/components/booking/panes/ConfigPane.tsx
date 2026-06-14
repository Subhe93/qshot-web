"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Loader2,
  CreditCard,
  Coins,
  Clock,
  CalendarDays,
  Hourglass,
  Users,
  Timer,
  CalendarX,
  RotateCcw,
  Percent,
  ChevronRight,
  Check,
  Minus,
  Plus,
} from "lucide-react";
import {
  createBookingConfig,
  getBookingConfig,
  getStripeOnboardUrl,
  getStripeStatus,
  toggleBookingConfig,
  updateBookingConfig,
  type BookingConfig,
} from "@/lib/api/booking";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PaneLoading } from "../shared";
import { Switch } from "./ServicesPane";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "EGP", "SEK", "TRY", "KWD"];

type NumKey =
  | "minNoticeTime"
  | "maxAdvancedBooking"
  | "softHoldDuration"
  | "generalGapBefore"
  | "generalGapAfter"
  | "userBookingLimit"
  | "cooldownBetweenBookings"
  | "cancellationCutoffHours"
  | "cancellationRefundPercent"
  | "depositPercent"
  | "platformFeePercent";

export function ConfigPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const tc = useTranslations("booking.config");
  const tcom = useTranslations("common");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["booking-config", profileId],
    queryFn: () => getBookingConfig(profileId),
  });
  const stripe = useQuery({
    queryKey: ["booking-stripe", profileId],
    queryFn: () => getStripeStatus(profileId),
  });

  const [draft, setDraft] = useState<BookingConfig>({});
  const exists = !!data?._id;
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      exists ? updateBookingConfig(profileId, draft) : createBookingConfig(profileId, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-config", profileId] }),
  });
  const toggle = useMutation({
    mutationFn: () => toggleBookingConfig(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-config", profileId] }),
  });
  const [connecting, setConnecting] = useState(false);
  async function connectStripe() {
    setConnecting(true);
    try {
      const res = await getStripeOnboardUrl(profileId);
      if (res?.onboardingUrl) window.location.href = res.onboardingUrl;
    } catch {
      /* ignore */
    } finally {
      setConnecting(false);
    }
  }

  // Active picker sheet (number key or "currency").
  const [sheet, setSheet] = useState<NumKey | "currency" | null>(null);

  if (isLoading) return <PaneLoading />;
  const set = (p: Partial<BookingConfig>) => setDraft((d) => ({ ...d, ...p }));
  const enabled = draft.isEnabled ?? false;
  const stripeConnected = stripe.data?.connected ?? !!stripe.data?.chargesEnabled;

  const NUM_META: Record<NumKey, { icon: React.ReactNode; color: string; label: string; max: number; step: number; unit: string }> = {
    minNoticeTime: { icon: <Clock className="size-4" />, color: "#3b82f6", label: tc("minNotice"), max: 720, step: 5, unit: t("units.min") },
    maxAdvancedBooking: { icon: <CalendarDays className="size-4" />, color: "#3b82f6", label: tc("maxAdvanced"), max: 365, step: 1, unit: "d" },
    softHoldDuration: { icon: <Hourglass className="size-4" />, color: "#3b82f6", label: tc("softHold"), max: 120, step: 5, unit: t("units.min") },
    generalGapBefore: { icon: <Hourglass className="size-4" />, color: "#14b8a6", label: tc("gapBefore"), max: 120, step: 5, unit: t("units.min") },
    generalGapAfter: { icon: <Hourglass className="size-4 rotate-180" />, color: "#14b8a6", label: tc("gapAfter"), max: 120, step: 5, unit: t("units.min") },
    userBookingLimit: { icon: <Users className="size-4" />, color: "#6366f1", label: tc("userLimit"), max: 200, step: 1, unit: "" },
    cooldownBetweenBookings: { icon: <Timer className="size-4" />, color: "#6366f1", label: tc("cooldown"), max: 720, step: 5, unit: t("units.min") },
    cancellationCutoffHours: { icon: <CalendarX className="size-4" />, color: "#ff9500", label: tc("cutoffHours"), max: 168, step: 1, unit: "h" },
    cancellationRefundPercent: { icon: <RotateCcw className="size-4" />, color: "#ff9500", label: tc("refundPercent"), max: 100, step: 5, unit: "%" },
    depositPercent: { icon: <CreditCard className="size-4" />, color: "#34c360", label: tc("depositPercent"), max: 100, step: 5, unit: "%" },
    platformFeePercent: { icon: <Percent className="size-4" />, color: "#34c360", label: tc("platformFee"), max: 50, step: 1, unit: "%" },
  };

  const row = (k: NumKey) => {
    const m = NUM_META[k];
    return (
      <PickerRow
        icon={m.icon}
        color={m.color}
        label={m.label}
        value={`${draft[k] ?? 0}${m.unit ? ` ${m.unit}` : ""}`}
        onClick={() => setSheet(k)}
      />
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{tc("title")}</h2>
          <Button variant="gradient" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {tcom("save")}
          </Button>
        </div>

        {/* Enable */}
        <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft">
          <span className="font-medium">{t(enabled ? "enabled" : "disabled")}</span>
          <Switch on={enabled} onToggle={() => toggle.mutate()} />
        </div>

        <Group title={tc("general")}>
          <PickerRow icon={<Coins className="size-4" />} color="#d97706" label={tc("currency")} value={draft.defaultCurrency ?? "USD"} onClick={() => setSheet("currency")} />
          {row("minNoticeTime")}
          {row("maxAdvancedBooking")}
          {row("softHoldDuration")}
        </Group>

        <Group title={tc("gaps")}>
          {row("generalGapBefore")}
          {row("generalGapAfter")}
        </Group>

        <Group title={tc("customerLimits")}>
          {row("userBookingLimit")}
          {row("cooldownBetweenBookings")}
        </Group>

        <Group title={tc("cancellation")}>
          {row("cancellationCutoffHours")}
          {row("cancellationRefundPercent")}
        </Group>

        <Group title={tc("payment")}>
          {row("depositPercent")}
          {row("platformFeePercent")}
        </Group>

        {/* Stripe */}
        <button
          type="button"
          onClick={connectStripe}
          disabled={connecting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: "#635bff" }}
        >
          {connecting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
          {t(stripeConnected ? "manageStripe" : "connectStripe")}
        </button>
      </div>

      {/* Sheets */}
      {sheet === "currency" && (
        <BottomSheet title={tc("currency")} onClose={() => setSheet(null)}>
          <div className="space-y-1">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  set({ defaultCurrency: c });
                  setSheet(null);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-3 text-start text-sm",
                  c === (draft.defaultCurrency ?? "USD") ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted",
                )}
              >
                {c}
                {c === (draft.defaultCurrency ?? "USD") && <Check className="size-4" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      {sheet && sheet !== "currency" && (
        <NumberSheet
          title={NUM_META[sheet].label}
          value={draft[sheet] ?? 0}
          max={NUM_META[sheet].max}
          step={NUM_META[sheet].step}
          unit={NUM_META[sheet].unit}
          done={tcom("save")}
          onChange={(v) => set({ [sheet]: v } as Partial<BookingConfig>)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ── Section group: header + responsive 2-col field grid ────────
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-2.5 rounded-2xl bg-card p-3 shadow-soft lg:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

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
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      <span className="text-sm font-semibold text-muted-foreground">{value}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
    </button>
  );
}

function NumberSheet({
  title,
  value,
  max,
  step,
  unit,
  done,
  onChange,
  onClose,
}: {
  title: string;
  value: number;
  max: number;
  step: number;
  unit: string;
  done: string;
  onChange: (v: number) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(value);
  const clamp = (n: number) => Math.max(0, Math.min(max, n));
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button
            variant="gradient"
            className="w-full"
            onClick={() => {
              onChange(clamp(v));
              onClose();
            }}
          >
            {done}
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-center gap-5 py-4">
        <button
          type="button"
          onClick={() => setV((x) => clamp(x - step))}
          className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground"
        >
          <Minus className="size-5" />
        </button>
        <div className="flex min-w-24 flex-col items-center">
          <input
            type="number"
            min={0}
            max={max}
            value={v}
            onChange={(e) => setV(clamp(Number(e.target.value)))}
            className="w-24 bg-transparent text-center text-3xl font-extrabold outline-none"
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={() => setV((x) => clamp(x + step))}
          className="brand-gradient flex size-12 items-center justify-center rounded-full text-white"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </BottomSheet>
  );
}
