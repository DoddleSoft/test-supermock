/**
 * Module access validation utility
 * Calls RPC to check if student can access a specific module
 */

import { createClient } from "@/utils/supabase/server";

export interface ModuleAccessResult {
  allowed: boolean;
  error?: string;
  error_code?: string;
  attempt_module_id?: string;
  module_status?: string;
  time_remaining_seconds?: number;
  started_at?: string;
  completed_at?: string;
}

/**
 * Validate if a student can access a specific module type
 * This is the CRITICAL security check for module access
 * Prevents re-entry to completed modules
 */
export async function validateModuleAccess(
  attemptId: string,
  moduleType: "listening" | "reading" | "writing" | "speaking",
  studentEmail: string,
): Promise<ModuleAccessResult> {
  const supabase = await createClient();

  try {
    // Call the RPC function
    const { data, error } = await supabase.rpc("validate_per_module_access", {
      p_attempt_id: attemptId,
      p_module_type: moduleType,
      p_student_email: studentEmail,
    });

    if (error) {
      console.error(`[ModuleAccess] RPC error for ${moduleType}:`, error);
      return {
        allowed: false,
        error: "Failed to validate module access",
        error_code: "RPC_ERROR",
      };
    }

    // RPC returns JSON object
    const result = data as ModuleAccessResult;

    if (!result.allowed) {
      console.warn(
        `[ModuleAccess] Access denied for ${moduleType}:`,
        result.error_code,
      );
    }

    return result;
  } catch (error: any) {
    console.error(`[ModuleAccess] Unexpected error:`, error);
    return {
      allowed: false,
      error: error?.message || "Unexpected validation error",
      error_code: "EXCEPTION",
    };
  }
}

/**
 * Client-side version (for use in client components)
 */
export async function validateModuleAccessClient(
  attemptId: string,
  moduleType: "listening" | "reading" | "writing" | "speaking",
): Promise<ModuleAccessResult> {
  const { createClient: createClientBrowser } =
    await import("@/utils/supabase/client");
  const supabase = createClientBrowser();

  try {
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return {
        allowed: false,
        error: "Authentication required",
        error_code: "AUTH_REQUIRED",
      };
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc("validate_per_module_access", {
      p_attempt_id: attemptId,
      p_module_type: moduleType,
      p_student_email: user.email,
    });

    if (error) {
      console.error(`[ModuleAccess] RPC error for ${moduleType}:`, error);
      return {
        allowed: false,
        error: "Failed to validate module access",
        error_code: "RPC_ERROR",
      };
    }

    // RPC returns JSON object
    const result = data as ModuleAccessResult;

    if (!result.allowed) {
      console.warn(
        `[ModuleAccess] Access denied for ${moduleType}:`,
        result.error_code,
      );
    }

    return result;
  } catch (error: any) {
    console.error(`[ModuleAccess] Unexpected error:`, error);
    return {
      allowed: false,
      error: error?.message || "Unexpected validation error",
      error_code: "EXCEPTION",
    };
  }
}
