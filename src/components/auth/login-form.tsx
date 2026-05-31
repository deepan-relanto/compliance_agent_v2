"use client";

import { RelantoLogo } from "@/components/brand/relanto-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const login = useAuthStore((s) => s.login);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Login failed.");
      return;
    }

    const user = useAuthStore.getState().user;
    router.push(user?.role === "admin" ? "/admin" : "/dashboard");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="mb-7 lg:hidden">
        <RelantoLogo size="md" showTagline />
      </div>

      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        Sign in
      </h1>
      <p className="mt-1.5 text-sm text-zinc-500">
        Mandatory training portal for Relanto employees.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Work email
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              strokeWidth={1.5}
            />
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="user1@relnto.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Password
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              strokeWidth={1.5}
            />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" className="mt-1 w-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Continue"}
          {!loading && <ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Demo accounts
        </p>
        <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-zinc-600">
          <li>admin@relnto.com / admin123</li>
          <li>user1@relnto.com / user123</li>
        </ul>
      </div>
    </motion.div>
  );
}
