"use client";

import { use } from "react";
import { BookingDashboard } from "@/components/booking/BookingDashboard";

export default function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BookingDashboard profileId={id} />;
}
