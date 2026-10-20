"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CODE_SOURCES,
  CODE_STATUSES,
  PLATFORM_CODES,
  listCodes,
  type AdminCode,
  type CodeSource,
  type CodeStatus,
  type PlatformCode,
  retryUnlessRefused,
} from "@/lib/api/admin-platform-redirect";
import {
  EmptyState,
  Field,
  Notice,
  Pager,
  Panel,
  Select,
  SkeletonRows,
  useLoadError,
} from "./shared";
import { CodeDrawer, CodeRow } from "./code-drawer";

export const CODES_QUERY_KEY = ["admin", "platform-cards", "codes"] as const;
const PAGE_SIZE = 25;

interface Filters {
  platform: PlatformCode | "";
  status: CodeStatus | "";
  source: CodeSource | "";
  batchId: string;
  code: string;
  userEmail: string;
}

const EMPTY: Filters = { platform: "", status: "", source: "", batchId: "", code: "", userEmail: "" };

/** Cards: search / filter / paginate every code; row → detail drawer. */
export function CardsTab() {
  const t = useTranslations("adminPlatformCards");

  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AdminCode | null>(null);

  const q = useQuery({
    queryKey: [...CODES_QUERY_KEY, { ...applied, page }],
    queryFn: () =>
      listCodes({
        ...applied,
        code: applied.code.trim(),
        batchId: applied.batchId.trim(),
        userEmail: applied.userEmail.trim(),
        page,
        limit: PAGE_SIZE,
      }),
    retry: retryUnlessRefused,
    placeholderData: (prev) => prev,
  });
  const loadError = useLoadError(q.error);

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    setApplied(draft);
    setPage(1);
  }
  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  }

  const isFiltered = Object.values(applied).some((v) => v !== "");
  const codes = q.data?.codes ?? [];

  return (
    <div className="space-y-4">
      <Panel title={t("cardsTab.title")} description={t("cardsTab.desc")}>
        <form onSubmit={apply} className="grid grid-cols-2 gap-3 border-b border-border p-4 md:grid-cols-3 xl:grid-cols-6 sm:p-5">
          <Field label={t("cardsTab.codePrefix")} htmlFor="c-code">
            <Input
              id="c-code"
              inputMode="numeric"
              maxLength={5}
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.replace(/\D/g, "") }))}
              placeholder="43…"
              className="font-mono"
            />
          </Field>
          <Field label={t("filters.userEmail")} htmlFor="c-email">
            <Input
              id="c-email"
              type="search"
              value={draft.userEmail}
              onChange={set("userEmail")}
              placeholder="name@example.com"
              maxLength={120}
            />
          </Field>
          <Field label={t("platform")} htmlFor="c-platform">
            <Select id="c-platform" value={draft.platform} onChange={set("platform")}>
              <option value="">{t("filters.allPlatforms")}</option>
              {PLATFORM_CODES.map((p) => (
                <option key={p} value={p}>
                  {t(`platforms.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("filters.status")} htmlFor="c-status">
            <Select id="c-status" value={draft.status} onChange={set("status")}>
              <option value="">{t("filters.any")}</option>
              {CODE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`codeStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("filters.source")} htmlFor="c-source">
            <Select id="c-source" value={draft.source} onChange={set("source")}>
              <option value="">{t("filters.any")}</option>
              {CODE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`source.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("filters.batchId")} htmlFor="c-batch">
            <Input
              id="c-batch"
              value={draft.batchId}
              onChange={set("batchId")}
              placeholder="6ad6…"
              className="font-mono"
            />
          </Field>
          <div className="col-span-2 flex items-center gap-2 md:col-span-3 xl:col-span-6">
            <Button type="submit" variant="gradient" size="sm">
              <Search className="size-4" />
              {t("cardsTab.search")}
            </Button>
            {isFiltered && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <X className="size-4" />
                {t("filters.clear")}
              </Button>
            )}
            {q.data && (
              <span className="ms-auto text-xs text-muted-foreground">
                {t("cardsTab.results", { count: q.data.pagination.totalItems })}
              </span>
            )}
          </div>
        </form>

        {q.isLoading ? (
          <SkeletonRows rows={8} />
        ) : loadError ? (
          <Notice tone="error" className="m-4">
            {loadError}
          </Notice>
        ) : codes.length === 0 ? (
          <EmptyState
            Icon={CreditCard}
            title={t("cardsTab.empty")}
            description={isFiltered ? t("cardsTab.emptyFiltered") : undefined}
          />
        ) : (
          <ul className={q.isFetching ? "divide-y divide-border opacity-60" : "divide-y divide-border"}>
            {codes.map((c) => (
              <CodeRow key={c._id} code={c} onOpen={setOpen} showBatch />
            ))}
          </ul>
        )}
        <Pager pagination={q.data?.pagination} onPage={setPage} />
      </Panel>

      {open && <CodeDrawer platform={open.platform} code={open.code} onClose={() => setOpen(null)} />}
    </div>
  );
}
