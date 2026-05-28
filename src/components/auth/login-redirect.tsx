"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LoginRedirect() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated || !user) return;
    router.replace(user.role === "admin" ? "/admin" : "/dashboard");
  }, [user, isHydrated, router]);

  return null;
}
