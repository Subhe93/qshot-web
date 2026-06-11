"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    const decide = () =>
      router.replace(useAuthStore.getState().token ? "/dashboard" : "/login");

    if (useAuthStore.persist.hasHydrated()) decide();
    return useAuthStore.persist.onFinishHydration(decide);
  }, [router]);

  return null;
}
