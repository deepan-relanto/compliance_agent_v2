"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, MessageSquare } from "lucide-react";
import { useState } from "react";

interface FinalQaFormProps {
  moduleTitle: string;
}

export function FinalQaForm({ moduleTitle }: FinalQaFormProps) {
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-md border border-emerald-200 bg-emerald-50 px-6 py-12 text-center"
      >
        <Check className="mx-auto h-8 w-8 text-emerald-600" strokeWidth={1.5} />
        <p className="mt-4 text-lg font-semibold text-zinc-900">Feedback submitted</p>
        <p className="mt-2 text-sm text-zinc-600">
          Routed to administrators for <span className="font-medium">{moduleTitle}</span>.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#2e3192]" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-zinc-900">Questions for administration</h3>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Submit clarifications or feedback before completing this module.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your question or feedback…"
          rows={4}
          required
          className="flex w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e3192]/25"
        />
        <Button type="submit" variant="secondary">
          Submit to admin
        </Button>
      </form>
    </div>
  );
}
