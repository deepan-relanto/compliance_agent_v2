"use client";

import { RelantoLogo } from "@/components/brand/relanto-logo";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EmployeeShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function EmployeeShell({ children, title, subtitle }: EmployeeShellProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-50/70">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/dashboard">
            <RelantoLogo size="sm" showTagline className="justify-start" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-zinc-900">{user?.username}</p>
              {user?.batchId && (
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  {user.batchId.replace("_", " ")}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {(title || subtitle) && (
        <div className="border-b border-zinc-100 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-7">
            {title && (
              <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1.5 text-[14px] text-zinc-500">{subtitle}</p>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
