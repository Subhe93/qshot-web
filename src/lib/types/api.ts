// Standard API envelope used by the backend: { status, message, data }.
export interface ApiResponse<T = unknown> {
  status: "success" | "error" | string;
  message?: string;
  data: T;
  errors?: Record<string, string[] | string>;
}

export interface AuthUser {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  image?: string | null;
  [key: string]: unknown;
}

export interface LoginResponse {
  token: string;
  user?: AuthUser;
  [key: string]: unknown;
}
