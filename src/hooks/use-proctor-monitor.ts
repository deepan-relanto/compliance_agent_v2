"use client";

import {
  addWarning,
  getProgress,
  isProctorLocked,
  markInProgress,
} from "@/lib/progress-store";
import { syncProctorWarning } from "@/lib/progress-api";
import {
  isProctorViolationReason,
  type ProctorViolationReason,
} from "@/lib/proctor/violations";
import type { ModuleStatus, WarningHistoryEntry } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const BLUR_FOCUS_LOSS_MS = 1500;

interface UseProctorMonitorOptions {
  enabled: boolean;
  username: string | undefined;
  moduleId: string;
  moduleTitle: string;
  batchId: string;
  totalSlides: number;
  reviewOnlyMode: boolean;
  blockEscape?: boolean;
  onLockout: () => void;
  onStatusChange?: (status: ModuleStatus) => void;
}

export function useProctorMonitor({
  enabled,
  username,
  moduleId,
  moduleTitle,
  batchId,
  totalSlides,
  reviewOnlyMode,
  blockEscape = false,
  onLockout,
  onStatusChange,
}: UseProctorMonitorOptions) {
  const [activeReason, setActiveReason] = useState<ProctorViolationReason | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [warningHistory, setWarningHistory] = useState<WarningHistoryEntry[]>([]);

  const ignoreNextFullscreenEntryRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExitingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const usernameRef = useRef(username);

  enabledRef.current = enabled;
  usernameRef.current = username;

  const clearBlurTimeout = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  const applyProgress = useCallback(
    (updated: ReturnType<typeof addWarning>) => {
      if (typeof updated.warningCount !== "number") return null;

      setWarningCount(updated.warningCount);
      setWarningHistory(updated.warningHistory ?? []);
      onStatusChange?.(updated.status);

      if (username) {
        void syncProctorWarning({
          userEmail: username,
          moduleId,
          warningCount: updated.warningCount,
          warningHistory: updated.warningHistory ?? [],
          status: updated.status,
          failedReason: updated.failedReason ?? null,
        });
      }

      if (isProctorLocked(updated)) {
        onLockout();
        setActiveReason(null);
        return null;
      }

      return updated;
    },
    [moduleId, onLockout, onStatusChange, username],
  );

  const recordViolation = useCallback(
    (reason: ProctorViolationReason): boolean => {
      if (!enabledRef.current || isExitingRef.current || !usernameRef.current) {
        return false;
      }

      const user = usernameRef.current;
      let progress = getProgress(user, moduleId);

      if (!progress) {
        markInProgress(user, moduleId, moduleTitle, batchId, totalSlides);
        progress = getProgress(user, moduleId);
      }

      if (progress?.status === "completed") {
        return false;
      }

      if (
        progress &&
        (progress.status === "permanently_failed" ||
          (isProctorLocked(progress) && (progress.warningCount ?? 0) >= 3))
      ) {
        onLockout();
        return false;
      }

      const previousCount = progress?.warningCount ?? 0;
      const updated = addWarning(user, moduleId, reason);
      const applied = applyProgress(updated);
      if (!applied) return false;

      if (applied.warningCount > previousCount) {
        setActiveReason(reason);
        return true;
      }

      return false;
    },
    [applyProgress, batchId, moduleId, moduleTitle, onLockout, totalSlides],
  );

  const handleWarningContinue = useCallback(async () => {
    ignoreNextFullscreenEntryRef.current = true;
    clearBlurTimeout();
    setActiveReason(null);

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* browser may block until user gesture — continue anyway */
    }
  }, [clearBlurTimeout]);

  const activeReasonRef = useRef<ProctorViolationReason | null>(null);
  activeReasonRef.current = activeReason;

  const escTriggeredExitRef = useRef(false);

  const handleEscapeViolation = useCallback(async () => {
    if (!enabledRef.current || isExitingRef.current || !usernameRef.current || blockEscape) {
      return;
    }
    if (activeReasonRef.current) return;

    clearBlurTimeout();

    // Record the violation immediately — don't wait for fullscreenchange
    const recorded = recordViolation("Exited Fullscreen");

    // If we recorded a new warning, the fullscreenchange from the browser's
    // native ESC-exit will see escTriggeredExitRef and skip double-counting.
    if (recorded) {
      escTriggeredExitRef.current = true;
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }, [blockEscape, clearBlurTimeout, recordViolation]);

  const hydrateFromProgress = useCallback(
    (progress: {
      warningCount: number;
      warningHistory: WarningHistoryEntry[];
      status: ModuleStatus;
    } | null) => {
      if (!progress) {
        setWarningCount(0);
        setWarningHistory([]);
        setActiveReason(null);
        return;
      }
      setWarningCount(progress.warningCount ?? 0);
      setWarningHistory(progress.warningHistory ?? []);
      if (isProctorLocked(progress)) {
        onLockout();
        setActiveReason(null);
      }
    },
    [onLockout],
  );

  useEffect(() => {
    if (reviewOnlyMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      void handleEscapeViolation();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleEscapeViolation, reviewOnlyMode]);

  useEffect(() => {
    if (reviewOnlyMode) return;

    const onFullscreenChange = () => {
      if (!enabledRef.current || isExitingRef.current) return;

      if (document.fullscreenElement !== null) {
        // Fullscreen was ENTERED — ignore if we requested it (e.g. after Continue)
        if (ignoreNextFullscreenEntryRef.current) {
          ignoreNextFullscreenEntryRef.current = false;
        }
        return;
      }

      // Fullscreen was EXITED
      if (escTriggeredExitRef.current) {
        // The keydown handler already recorded this violation — skip to avoid double-count
        escTriggeredExitRef.current = false;
        return;
      }

      recordViolation("Exited Fullscreen");
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [recordViolation, reviewOnlyMode]);

  useEffect(() => {
    if (reviewOnlyMode) return;

    const onVisibilityChange = () => {
      if (!enabledRef.current || isExitingRef.current) return;
      if (document.visibilityState !== "hidden") return;

      clearBlurTimeout();
      recordViolation("Switched Browser Tab");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [clearBlurTimeout, recordViolation, reviewOnlyMode]);

  useEffect(() => {
    if (reviewOnlyMode) return;

    const onBlur = () => {
      if (!enabledRef.current || isExitingRef.current) return;
      if (document.visibilityState === "hidden") return;

      clearBlurTimeout();
      blurTimeoutRef.current = setTimeout(() => {
        if (!enabledRef.current || document.visibilityState === "hidden") return;
        recordViolation("Window Lost Focus");
      }, BLUR_FOCUS_LOSS_MS);
    };

    const onFocus = () => clearBlurTimeout();

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      clearBlurTimeout();
    };
  }, [clearBlurTimeout, recordViolation, reviewOnlyMode]);

  useEffect(() => {
    if (reviewOnlyMode || !username) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExitingRef.current) return;
      const progress = getProgress(username, moduleId);
      if (
        progress &&
        (progress.status === "completed" || isProctorLocked(progress))
      ) {
        return;
      }

      addWarning(username, moduleId, "Attempted Navigation");
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [moduleId, reviewOnlyMode, username]);

  return {
    activeReason,
    warningCount,
    warningHistory,
    handleWarningContinue,
    recordViolation,
    hydrateFromProgress,
    isExitingRef,
    ignoreNextFullscreenEntryRef,
  };
}

export function toProctorViolationReason(reason: string | null): ProctorViolationReason | null {
  if (!reason || !isProctorViolationReason(reason)) return null;
  return reason;
}
