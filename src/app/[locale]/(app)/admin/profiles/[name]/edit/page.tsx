"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { BuilderShell } from "@/components/builder/BuilderShell";

/**
 * Admin visual editor: opens ANY profile inside the builder (gated by the parent
 * admin layout's isAdmin check). Load + save route through the admin endpoints —
 * mirrors the mobile app's WebsiteEditor(Role.admin). `pid` (the real profile id,
 * passed from the control panel) is the definitive admin-update save target.
 */
export default function AdminEditProfilePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = use(params);
  const decoded = decodeURIComponent(name);
  const pid = useSearchParams().get("pid") ?? undefined;
  return <BuilderShell id={decoded} adminName={decoded} adminProfileId={pid} />;
}
