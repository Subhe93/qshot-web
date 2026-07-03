"use client";

import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import { AdminShell, AdminHeader } from "@/components/admin/admin-ui";
import { PlanCards } from "@/components/admin/plan-cards";

export default function AdminPlansPage() {
  const t = useTranslations("admin");

  return (
    <AdminShell>
      <AdminHeader
        title={t("plans.title")}
        description={t("tools.plans.desc")}
        backHref="/admin"
        Icon={CreditCard}
      />
      <PlanCards />
    </AdminShell>
  );
}
