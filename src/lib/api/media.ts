import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";

/**
 * POST q-profile/image/create — multipart { images }. Mirrors the mobile
 * UploadImageUseCase. Returns the stored file_name(s) (CDN keys, resolve with
 * `cdnUrl`).
 */
export async function uploadImages(files: File[]): Promise<string[]> {
  const body = new FormData();
  for (const f of files) body.append("images", f);
  const res = await api
    .post("q-profile/image/create", { body })
    .json<ApiResponse<{ file_name: string }[]>>();
  return (res.data ?? []).map((d) => d.file_name);
}

export async function uploadImage(file: File): Promise<string | undefined> {
  const [first] = await uploadImages([file]);
  return first;
}
