import { createClient } from "@/utils/supabase/client";
import { EARLY_ACCESS_MINUTES } from "@/utils/timezone";

export interface ScheduledTest {
  id: string;
  center_id: string;
  paper_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  created_at?: string;
  paper?: {
    id: string;
    title: string;
    paper_type: string;
  } | null;
  center?: {
    center_id: string;
    name: string;
    slug: string;
  } | null;
}

export interface TestStatus {
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  countdown?: string;
  canJoin: boolean;
  message?: string; // ✅ add this
}

/**
 * Determine test status based on scheduled time and current status
 */
export function getTestStatus(test: ScheduledTest): TestStatus {
  const now = new Date();
  const scheduledTime = new Date(test.scheduled_at);

  const endTime = new Date(
    scheduledTime.getTime() + test.duration_minutes * 60000,
  );

  const joinCutoffTime = new Date(
    scheduledTime.getTime() + 30 * 60 * 1000, // 30 min after start
  );

  // Cancelled
  if (test.status === "cancelled") {
    return {
      status: "cancelled",
      canJoin: false,
      message: "Test cancelled",
    };
  }

  // Test fully ended
  if (now >= endTime || test.status === "completed") {
    return {
      status: "completed",
      canJoin: false,
      message: "Test ended",
    };
  }

  // Test started but join window closed (after 30 min)
  if (now >= joinCutoffTime && now < endTime) {
    return {
      status: "in_progress",
      canJoin: false,
      message: "Cannot join the test now",
    };
  }

  // Test live and join allowed
  if (now >= scheduledTime && now < joinCutoffTime) {
    return {
      status: "in_progress",
      canJoin: true,
      message: "Test in progress",
    };
  }

  // Scheduled (before start)
  if (now < scheduledTime) {
    const diffMs = scheduledTime.getTime() - now.getTime();
    const totalMinutes = Math.floor(diffMs / 60000);

    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    return {
      status: "scheduled",
      canJoin: false,
      countdown: `Starts in ${days}d ${hours}h ${minutes}m`,
      message: `Starts in ${days}d ${hours}h ${minutes}m`,
    };
  }

  return {
    status: "scheduled",
    canJoin: false,
    message: "Test scheduled",
  };
}

/**
 * Fetch scheduled tests for a center using security view (OTP excluded)
 */
export async function fetchScheduledTests(
  centerSlug: string,
): Promise<{ tests: ScheduledTest[]; error?: string }> {
  try {
    const supabase = createClient();

    // Get center by slug
    const { data: center, error: centerError } = await supabase
      .from("centers")
      .select("center_id, name, slug")
      .eq("slug", centerSlug)
      .single();

    if (centerError || !center) {
      return { tests: [], error: "Center not found" };
    }

    // Get start of today in UTC (not local) to avoid timezone filtering issues
    const today = new Date();
    // Subtract early access window + some buffer so we don't accidentally filter out today's tests
    const filterDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // Fetch scheduled tests using security view (OTP excluded)
    const { data, error } = await supabase
      .from("available_tests_view")
      .select("*")
      .eq("center_id", center.center_id)
      .gte("scheduled_at", filterDate.toISOString())
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("Error fetching scheduled tests:", error);
      return { tests: [], error: "Failed to fetch tests" };
    }

    if (!data || data.length === 0) {
      return { tests: [] };
    }

    // Get paper details for each test
    const paperIds = [...new Set(data.map((t) => t.paper_id).filter(Boolean))];
    const { data: papers } = await supabase
      .from("papers")
      .select("id, paper_type, title")
      .in("id", paperIds);

    // Combine data with center and paper info
    const tests = data.map((test) => ({
      ...test,
      center: {
        center_id: center.center_id,
        name: center.name,
        slug: center.slug,
      },
      paper: papers?.find((p) => p.id === test.paper_id) || null,
    }));

    return { tests: tests as unknown as ScheduledTest[] };
  } catch (error) {
    console.error("Error in fetchScheduledTests:", error);
    return { tests: [], error: "An unexpected error occurred" };
  }
}

/**
 * Format date for display
 */
export function formatTestDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format time for display
 */
export function formatTestTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Join a mock test using OTP
 */
export async function joinMockTest(
  otp: string,
  scheduledTestId: string,
  userEmail: string,
): Promise<{
  success: boolean;
  attemptId?: string;
  paperId?: string;
  status?: string;
  error?: string;
}> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase.rpc("join_mock_test", {
      p_otp: parseInt(otp),
      p_scheduled_test_id: scheduledTestId,
      p_user_email: userEmail,
    });

    if (error) {
      console.error("Error joining mock test:", error);
      return {
        success: false,
        error: error.message || "Failed to join test",
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Invalid response from server",
      };
    }

    const result = data[0];

    return {
      success: true,
      attemptId: result.attempt_id,
      paperId: result.paper_id,
      status: result.status,
    };
  } catch (error) {
    console.error("Error in joinMockTest:", error);
    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}

/**
 * Check if user has an existing attempt for this test
 */
export async function checkExistingAttempt(
  userEmail: string,
  paperId: string,
): Promise<{
  exists: boolean;
  attemptId?: string;
  status?: string;
}> {
  try {
    const supabase = createClient();

    // First get student_id from email
    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select("student_id")
      .eq("email", userEmail)
      .single();

    if (profileError || !profile) {
      return { exists: false };
    }

    // Check for existing attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("mock_attempts")
      .select("id, status")
      .eq("student_id", profile.student_id)
      .eq("paper_id", paperId)
      .in("status", ["in_progress", "pending"])
      .single();

    if (attemptError || !attempt) {
      return { exists: false };
    }

    return {
      exists: true,
      attemptId: attempt.id,
      status: attempt.status,
    };
  } catch (error) {
    console.error("Error checking existing attempt:", error);
    return { exists: false };
  }
}
