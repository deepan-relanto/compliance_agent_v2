"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import type { McqQuestion, TrainingModule } from "@/lib/types";
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
  const id = typeof params.id === "string" ? params.id : "";

  const [trainingModule, setTrainingModule] = useState<TrainingModule | undefined>();
  const [mcqs, setMcqs] = useState<McqQuestion[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/modules/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setTrainingModule(data.module);
          setMcqs(data.mcqs ?? []);
        } else {
          setTrainingModule(undefined);
        }
        setReady(true);
      })
      .catch(() => {
        setTrainingModule(undefined);
        setReady(true);
      });
  }, [id]);

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
