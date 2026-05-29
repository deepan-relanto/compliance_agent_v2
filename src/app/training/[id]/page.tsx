"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import dynamic from "next/dynamic";

const SlideViewer = dynamic(
  () => import("@/components/employee/slide-viewer").then((mod) => mod.SlideViewer),
  { ssr: false }
);

import { findModuleById } from "@/lib/mock-data";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TrainingModule } from "@/lib/types";

export default function TrainingPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  // Use state so localStorage (uploaded assessments) is read client-side only
  const [trainingModule, setTrainingModule] = useState<TrainingModule | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const found = findModuleById(id);
    setTrainingModule(found);
    setReady(true);
  }, [id]);

  useEffect(() => {
    if (ready && !trainingModule) router.replace("/dashboard");
  }, [ready, trainingModule, router]);

  if (!ready || !trainingModule) return null;

  return (
    <RouteGuard allowedRoles={["user"]}>
      <SlideViewer module={trainingModule} />
    </RouteGuard>
  );
}

