/**
 * Integration utilities for using the timer with scheduled tests
 * Ensures proper timezone handling and end time calculation
 */

import {
  parseDbTimestamp,
  getTimeRemaining,
  EARLY_ACCESS_MINUTES,
} from "./timezone";

export interface TimerEndTimes {
  moduleEndTime: Date;
  globalExamEndTime: Date;
  effectiveEndTime: Date;
}

/**
 * Calculate timer end times for a module within a scheduled test
 *
 * @param moduleStartedAt - When the module was started (UTC timestamp from DB)
 * @param moduleTimeRemainingSeconds - Time remaining in the module (seconds)
 * @param scheduledTestEndedAt - When the scheduled test ends (UTC timestamp from DB)
 * @returns Calculated end times for the timer
 */
export function calculateTimerEndTimes(
  moduleStartedAt: string | Date | null,
  moduleTimeRemainingSeconds: number,
  scheduledTestEndedAt: string | Date | null,
): TimerEndTimes {
  // Parse module start time
  const moduleStart = moduleStartedAt
    ? typeof moduleStartedAt === "string"
      ? parseDbTimestamp(moduleStartedAt)
      : moduleStartedAt
    : null;

  // Calculate module end time (start + remaining time)
  const moduleEndTime = moduleStart
    ? new Date(moduleStart.getTime() + moduleTimeRemainingSeconds * 1000)
    : new Date(Date.now() + moduleTimeRemainingSeconds * 1000);

  // Parse scheduled test end time
  const scheduledEnd = scheduledTestEndedAt
    ? typeof scheduledTestEndedAt === "string"
      ? parseDbTimestamp(scheduledTestEndedAt)
      : scheduledTestEndedAt
    : null;

  // Global exam end time is either the scheduled test end or module end (whichever is later)
  const globalExamEndTime = scheduledEnd || moduleEndTime;

  // Effective end time is the earlier of module end or scheduled test end
  const effectiveEndTime =
    scheduledEnd && scheduledEnd.getTime() < moduleEndTime.getTime()
      ? scheduledEnd
      : moduleEndTime;

  return {
    moduleEndTime,
    globalExamEndTime,
    effectiveEndTime,
  };
}

/**
 * Validate that a timer can be started (test hasn't ended)
 */
export function canStartTimer(
  scheduledTestEndedAt: string | Date | null,
): boolean {
  if (!scheduledTestEndedAt) return true;

  const endTime =
    typeof scheduledTestEndedAt === "string"
      ? parseDbTimestamp(scheduledTestEndedAt)
      : scheduledTestEndedAt;

  if (!endTime) return true;

  return Date.now() < endTime.getTime();
}
