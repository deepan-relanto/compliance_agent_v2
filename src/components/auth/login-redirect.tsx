"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LoginRedirect() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading" || !isHydrated) return;
    if (status === "authenticated" && user) {
      router.replace(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [user, isHydrated, status, router]);

  return null;
}
