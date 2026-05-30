"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAllFeedback } from "@/lib/feedback-store";
import type { FeedbackEntry } from "@/lib/types";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

export function FeedbackTable() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);

  // Read from localStorage on mount (client-only)
  useEffect(() => {
    setEntries(getAllFeedback());
  }, []);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <MessageSquare className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />
          <p className="text-sm font-medium text-zinc-500">No feedback submitted yet</p>
          <p className="text-xs text-zinc-400">
            Feedback will appear here after users complete an assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">All feedback</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {entries.length} submission{entries.length !== 1 ? "s" : ""} — newest first
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-medium text-zinc-500">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Assessment</th>
                <th className="px-6 py-3">Submitted</th>
                <th className="px-6 py-3">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-zinc-50 transition-colors hover:bg-zinc-50/50 ${
                    i === entries.length - 1 ? "border-0" : ""
                  }`}
                >
                  <td className="px-6 py-4 align-top">
                    <p className="font-mono text-xs text-zinc-700">{entry.userId}</p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="text-zinc-800">{entry.assessmentName}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                      {entry.assessmentId}
                    </p>
                  </td>
                  <td className="px-6 py-4 align-top whitespace-nowrap text-xs text-zinc-500 tabular-nums">
                    {new Date(entry.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="max-w-sm text-sm text-zinc-700 whitespace-pre-wrap">
                      {entry.feedbackText}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
