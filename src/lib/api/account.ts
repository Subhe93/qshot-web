import { api } from "./client";
import type { ApiResponse, AuthUser } from "@/lib/types/api";

export async function getAccount() {
  const res = await api.get("account").json<ApiResponse<AuthUser>>();
  return res.data;
}
