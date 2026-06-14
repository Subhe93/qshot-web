import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

export type StatType = "views" | "clicks";

export interface DailyData {
  count: number;
  date: string;
  templateName?: string;
}

export interface CountryView {
  number: number;
  country: string;
  countryCode: string;
}

export interface ModuleClick {
  name: string;
  count: number;
}

export interface WebsiteStatistics {
  details: {
    totalData: number;
    totalDataPrevious: number;
    dailyData: DailyData[];
  };
  countryView: CountryView[];
  moduleClicks: Record<string, ModuleClick[]>;
}

// Mirrors mobile GetWebsiteStatisticsUseCase →
// GET q-profile/total-statistics/details/custom-profile
export async function getWebsiteStatistics(params: {
  id: string;
  type: StatType;
  date: number; // mobile StatisticsDateRange.value: 1 | 3 | 6 | 365 (NOT days)
}): Promise<WebsiteStatistics> {
  const res = await api
    .get("q-profile/total-statistics/details/custom-profile", {
      searchParams: {
        userProfileTemplateId: params.id,
        type: params.type,
        date: String(params.date),
      },
    })
    .json<ApiResponse<WebsiteStatistics>>();
  return (
    res.data ?? {
      details: { totalData: 0, totalDataPrevious: 0, dailyData: [] },
      countryView: [],
      moduleClicks: {},
    }
  );
}
