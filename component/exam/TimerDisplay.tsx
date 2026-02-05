"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { TimerPhase } from "@/hooks/useExamTimer";

export interface TimerDisplayProps {
  effectiveTimeLeft: number;
  globalTimeLeft: number;
  moduleTimeLeft: number;
  phase: TimerPhase;
  formatTime: (seconds: number) => string;
  moduleType?: string;
  showGlobalTimer?: boolean;
}

export default function TimerDisplay({
  effectiveTimeLeft,
  globalTimeLeft,
  moduleTimeLeft,
  phase,
  formatTime,
  moduleType = "Module",
  showGlobalTimer = true,
}: TimerDisplayProps) {
  // Determine color based on phase
  const getPhaseColors = () => {
    switch (phase) {
      case "expired":
        return {
          bg: "bg-red-100",
          text: "text-red-900",
          border: "border-red-300",
          icon: "text-red-600",
        };
      case "safety":
        return {
          bg: "bg-red-50",
          text: "text-red-900",
          border: "border-red-200",
          icon: "text-red-600",
        };
      case "warning":
        return {
          bg: "bg-yellow-50",
          text: "text-yellow-900",
          border: "border-yellow-200",
          icon: "text-yellow-600",
        };
      default:
        return {
          bg: "bg-white",
          text: "text-gray-900",
          border: "border-gray-200",
          icon: "text-gray-600",
        };
    }
  };

  const colors = getPhaseColors();

  // Show warning indicator for critical phases
  const showWarningIndicator = phase === "warning" || phase === "safety";

  return (
    <div className="flex flex-col gap-2">
      {/* Main Timer - Effective Time */}
      <div
        className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${colors.bg} ${colors.border} transition-all duration-300`}
      >
        {showWarningIndicator && (
          <AlertTriangle className={`h-5 w-5 ${colors.icon} animate-pulse`} />
        )}
        <Clock className={`h-5 w-5 ${colors.icon}`} />
        <div className="flex flex-col">
          <span className="text-xs text-gray-600 font-medium">
            {moduleType} Time
          </span>
          <span className={`text-2xl font-bold ${colors.text} tabular-nums`}>
            {formatTime(effectiveTimeLeft)}
          </span>
        </div>
        {phase === "expired" && (
          <span className="ml-auto text-xs font-semibold text-red-600 uppercase">
            Time&apos;s Up
          </span>
        )}
      </div>

      {/* Secondary Timer - Global Time (Optional) */}
      {showGlobalTimer && globalTimeLeft !== moduleTimeLeft && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 border border-gray-100">
          <span className="text-xs text-gray-500">Test Center Closes:</span>
          <span className="text-sm font-semibold text-gray-700 tabular-nums">
            {formatTime(globalTimeLeft)}
          </span>
        </div>
      )}

      {/* Phase Indicator */}
      {phase === "warning" && (
        <div className="px-3 py-1.5 rounded-md bg-yellow-50 border border-yellow-200">
          <p className="text-xs text-yellow-800 font-medium">
            ⚠️ Less than 5 minutes remaining
          </p>
        </div>
      )}

      {phase === "safety" && (
        <div className="px-3 py-1.5 rounded-md bg-red-50 border border-red-200">
          <p className="text-xs text-red-800 font-medium">
            🔴 Final minute - Auto-saving your answers
          </p>
        </div>
      )}
    </div>
  );
}
