import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

// Mirrors the mobile SaveFeedbackRequest: multipart { message, image? }.
export async function postFeedback(message: string, image?: File | null) {
  const body = new FormData();
  body.append("message", message);
  if (image) body.append("image", image);
  return api.post("users/feedback", { body }).json<ApiResponse<unknown>>();
}
