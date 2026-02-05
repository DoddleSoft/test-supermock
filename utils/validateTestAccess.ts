/**
 * Validation utilities for scheduled test access control
 */

import { createClient } from "@/utils/supabase/server";
import {
  isTestAccessible,
  parseDbTimestamp,
  EARLY_ACCESS_MINUTES,
} from "@/utils/timezone";

export interface ScheduledTestValidation {
  isValid: boolean;
  error?: string;
  scheduledTest?: {
    id: string;
    title: string;
    scheduled_at: string;
    ended_at: string;
    status: string;
    duration_minutes: number;
  };
}

/**
 * Validate if a student can access a scheduled test
 * This is the CRITICAL security check - must be called before showing any questions
 */
export async function validateScheduledTestAccess(
  attemptId: string,
): Promise<ScheduledTestValidation> {
  const supabase = await createClient();

  try {
    // Get the attempt with scheduled test details
    const { data: attempt, error: attemptError } = await supabase
      .from("mock_attempts")
      .select(
        `
        id,
        scheduled_test_id,
        status,
        scheduled_tests (
          id,
          title,
          scheduled_at,
          ended_at,
          status,
          duration_minutes
        )
      `,
      )
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return {
        isValid: false,
        error: "Exam attempt not found",
      };
    }

    // Check if this attempt is linked to a scheduled test
    if (!attempt.scheduled_test_id || !attempt.scheduled_tests) {
      return {
        isValid: false,
        error: "This exam is not associated with a scheduled test",
      };
    }

    const scheduledTest = Array.isArray(attempt.scheduled_tests)
      ? attempt.scheduled_tests[0]
      : attempt.scheduled_tests;

    // Normalize scheduled start time for access checks and UI
    const scheduledTime = parseDbTimestamp(scheduledTest.scheduled_at);
    const normalizedScheduledTest = {
      ...scheduledTest,
    };

    // CRITICAL CHECK 1: Test must not be cancelled
    if (scheduledTest.status === "cancelled") {
      return {
        isValid: false,
        error: "This test has been cancelled",
        scheduledTest,
      };
    }

    // CRITICAL CHECK 2: Test must be accessible (scheduled time up to 30 minutes after)
    if (!isTestAccessible(scheduledTest.scheduled_at, scheduledTest.ended_at)) {
      const now = new Date();

      if (scheduledTime && now.getTime() < scheduledTime.getTime()) {
        return {
          isValid: false,
          error: `This test is not accessible yet. It starts at ${scheduledTime.toLocaleString()}`,
          scheduledTest: normalizedScheduledTest,
        };
      }

      return {
        isValid: false,
        error: `This test is no longer accessible. You can enter up to ${EARLY_ACCESS_MINUTES} minutes after the scheduled start time.`,
        scheduledTest: normalizedScheduledTest,
      };
    }

    // CRITICAL CHECK 4: Attempt must not be completed
    if (attempt.status === "completed") {
      return {
        isValid: false,
        error: "You have already completed this exam",
        scheduledTest: normalizedScheduledTest,
      };
    }

    // All checks passed - test is valid and accessible
    return {
      isValid: true,
      scheduledTest: normalizedScheduledTest,
    };
  } catch (error) {
    console.error("Error validating scheduled test access:", error);
    return {
      isValid: false,
      error: "Failed to validate test access. Please contact support.",
    };
  }
}

/**
 * Get the effective end time for a module considering scheduled test constraints
 * Returns the earlier of: module end time or scheduled test end time
 */
export function getEffectiveEndTime(
  moduleEndTime: Date | string,
  scheduledTestEndTime: Date | string | null,
): Date {
  const moduleEnd =
    typeof moduleEndTime === "string"
      ? parseDbTimestamp(moduleEndTime)
      : moduleEndTime;

  const scheduledEnd = scheduledTestEndTime
    ? typeof scheduledTestEndTime === "string"
      ? parseDbTimestamp(scheduledTestEndTime)
      : scheduledTestEndTime
    : null;

  if (!scheduledEnd || !moduleEnd) {
    return moduleEnd || new Date();
  }

  // Return whichever comes first
  return moduleEnd.getTime() < scheduledEnd.getTime()
    ? moduleEnd
    : scheduledEnd;
}
