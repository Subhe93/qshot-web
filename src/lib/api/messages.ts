import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

// Contact-form submissions (mobile: form_answers_model.dart).
export interface MessageQuestion {
  type: string; // rating | choices | text | email | phone | date | ...
  data: {
    question?: string;
    description?: string | null;
    required?: boolean;
    choices?: string[] | null;
    choices_type?: string | null;
    stars_number?: number | null;
  };
  answer?: unknown; // number (rating) | string[] (choices) | string (text)
}

export interface MessageAnswer {
  _id: string;
  status: boolean; // true = read, false = unread
  info: { title?: string; questions?: MessageQuestion[] };
  createdAt?: string;
}

// GET q-profile/contact-form/filter?profileId&status
export async function listMessages(profileId: string, read: boolean) {
  const res = await api
    .get("q-profile/contact-form/filter", {
      searchParams: { profileId, status: String(read) },
    })
    .json<ApiResponse<{ answers?: MessageAnswer[] }>>();
  return res.data?.answers ?? [];
}

// POST q-profile/contact-form/update-status — { id, status }
export async function setMessageRead(id: string, read: boolean) {
  return api
    .post("q-profile/contact-form/update-status", {
      body: new URLSearchParams({ id, status: String(read) }),
    })
    .json<ApiResponse<unknown>>();
}
