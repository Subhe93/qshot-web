import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/lib/types/api";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user?: AuthUser | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user = null) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => Boolean(get().token),
    }),
    { name: "qshot-auth" },
  ),
);
