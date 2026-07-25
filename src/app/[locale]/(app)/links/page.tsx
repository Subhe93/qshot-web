"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LinksList } from "@/components/links/links-list";
import { LinksStats } from "@/components/links/links-stats";
import { CreateLinkSheet } from "@/components/links/create-link-sheet";
import type { CustomLink } from "@/lib/api/custom-links";
import { cn } from "@/lib/utils";

type Tab = "links" | "stats";

export default function LinksPage() {
  const t = useTranslations("smartLinks");
  const [tab, setTab] = useState<Tab>("links");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CustomLink | null>(null);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(link: CustomLink) {
    setEditing(link);
    setSheetOpen(true);
  }
  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "links", label: t("linksTab") },
    { key: "stats", label: t("statsTab") },
  ];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        Icon={Link2}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          tab === "links" ? (
            <button
              type="button"
              onClick={openCreate}
              className="brand-gradient flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="size-4 shrink-0" />
              {t("create")}
            </button>
          ) : undefined
        }
      />

      {/* Tab switch */}
      <div className="mt-6 flex rounded-xl border border-border p-0.5">
        {tabs.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setTab(it.key)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              tab === it.key
                ? "brand-tint text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "links" ? (
          <LinksList onCreate={openCreate} onEdit={openEdit} />
        ) : (
          <LinksStats />
        )}
      </div>

      {sheetOpen && (
        <CreateLinkSheet
          editing={editing}
          onClose={closeSheet}
          onSaved={closeSheet}
        />
      )}
    </div>
  );
}
