import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/lib/types/api";

/**
 * The `qshot-auth` persist slot is the ONE deliberate exception to the
 * scoped-storage rules in `lib/local-store.ts`: it is a device-level
 * singleton — "who is logged in on this browser" — so it cannot be scoped by
 * account (it IS the account source those scopes resolve from). Do not rename
 * it: the name is the storage key, and changing it force-logs-out every user.
 * Everything else belongs in `lib/local-store.ts`, never in raw localStorage.
 */

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
