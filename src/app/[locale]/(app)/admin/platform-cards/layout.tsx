"use client";

import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import { AdminShell, AdminHeader } from "@/components/admin/admin-ui";
import { PlatformCardsTabs } from "@/components/admin/platform-cards/tabs";

/**
 * Platform redirect cards — admin section shell. The admin gate lives in the
 * parent `admin/layout.tsx` (isAdmin), so this only adds the header + tabs.
 */
export default function PlatformCardsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("adminPlatformCards");
  return (
    <AdminShell>
      <AdminHeader title={t("title")} description={t("subtitle")} backHref="/admin" Icon={CreditCard} />
      <PlatformCardsTabs />
      {children}
    </AdminShell>
  );
}
