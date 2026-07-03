"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck, Users, Globe, Cloud, CreditCard } from "lucide-react";
import { AdminProfileSearch } from "@/components/admin/admin-profile-search";
import {
  AdminShell,
  AdminHeader,
  AdminGrid,
  AdminCard,
  AdminSectionLabel,
} from "@/components/admin/admin-ui";

const TOOLS = [
  {
    href: "/admin/domain-requests",
    titleKey: "tools.requests.title",
    descKey: "tools.requests.desc",
    Icon: Globe,
    accent: "#34c759",
  },
  {
    href: "/admin/cloudflare",
    titleKey: "tools.cloudflare.title",
    descKey: "tools.cloudflare.desc",
    Icon: Cloud,
    accent: "#5856d6",
  },
  {
    href: "/admin/plans",
    titleKey: "tools.plans.title",
    descKey: "tools.plans.desc",
    Icon: CreditCard,
    accent: "#ff9500",
  },
] as const;

export default function AdminPage() {
  const t = useTranslations("admin");

  return (
    <AdminShell>
      <AdminHeader title={t("title")} description={t("subtitle")} Icon={ShieldCheck} />

      {/* Profile control / search — the primary admin entry point. */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="brand-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              {t("tools.profiles.title")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("tools.profiles.desc")}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <AdminProfileSearch autoFocus />
        </div>
      </section>

      {/* Other admin tools. */}
      <div>
        <AdminSectionLabel>{t("manage")}</AdminSectionLabel>
        <AdminGrid>
          {TOOLS.map((tool) => (
            <AdminCard
              key={tool.href}
              Icon={tool.Icon}
              title={t(tool.titleKey)}
              description={t(tool.descKey)}
              href={tool.href}
              accent={tool.accent}
            />
          ))}
        </AdminGrid>
      </div>
    </AdminShell>
  );
}
