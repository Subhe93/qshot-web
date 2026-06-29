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

/**
 * POST q-profile/video/upload — multipart { video }. Mirrors the mobile
 * UploadVideoUseCase (links.websiteVideoUpload); the backend returns the stored
 * `file_name` (CDN key, resolve with `cdnUrl`). Timeout is disabled since video
 * uploads can take a while.
 */
export async function uploadVideo(file: File): Promise<string | undefined> {
  const body = new FormData();
  body.append("video", file);
  const res = await api
    .post("q-profile/video/upload", { body, timeout: false })
    .json<{ file_name?: string; data?: { file_name?: string } }>();
  return res?.file_name ?? res?.data?.file_name;
}
