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
  ShieldAlert,
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
    href: "/admin/monitoring",
    label: "Monitoring",
    icon: ShieldAlert,
    isActive: (path: string) => path.startsWith("/admin/monitoring"),
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
    <div className="flex min-h-screen page-bg">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-zinc-200/90 bg-white">
        <div className="border-b border-zinc-100 px-5 py-5">
          <Link href="/admin">
            <RelantoLogo size="sm" showTagline className="justify-start" />
          </Link>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Admin console
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#2e3192] text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-white" : "text-zinc-400",
                  )}
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-100 p-4">
          <div className="mb-3 flex items-center gap-2.5 rounded-lg bg-zinc-50 px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#2e3192] text-[10px] font-semibold text-white">
              A
            </div>
            <p className="min-w-0 truncate text-xs font-medium text-zinc-700">
              {user?.username}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-zinc-600"
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

      <div className="flex min-h-screen flex-1 flex-col pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
          <div className="flex min-h-[68px] items-center px-6 sm:px-8">
            <div>
              {backHref && (
                <Link
                  href={backHref}
                  className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-[#2e3192]"
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
                <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
