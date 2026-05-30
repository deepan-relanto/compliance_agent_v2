"use client";

import { RelantoLogo } from "@/components/brand/relanto-logo";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronLeft,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    isActive: (path: string) => path === "/admin",
  },
  {
    href: "/admin/batches",
    label: "Batches",
    icon: LayoutGrid,
    isActive: (path: string) =>
      path === "/admin/batches" || path.startsWith("/admin/batch/"),
  },
  {
    href: "/admin/upload",
    label: "Upload PDF",
    icon: Upload,
    isActive: (path: string) => path.startsWith("/admin/upload"),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: BarChart3,
    isActive: (path: string) => path.startsWith("/admin/analytics"),
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    icon: MessageSquare,
    isActive: (path: string) => path.startsWith("/admin/feedback"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    isActive: (path: string) => path.startsWith("/admin/settings"),
  },
];

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}

export function AdminShell({
  children,
  title,
  subtitle,
  backHref,
  backLabel = "All batches",
}: AdminShellProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-zinc-50/80">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-5 py-4">
          <Link href="/admin">
            <RelantoLogo size="sm" showTagline className="justify-start" />
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#2e3192]/8 text-[#2e3192]"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                )}
              >
                <item.icon
                  className={cn("h-4 w-4 shrink-0", active && "text-[#2e3192]")}
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-100 p-4">
          <p className="truncate text-xs text-zinc-500">{user?.username}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start px-0 text-zinc-600"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pl-[240px]">
        <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-sm">
          <div className="flex min-h-[64px] items-center justify-between px-8">
            <div>
              {backHref && (
                <Link
                  href={backHref}
                  className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-[#2e3192]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {backLabel}
                </Link>
              )}
              {title && (
                <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
