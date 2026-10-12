"use client";

import { use } from "react";
import { HistoryScreen } from "@/components/history/HistoryScreen";

export default function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <HistoryScreen profileId={id} />;
}
