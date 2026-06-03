"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Mail, Search, User } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export interface BatchMember {
  email: string;
  displayName: string;
  role: string;
}

interface BatchMembersListProps {
  members: BatchMember[];
  batchLabel: string;
  analyticsHref?: string;
}

export function BatchMembersList({
  members,
  batchLabel,
  analyticsHref = "/admin/analytics",
}: BatchMembersListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter(
      (m) =>
        m.email.toLowerCase().includes(term) ||
        m.displayName.toLowerCase().includes(term),
    );
  }, [members, search]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b border-zinc-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-label">Roster</p>
              <h2 className="mt-1 text-base font-semibold text-zinc-900">
                Batch members
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {members.length} learner{members.length !== 1 ? "s" : ""} assigned to{" "}
                <span className="font-medium text-zinc-700">{batchLabel}</span>.
                Scores and progress live in{" "}
                <Link href={analyticsHref} className="font-medium text-[#2e3192] hover:underline">
                  Analytics
                </Link>
                .
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="h-9 w-full min-w-[200px] rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#2e3192]/40 focus:outline-none focus:ring-2 focus:ring-[#2e3192]/15 sm:w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="empty-state mx-6 my-10 border-dashed py-12">
              <User className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-zinc-600">No learners in this batch</p>
              <p className="mt-1 text-xs text-zinc-400">
                Members are assigned when users are seeded or synced from HR.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state mx-6 my-10 border-dashed py-12">
              <p className="text-sm font-medium text-zinc-600">No matches for &ldquo;{search}&rdquo;</p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-2 text-xs font-medium text-[#2e3192] hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {filtered.map((member) => (
                <li
                  key={member.email}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50/80"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2e3192]/15 bg-[#2e3192]/6 text-sm font-semibold text-[#2e3192]">
                    {(member.displayName || member.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {member.displayName}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-zinc-500">
                      <Mail className="h-3 w-3 shrink-0" />
                      {member.email}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
                      member.role === "admin"
                        ? "bg-[#2e3192]/10 text-[#2e3192]"
                        : "bg-zinc-100 text-zinc-600",
                    )}
                  >
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
