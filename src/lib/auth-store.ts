"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "./types";

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isHydrated: false,
      setHydrated: () => set({ isHydrated: true }),
      login: async (username, password) => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, password }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            return { ok: false, error: data.error ?? "Invalid email or password." };
          }
          set({ user: data.user });
          return { ok: true };
        } catch {
          return { ok: false, error: "Could not reach the server." };
        }
      },
      logout: () => set({ user: null }),
    }),
    {
      name: "compliance-agent-auth",
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
