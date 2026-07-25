"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Link2Off } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

type Result = "success" | "invalid" | "expired" | "conflict";

/**
 * Result screen after the user clicks the email-change confirmation link — the
 * web counterpart of the mobile EmailChangeConfirmLayout. The backend GET
 * endpoint has ALREADY applied (or rejected) the change and redirected here
 * with `?result=success|invalid|expired|conflict` (docs/email-change.md); this
 * page only presents the outcome.
 */
function EmailChangedContent() {
  const t = useTranslations("settings.changeEmail");
  const router = useRouter();
  const params = useSearchParams();

  const raw = params.get("result");
  const result: Result =
    raw === "success" || raw === "expired" || raw === "conflict"
      ? raw
      : "invalid";
  const success = result === "success";

  const [title, desc] =
    result === "success"
      ? [t("changedTitle"), t("changedDesc")]
      : result === "expired"
        ? [t("expiredTitle"), t("expiredDesc")]
        : result === "conflict"
          ? [t("conflictTitle"), t("conflictDesc")]
          : [t("invalidTitle"), t("invalidDesc")];

  function leave() {
    router.replace(useAuthStore.getState().token ? "/dashboard" : "/login");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {success ? (
          <CheckCircle2 className="size-16 text-success" />
        ) : (
          <Link2Off className="size-16 text-muted-foreground" />
        )}
        <h1 className="mt-8 text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        <Button variant="gradient" className="mt-10 w-full" onClick={leave}>
          {success ? t("done") : t("gotIt")}
        </Button>
      </div>
    </div>
  );
}

export default function EmailChangedPage() {
  return (
    <Suspense>
      <EmailChangedContent />
    </Suspense>
  );
}
