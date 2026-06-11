import { api } from "./client";
import type { ApiResponse, LoginResponse } from "@/lib/types/api";

// Backend expects application/x-www-form-urlencoded for auth endpoints.
function form(data: Record<string, string>) {
  return new URLSearchParams(data);
}

// Normalize the backend's `{ data: { access_token, ... } }` envelope into the
// `{ token, user }` shape the auth store expects.
function toAuth(data: LoginResponse) {
  return { token: data.access_token, user: data.user ?? null };
}

export async function login(email: string, password: string) {
  const res = await api
    .post("auth/login", { body: form({ email, password }) })
    .json<ApiResponse<LoginResponse>>();
  return toAuth(res.data);
}

export async function register(name: string, email: string, password: string) {
  const res = await api
    .post("auth/register", { body: form({ name, email, password }) })
    .json<ApiResponse<LoginResponse>>();
  return toAuth(res.data);
}

export async function socialLogin(payload: Record<string, string>) {
  const res = await api
    .post("social/login", { body: form(payload) })
    .json<ApiResponse<LoginResponse>>();
  return toAuth(res.data);
}

export async function sendResetEmail(email: string) {
  return api
    .post("auth/send-reset-email", { body: form({ email }) })
    .json<ApiResponse<unknown>>();
}
