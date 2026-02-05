/**
 * Timezone utility functions for consistent UTC handling across the application
 * Database always stores in UTC, we convert for display only
 */

/** Students can enter the test within this many minutes after scheduled start */
export const EARLY_ACCESS_MINUTES = 30;

/**
 * Parse database timestamp (UTC) to Date object
 * Database format: "2026-02-03 20:15:00+00"
 */
export function parseDbTimestamp(
  timestamp: string | null | undefined,
): Date | null {
  if (!timestamp) return null;

  // Parse as UTC explicitly
  const date = new Date(timestamp);

  // Validate the date
  if (isNaN(date.getTime())) {
    console.error("Invalid timestamp:", timestamp);
    return null;
  }

  return date;
}

/**
 * Convert Date to UTC timestamp for database storage
 * Returns ISO 8601 format that Postgres accepts
 */
export function toDbTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Get current time in UTC for database operations
 */
export function nowUtc(): Date {
  return new Date();
}

/**
 * Check if a scheduled test is currently active (within its scheduled window)
 * @param scheduledAt - When the test started (UTC)
 * @param endedAt - When the test ends (UTC)
 * @returns boolean indicating if test is active
 */
export function isTestActive(
  scheduledAt: string | Date | null,
  endedAt: string | Date | null,
): boolean {
  if (!scheduledAt || !endedAt) return false;

  const now = Date.now();
  const start =
    typeof scheduledAt === "string"
      ? parseDbTimestamp(scheduledAt)?.getTime()
      : scheduledAt.getTime();
  const end =
    typeof endedAt === "string"
      ? parseDbTimestamp(endedAt)?.getTime()
      : endedAt.getTime();

  if (!start || !end) return false;

  return now >= start && now < end;
}

/**
 * Check if a scheduled test is accessible.
 * Students can enter from the scheduled start up to EARLY_ACCESS_MINUTES after.
 * @param scheduledAt - When the test is scheduled to start (UTC)
 * @param endedAt - Unused for access control (kept for compatibility)
 * @returns boolean indicating if test is accessible right now
 */
export function isTestAccessible(
  scheduledAt: string | Date | null,
  endedAt: string | Date | null,
): boolean {
  if (!scheduledAt) return false;

  const now = Date.now();
  const start =
    typeof scheduledAt === "string"
      ? parseDbTimestamp(scheduledAt)?.getTime()
      : scheduledAt.getTime();

  if (!start) return false;

  const accessWindowEnd = start + EARLY_ACCESS_MINUTES * 60 * 1000;
  return now >= start && now <= accessWindowEnd;
}

/**
 * Check if a scheduled test has ended
 */
export function hasTestEnded(endedAt: string | Date | null): boolean {
  if (!endedAt) return false;

  const now = Date.now();
  const end =
    typeof endedAt === "string"
      ? parseDbTimestamp(endedAt)?.getTime()
      : endedAt.getTime();

  return !!end && now >= end;
}

/**
 * Format timestamp for display in user's local timezone
 * @param timestamp - UTC timestamp from database
 * @param format - 'short' | 'long' | 'time-only'
 */
export function formatTimestamp(
  timestamp: string | Date | null,
  format: "short" | "long" | "time-only" = "long",
): string {
  if (!timestamp) return "N/A";

  const date =
    typeof timestamp === "string" ? parseDbTimestamp(timestamp) : timestamp;

  if (!date) return "Invalid Date";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  switch (format) {
    case "short":
      return date.toLocaleString(undefined, {
        ...options,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    case "time-only":
      return date.toLocaleString(undefined, {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    case "long":
    default:
      return date.toLocaleString(undefined, {
        ...options,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  }
}

/**
 * Calculate time remaining until a deadline (in seconds)
 * @param deadline - UTC timestamp
 * @returns seconds remaining (0 if expired)
 */
export function getTimeRemaining(deadline: string | Date | null): number {
  if (!deadline) return 0;

  const end =
    typeof deadline === "string"
      ? parseDbTimestamp(deadline)?.getTime()
      : deadline.getTime();

  if (!end) return 0;

  const remaining = Math.floor((end - Date.now()) / 1000);
  return Math.max(0, remaining);
}
