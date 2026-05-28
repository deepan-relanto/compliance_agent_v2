"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useEffect } from "react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    setHydrated();
  }, [setHydrated]);

  return <>{children}</>;
}
