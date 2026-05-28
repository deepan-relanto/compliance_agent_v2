"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { SlideViewer } from "@/components/employee/slide-viewer";
import { TRAINING_MODULES } from "@/lib/mock-data";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TrainingPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const trainingModule = TRAINING_MODULES.find((m) => m.id === id);

  useEffect(() => {
    if (!trainingModule) router.replace("/dashboard");
  }, [trainingModule, router]);

  if (!trainingModule) return null;

  return (
    <RouteGuard allowedRoles={["user"]}>
      <SlideViewer module={trainingModule} />
    </RouteGuard>
  );
}
