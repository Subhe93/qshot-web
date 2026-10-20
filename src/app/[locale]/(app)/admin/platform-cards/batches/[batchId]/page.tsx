import { use } from "react";
import { BatchDetail } from "@/components/admin/platform-cards/batch-detail";

export default function PlatformCardsBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  return <BatchDetail batchId={decodeURIComponent(batchId)} />;
}
