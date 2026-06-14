"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutGrid, Loader2, Sparkles } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttributeField } from "@/components/qr/attribute-field";
import { QrTypeIcon } from "@/components/qr/qr-type-icon";
import { StyleEditor } from "@/components/qr/style-editor";
import {
  DEFAULT_CUSTOMIZES,
  listQrCodes,
  listQrConfigurations,
  type Customizes,
  type QrConfig,
  type QrType,
} from "@/lib/api/qrcodes";

type Step = "type" | "data" | "style";

export default function NewQrPage() {
  const t = useTranslations("qr");
  const router = useRouter();
  const queryClient = useQueryClient();
  const editParam = useSearchParams().get("edit");

  const [step, setStep] = useState<Step>("type");
  const [qrType, setQrType] = useState<QrType>("static");
  const [config, setConfig] = useState<QrConfig | null>(null);
  const [name, setName] = useState("");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [customizes, setCustomizes] = useState<Customizes>(DEFAULT_CUSTOMIZES);
  const [editId, setEditId] = useState<string | undefined>();

  // Step 1 — available QR types (configurations) for the selected static/dynamic tab
  const configsQuery = useQuery({
    queryKey: ["qr-configs", qrType],
    queryFn: () => listQrConfigurations(qrType),
  });

  // Edit mode (?edit=<id>): load the saved QR and prefill the editor.
  useEffect(() => {
    if (!editParam) return;
    let cancelled = false;
    (async () => {
      const list = await queryClient.fetchQuery({
        queryKey: ["qr-codes"],
        queryFn: listQrCodes,
      });
      if (cancelled) return;
      const item = list.find((q) => q._id === editParam);
      const cfg =
        item && typeof item.qrCode === "object" ? item.qrCode : null;
      if (!item || !cfg) return;
      setConfig(cfg);
      setQrType(cfg.qr_type === "dynamic" ? "dynamic" : "static");
      setName(item.name ?? "");
      setData(item.data ?? {});
      setCustomizes(item.customizes ?? DEFAULT_CUSTOMIZES);
      setEditId(item._id);
      setStep("data");
    })();
    return () => {
      cancelled = true;
    };
  }, [editParam, queryClient]);

  const loadingEdit = !!editParam && !editId;

  function pickType(c: QrConfig) {
    setConfig(c);
    // Seed the data map with the attributes' default values (mirrors mobile).
    const seed: Record<string, unknown> = {};
    for (const attr of c.attributes) {
      seed[attr.tag] =
        attr.customization?.default ?? (attr.type === "bool" ? false : "");
    }
    setData(seed);
    setName("");
    setCustomizes(DEFAULT_CUSTOMIZES);
    setStep("data");
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center gap-3">
        {step === "type" ? (
          <Link
            href="/qr-codes"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (step === "style") setStep("data");
              else if (editId) router.push("/qr-codes");
              else setStep("type");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <h1 className="text-2xl font-bold">
          {step === "type"
            ? t("selectType")
            : `${config?.name ?? ""} ${t(editId ? "editQr" : "newQr")}`}
        </h1>
      </div>

      <div className="mt-8">
        {loadingEdit && (
          <div className="flex justify-center py-24">
            <Loader2 className="size-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingEdit && step === "type" && (
          <>
            <TypeToggle value={qrType} onChange={setQrType} t={t} />
            <TypePicker
              loading={configsQuery.isLoading}
              error={configsQuery.isError}
              configs={configsQuery.data ?? []}
              qrType={qrType}
              onPick={pickType}
              errorText={t("loadError")}
              dynamicLabel={t("dynamic")}
              t={t}
            />
          </>
        )}

        {step === "data" && config && (
          <DataForm
            config={config}
            name={name}
            data={data}
            onName={setName}
            onData={setData}
            onNext={() => setStep("style")}
            t={t}
          />
        )}

        {step === "style" && config && (
          <StyleEditor
            config={config}
            qrType={qrType}
            name={name}
            data={data}
            customizes={customizes}
            editId={editId}
            onCustomizes={setCustomizes}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// static / dynamic toggle (mirrors the mobile selector's segmented control)
// ---------------------------------------------------------------------------

function TypeToggle({
  value,
  onChange,
  t,
}: {
  value: QrType;
  onChange: (v: QrType) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tabs: { key: QrType; label: string; icon: typeof LayoutGrid }[] = [
    { key: "static", label: t("static"), icon: LayoutGrid },
    { key: "dynamic", label: t("dynamic"), icon: Sparkles },
  ];
  return (
    <div className="mb-6 flex gap-2 rounded-xl border border-border p-1.5">
      {tabs.map((tab) => {
        const active = value === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-dark text-white"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 â€” type picker
// ---------------------------------------------------------------------------

/**
 * QR type name/description come from the API. For the known standard types we
 * override them with a local translation (qr.types.<slug>); unknown/new types
 * fall back to the API text. Slug = lowercased alphanumerics of the API name.
 */
function localizeQrType(
  t: ReturnType<typeof useTranslations>,
  name: string,
  description: string,
) {
  const slug = (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const nKey = `types.${slug}.name`;
  const dKey = `types.${slug}.desc`;
  return {
    name: slug && t.has(nKey) ? t(nKey) : name,
    desc: slug && t.has(dKey) ? t(dKey) : description,
  };
}

function TypePicker({
  loading,
  error,
  configs,
  qrType,
  onPick,
  errorText,
  dynamicLabel,
  t,
}: {
  loading: boolean;
  error: boolean;
  configs: QrConfig[];
  qrType: QrType;
  onPick: (c: QrConfig) => void;
  errorText: string;
  dynamicLabel: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error || configs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        {errorText}
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {configs.map((c) => {
        const loc = localizeQrType(t, c.name, c.description);
        return (
          <button
            key={c._id}
            type="button"
            onClick={() => onPick(c)}
            className="shadow-soft flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-start transition-colors hover:border-primary"
          >
            <QrTypeIcon icon={c.icon} className="size-8 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{loc.name}</span>
                {qrType === "dynamic" && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    {dynamicLabel}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{loc.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 â€” data form (driven by the config's attributes)
// ---------------------------------------------------------------------------

function DataForm({
  config,
  name,
  data,
  onName,
  onData,
  onNext,
  t,
}: {
  config: QrConfig;
  name: string;
  data: Record<string, unknown>;
  onName: (v: string) => void;
  onData: (d: Record<string, unknown>) => void;
  onNext: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [errors, setErrors] = useState<Record<string, "required" | "invalid">>({});

  function setField(tag: string, value: unknown) {
    onData({ ...data, [tag]: value });
  }

  const isEmpty = (v: unknown) =>
    v === undefined ||
    v === null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0);

  // Mirrors the mobile QrFormBuilder validators: required (RequiredValidator) +
  // a regex `customization.validator` (PatternValidator) for filled values.
  function validate(): boolean {
    const next: Record<string, "required" | "invalid"> = {};
    if (!name.trim()) next.__name = "required";
    for (const attr of config.attributes) {
      const v = data[attr.tag];
      const c = attr.customization ?? {};
      if (c.required && isEmpty(v)) {
        next[attr.tag] = "required";
        continue;
      }
      if (!isEmpty(v) && typeof v === "string" && c.validator) {
        try {
          if (!new RegExp(c.validator).test(v)) next[attr.tag] = "invalid";
        } catch {
          // ignore malformed regex from the backend
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const loc = localizeQrType(t, config.name, config.explanation || config.description);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Info panel (icon + name + description), like the mobile header card */}
      <div className="order-1 md:order-2">
        <div className="brand-tint-soft rounded-2xl border border-primary/15 p-6 md:sticky md:top-6">
          <div className="flex items-center gap-3">
            <QrTypeIcon icon={config.icon} className="size-10 shrink-0" />
            <h2 className="text-lg font-bold">
              {loc.name} {t("newQr")}
            </h2>
          </div>
          {loc.desc && (
            <p className="mt-4 text-sm text-muted-foreground">{loc.desc}</p>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="order-2 space-y-5 md:order-1">
        <div>
          <label
            htmlFor="qr-name"
            className="mb-1.5 block text-xs font-normal text-muted-foreground"
          >
            {t("nameLabel")}
          </label>
          <Input
            id="qr-name"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="h-11 rounded-[10px] bg-white placeholder:text-[#bbbdc3]"
          />
          {errors.__name && (
            <p className="mt-1 text-xs text-error">{t("required")}</p>
          )}
        </div>

        <p className="text-sm font-semibold">{t("fillInfo")}</p>

        {config.attributes.map((attr) => (
          <AttributeField
            key={attr.tag}
            attr={attr}
            value={data[attr.tag]}
            error={!!errors[attr.tag]}
            requiredText={
              errors[attr.tag] === "invalid"
                ? t("invalidField", { label: attr.label })
                : t("required")
            }
            onChange={(v) => setField(attr.tag, v)}
          />
        ))}

        <Button
          variant="gradient"
          className="w-full"
          onClick={() => {
            if (validate()) onNext();
          }}
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
