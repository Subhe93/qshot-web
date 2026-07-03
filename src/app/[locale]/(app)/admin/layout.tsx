"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { getAccount } from "@/lib/api/account";

/**
 * Single admin gate for every `/admin/*` route. Reuses the cached `["account"]`
 * query (already populated by the sidebar) and redirects non-admins to the
 * dashboard once the account resolves. UX-only — the real boundary is the API
 * rejecting non-admin JWTs. Mirrors the redirect style in `(app)/layout.tsx`.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: account, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
  });
  const isAdmin = Boolean(account?.user?.isAdmin);

  useEffect(() => {
    if (!isLoading && account && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, account, isAdmin, router]);

  // While loading, or before the redirect fires for a non-admin, render nothing.
  if (isLoading || !isAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
