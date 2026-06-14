"use client";

import { useTranslations } from "next-intl";
import { QrScanner } from "@/components/qr/qr-scanner";

export default function ScanPage() {
  const t = useTranslations("scan");
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-8">
        <QrScanner />
      </div>
    </div>
  );
}
