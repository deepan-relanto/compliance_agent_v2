"use client";

import Papa from "papaparse";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AUTH_CSV } from "./mock-data";
import type { AuthUser, CsvUserRow } from "./types";

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  setHydrated: () => void;
}

function parseUsers(): CsvUserRow[] {
  const result = Papa.parse<CsvUserRow>(AUTH_CSV, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data.filter((row) => row.username && row.password);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isHydrated: false,
      setHydrated: () => set({ isHydrated: true }),
      login: (username, password) => {
        const normalized = username.trim().toLowerCase();
        const users = parseUsers();
        const match = users.find(
          (u) =>
            u.username.trim().toLowerCase() === normalized &&
            u.password === password,
        );

        if (!match) {
          return { ok: false, error: "Invalid email or password." };
        }

        set({
          user: {
            username: match.username,
            role: match.role,
            batchId: match.batch_id?.trim() || "",
          },
        });
        return { ok: true };
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
