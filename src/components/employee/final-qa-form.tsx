"use client";

import { Button } from "@/components/ui/button";
import { submitFeedback } from "@/lib/feedback-store";
import { motion } from "framer-motion";
import { Check, MessageSquare, Star } from "lucide-react";
import { useState } from "react";

interface FinalQaFormProps {
  moduleTitle: string;
  moduleId: string;
  userId: string;
  onSuccess?: () => void;
}

export function FinalQaForm({ moduleTitle, moduleId, userId, onSuccess }: FinalQaFormProps) {
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const ratingPrefix = rating > 0 ? `[Rating: ${rating}/5] ` : "";
    submitFeedback(userId, moduleId, moduleTitle, ratingPrefix + message.trim());
    setSubmitted(true);
    if (onSuccess) {
      onSuccess();
    }
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
          Routed to administrators for{" "}
          <span className="font-medium">{moduleTitle}</span>.
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
        {/* Optional star rating */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">
            Rating <span className="text-zinc-400">(optional)</span>
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star === rating ? 0 : star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e3192]/30"
                aria-label={`Rate ${star} out of 5`}
              >
                <Star
                  className="h-5 w-5 transition-colors"
                  fill={(hoveredStar || rating) >= star ? "#f15a24" : "none"}
                  stroke={(hoveredStar || rating) >= star ? "#f15a24" : "#d4d4d8"}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        </div>

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
