"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CalendarCheck, ChevronRight, Globe } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listProfiles } from "@/lib/api/profiles";
import { cdnUrl } from "@/lib/api/qrcodes";

export default function BookingsListPage() {
  const t = useTranslations("bookingsList");
  const { data, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: listProfiles,
  });
  const items = data ?? [];

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-6 space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}

        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        )}

        {!isLoading &&
          items.map((p) => {
            const id = p._id ?? p.id ?? "";
            const logo =
              (p.settings?.website_logo as string | undefined) ||
              (p.settings?.logo as { image_url?: string } | undefined)?.image_url;
            const name =
              (p.settings?.website_name as string | undefined) ||
              p.settings?.name?.text ||
              p.name;
            return (
              <Link
                key={id}
                href={`/sites/${id}/booking`}
                className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft transition-shadow hover:shadow-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cdnUrl(logo)} alt="" className="size-full object-cover" />
                  ) : (
                    <Globe className="size-5 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarCheck className="size-3.5" />
                    {t("title")}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground rtl:rotate-180" />
              </Link>
            );
          })}
      </div>
    </div>
  );
}
