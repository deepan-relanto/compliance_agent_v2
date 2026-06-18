"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { TrainingCompletedGate } from "@/components/employee/training-completed-gate";
import { Button } from "@/components/ui/button";
import type { McqQuestion, TrainingModule } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

const preloadSlideViewer = () =>
  import("@/components/employee/slide-viewer").then((mod) => mod.SlideViewer);

const SlideViewer = dynamic(() => preloadSlideViewer(), { ssr: false });

export default function TrainingPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [freshStart, setFreshStart] = useState(false);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { status: sessionStatus } = useSession();
  const id = typeof params.id === "string" ? params.id : "";

  const [trainingModule, setTrainingModule] = useState<TrainingModule | undefined>();
  const [mcqs, setMcqs] = useState<McqQuestion[]>([]);
  const [ready, setReady] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const authReady =
    sessionStatus !== "loading" &&
    isHydrated &&
    (sessionStatus === "authenticated" ? !!user?.username : true);

  useEffect(() => {
    void preloadSlideViewer();
    setFreshStart(new URLSearchParams(window.location.search).get("fresh") === "1");
  }, []);

  useEffect(() => {
    if (!id || !authReady) return;
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
          setAccessError(null);
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
          setAccessError(
            typeof data.error === "string"
              ? data.error
              : "You do not have access to this training.",
          );
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
  }, [id, user?.username, authReady]);

  useEffect(() => {
    if (!authReady || !ready) return;
    if (!trainingModule && !accessError) router.replace("/dashboard");
  }, [ready, trainingModule, accessError, router, authReady]);

  if (!authReady || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#2e3192]" />
      </div>
    );
  }

  if (accessError) {
    return (
      <RouteGuard allowedRoles={["user"]}>
        <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-zinc-900">
              Training access denied
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{accessError}</p>
            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </Button>
          </div>
        </div>
      </RouteGuard>
    );
  }

  if (!trainingModule) return null;

  if (trainingModule.viewerMode === "already_completed") {
    return (
      <RouteGuard allowedRoles={["user"]}>
        <TrainingCompletedGate moduleTitle={trainingModule.title} />
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["user"]}>
      <SlideViewer module={trainingModule} mcqs={mcqs} freshStart={freshStart} />
    </RouteGuard>
  );
}
