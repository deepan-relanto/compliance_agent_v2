"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import type { McqQuestion, TrainingModule } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const SlideViewer = dynamic(
  () => import("@/components/employee/slide-viewer").then((mod) => mod.SlideViewer),
  { ssr: false },
);

export default function TrainingPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const id = typeof params.id === "string" ? params.id : "";

  const [trainingModule, setTrainingModule] = useState<TrainingModule | undefined>();
  const [mcqs, setMcqs] = useState<McqQuestion[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    const query = user?.username
      ? `?userEmail=${encodeURIComponent(user.username)}`
      : "";
    const controller = new AbortController();
    fetch(`/api/modules/${encodeURIComponent(id)}${query}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setTrainingModule(data.module);
          setMcqs(data.mcqs ?? []);
          const pdf = data.module?.pdfUrl as string | undefined;
          if (pdf && typeof window !== "undefined") {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = pdf;
            document.head.appendChild(link);
          }
        } else {
          setTrainingModule(undefined);
        }
        setReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTrainingModule(undefined);
          setReady(true);
        }
      });
    return () => controller.abort();
  }, [id, user?.username]);

  useEffect(() => {
    if (ready && !trainingModule) router.replace("/dashboard");
  }, [ready, trainingModule, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#2e3192]" />
      </div>
    );
  }

  if (!trainingModule) return null;

  return (
    <RouteGuard allowedRoles={["user"]}>
      <SlideViewer module={trainingModule} mcqs={mcqs} />
    </RouteGuard>
  );
}
