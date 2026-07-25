"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/stores/auth-store";

const EMAIL_CHANGE_RESULTS = ["success", "invalid", "expired", "conflict"];

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Returning from the email-change confirmation link: the backend GET
    // endpoint applies the change then redirects to
    // `{MAIN_DOMAIN}/?emailChanged=success|invalid|expired|conflict`
    // (docs/email-change.md). Show the result screen instead of the plain
    // dashboard/login redirect.
    const result = new URLSearchParams(window.location.search).get(
      "emailChanged",
    );
    if (result && EMAIL_CHANGE_RESULTS.includes(result)) {
      router.replace(`/email-changed?result=${result}`);
      return;
    }

    const decide = () =>
      router.replace(useAuthStore.getState().token ? "/dashboard" : "/login");

    if (useAuthStore.persist.hasHydrated()) decide();
    return useAuthStore.persist.onFinishHydration(decide);
  }, [router]);

  return null;
}
