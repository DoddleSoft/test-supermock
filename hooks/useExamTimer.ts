import { useState, useEffect, useRef, useCallback } from "react";

export type TimerPhase = "normal" | "warning" | "safety" | "expired";

export interface UseExamTimerProps {
  moduleEndTime: string | Date;
  globalExamEndTime: string | Date;
  onAutoSave: () => Promise<void>;
  onForceSubmit: () => void;
  enabled?: boolean;
}

export interface UseExamTimerReturn {
  effectiveTimeLeft: number;
  moduleTimeLeft: number;
  globalTimeLeft: number;
  phase: TimerPhase;
  showWarningModal: boolean;
  dismissWarning: () => void;
  formatTime: (seconds: number) => string;
  isExpired: boolean;
}

const SYNC_INTERVAL = 30000; // 30 seconds
const WARNING_THRESHOLD = 300; // 5 minutes
const SAFETY_THRESHOLD = 60; // 1 minute

export function useExamTimer({
  moduleEndTime,
  globalExamEndTime,
  onAutoSave,
  onForceSubmit,
  enabled = true,
}: UseExamTimerProps): UseExamTimerReturn {
  const [effectiveTimeLeft, setEffectiveTimeLeft] = useState(0);
  const [moduleTimeLeft, setModuleTimeLeft] = useState(0);
  const [globalTimeLeft, setGlobalTimeLeft] = useState(0);
  const [phase, setPhase] = useState<TimerPhase>("normal");
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Refs to prevent duplicate execution
  const warningShownRef = useRef(false);
  const safetyExecutedRef = useRef(false);
  const expiredExecutedRef = useRef(false);
  const lastSyncRef = useRef(Date.now());
  const animationFrameRef = useRef<number>(0);

  // Parse end times
  const moduleEndMs = useRef(new Date(moduleEndTime).getTime());
  const globalEndMs = useRef(new Date(globalExamEndTime).getTime());

  // Update end times if they change
  useEffect(() => {
    moduleEndMs.current = new Date(moduleEndTime).getTime();
    globalEndMs.current = new Date(globalExamEndTime).getTime();
  }, [moduleEndTime, globalExamEndTime]);

  // Calculate remaining time (drift-free)
  const calculateTimeLeft = useCallback(() => {
    const now = Date.now();

    const moduleRemaining = Math.max(
      0,
      Math.floor((moduleEndMs.current - now) / 1000),
    );
    const globalRemaining = Math.max(
      0,
      Math.floor((globalEndMs.current - now) / 1000),
    );
    const effectiveRemaining = Math.min(moduleRemaining, globalRemaining);

    return {
      module: moduleRemaining,
      global: globalRemaining,
      effective: effectiveRemaining,
    };
  }, []);

  // Background sync every 30 seconds
  const performSync = useCallback(async () => {
    const now = Date.now();
    if (now - lastSyncRef.current >= SYNC_INTERVAL) {
      lastSyncRef.current = now;
      // Recalculate from server time if needed
      // This is where you'd call a lightweight API to verify time
      console.log("[Timer] Background sync check");
    }
  }, []);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Dismiss warning modal
  const dismissWarning = useCallback(() => {
    setShowWarningModal(false);
  }, []);

  // Phase transition logic
  const handlePhaseTransitions = useCallback(
    async (time: { module: number; global: number; effective: number }) => {
      // Phase 4: Hard Stop (Expired)
      if (time.effective <= 0 && !expiredExecutedRef.current) {
        expiredExecutedRef.current = true;
        setPhase("expired");
        setIsExpired(true);
        console.log("[Timer] Phase 4: Hard Stop - Force Submit");
        onForceSubmit();
        return;
      }

      // Phase 3: Safety Net (≤ 1 minute)
      if (
        time.global <= SAFETY_THRESHOLD &&
        time.global > 0 &&
        !safetyExecutedRef.current
      ) {
        safetyExecutedRef.current = true;
        setPhase("safety");
        console.log("[Timer] Phase 3: Safety Net - Auto-saving");

        try {
          await onAutoSave();
        } catch (error) {
          console.error("[Timer] Auto-save failed:", error);
        }
        return;
      }

      // Phase 2: Warning (≤ 5 minutes)
      if (
        time.global <= WARNING_THRESHOLD &&
        time.global > SAFETY_THRESHOLD &&
        !warningShownRef.current
      ) {
        warningShownRef.current = true;
        setPhase("warning");
        setShowWarningModal(true);
        console.log("[Timer] Phase 2: Warning - Show Modal");
        return;
      }

      // Phase 1: Normal
      if (time.global > WARNING_THRESHOLD) {
        setPhase("normal");
      }
    },
    [onAutoSave, onForceSubmit],
  );

  // Main timer tick loop (using requestAnimationFrame for precision)
  useEffect(() => {
    if (!enabled) return;

    let lastFrameTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const delta = now - lastFrameTime;

      // Only update if at least ~100ms has passed (prevents excessive renders)
      if (delta >= 100) {
        lastFrameTime = now;

        const time = calculateTimeLeft();

        setModuleTimeLeft(time.module);
        setGlobalTimeLeft(time.global);
        setEffectiveTimeLeft(time.effective);

        // Handle phase transitions
        handlePhaseTransitions(time);

        // Background sync check
        performSync();
      }

      // Continue the loop
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, calculateTimeLeft, handlePhaseTransitions, performSync]);

  return {
    effectiveTimeLeft,
    moduleTimeLeft,
    globalTimeLeft,
    phase,
    showWarningModal,
    dismissWarning,
    formatTime,
    isExpired,
  };
}
