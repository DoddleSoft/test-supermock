"use server";

import { createClient } from "@/utils/supabase/server";

export interface ModuleData {
  paper: {
    id: string;
    center_id: string;
    title: string | null;
    paper_type: string | null;
    instruction: string | null;
    tests_conducted: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  modules: Record<
    string,
    {
      id: string;
      paper_id: string;
      module_type: "reading" | "listening" | "writing" | "speaking";
      heading: string | null;
      subheading: string | null;
      instruction: string | null;
      center_id: string;
      view_option: string | null;
      created_at: string;
      updated_at: string;
      sections: Array<{
        id: string;
        module_id: string;
        title: string | null;
        section_index: number;
        content_type: string | null;
        resource_url: string | null;
        content_text: string | null;
        instruction: string | null;
        subtext: string | null;
        params: any;
        created_at: string;
        updated_at: string;
        sub_sections: Array<{
          id: string;
          section_id: string;
          boundary_text: string | null;
          sub_type: string | null;
          content_template: string | null;
          resource_url: string | null;
          instruction: string | null;
          sub_section_index: number;
          created_at: string;
          updated_at: string;
          questions: Array<{
            id: string;
            question_ref: string;
            correct_answers: any;
            options: any;
            explanation: string | null;
            marks: number;
            created_at: string;
            updated_at: string;
          }>;
        }>;
      }>;
    }
  >;
}

export interface ValidateAccessResult {
  success: boolean;
  hasAccess: boolean;
  error?: string;
  studentId?: string;
}

export async function validateStudentAttemptAccess(
  mockAttemptId: string,
): Promise<ValidateAccessResult> {
  try {
    console.log(
      "[validateStudentAttemptAccess] Starting validation for attemptId:",
      mockAttemptId,
    );
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log("[validateStudentAttemptAccess] Auth result:", {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message,
    });

    if (authError || !user) {
      console.error(
        "[validateStudentAttemptAccess] Authentication failed:",
        authError,
      );
      return {
        success: false,
        hasAccess: false,
        error: "Authentication required",
      };
    }

    if (!user.email) {
      console.error("[validateStudentAttemptAccess] User has no email");
      return {
        success: false,
        hasAccess: false,
        error: "User email not found in authentication data",
      };
    }

    // Get student profile by email (no user_id column exists in student_profiles)
    console.log(
      "[validateStudentAttemptAccess] Fetching student profile for email:",
      user.email,
    );
    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select("student_id, email, status, center_id, name")
      .eq("email", user.email)
      .single();

    console.log("[validateStudentAttemptAccess] Student profile result:", {
      hasProfile: !!profile,
      profile: profile,
      profileError: profileError,
    });

    if (profileError || !profile) {
      console.error(
        "[validateStudentAttemptAccess] Student profile not found:",
        {
          error: profileError,
          userEmail: user.email,
        },
      );
      return {
        success: false,
        hasAccess: false,
        error: `Student profile not found for email ${user.email}. Error: ${profileError?.message || "No profile exists"}`,
      };
    }

    // Call the RPC function to validate access
    console.log("[validateStudentAttemptAccess] Calling RPC with:", {
      student_id: profile.student_id,
      mock_attempt_id: mockAttemptId,
    });

    const { data: hasAccess, error: rpcError } = await supabase.rpc(
      "validate_student_attempt_access",
      {
        p_student_id: profile.student_id,
        p_mock_attempt_id: mockAttemptId,
      },
    );

    console.log("[validateStudentAttemptAccess] RPC result:", {
      hasAccess,
      rpcError,
    });

    if (rpcError) {
      console.error(
        "[validateStudentAttemptAccess] RPC validation error:",
        rpcError,
      );
      return {
        success: false,
        hasAccess: false,
        error: `Access validation failed: ${rpcError.message}`,
      };
    }

    console.log("[validateStudentAttemptAccess] Validation successful:", {
      hasAccess,
      studentId: profile.student_id,
    });

    return {
      success: true,
      hasAccess: hasAccess === true,
      studentId: profile.student_id,
    };
  } catch (error: any) {
    console.error("Error validating student access:", error);
    return {
      success: false,
      hasAccess: false,
      error: error.message || "Unknown error occurred",
    };
  }
}

export async function loadPaperWithModules(
  paperId: string,
): Promise<{ success: boolean; data?: ModuleData; error?: string }> {
  try {
    console.log("[loadPaperWithModules] Loading paper:", paperId);
    const supabase = await createClient();

    // Call the RPC function to load paper with modules
    const { data, error } = await supabase.rpc("load_paper_with_modules", {
      p_paper_id: paperId,
    });

    console.log("[loadPaperWithModules] RPC result:", {
      hasData: !!data,
      error: error,
      dataKeys: data ? Object.keys(data) : [],
      hasPaper: data?.paper ? true : false,
      hasModules: data?.modules ? true : false,
      modulesType: typeof data?.modules,
      moduleCount: data?.modules ? Object.keys(data.modules).length : 0,
      rawModules: data?.modules,
    });

    if (error) {
      console.error("[loadPaperWithModules] RPC load paper error:", error);
      return {
        success: false,
        error: `Failed to load paper: ${error.message}`,
      };
    }

    if (!data) {
      console.error("[loadPaperWithModules] No data returned from RPC");
      return {
        success: false,
        error: "No data returned from server",
      };
    }

    if (!data.modules) {
      console.warn("[loadPaperWithModules] Warning: No modules in paper data");
    }

    console.log("[loadPaperWithModules] Paper loaded successfully:", {
      paperId: data.paper?.id,
      moduleTypes: data.modules
        ? Object.values(data.modules).map((m: any) => m.module_type)
        : [],
    });

    return {
      success: true,
      data: data as ModuleData,
    };
  } catch (error: any) {
    console.error("Error loading paper with modules:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
    };
  }
}

export async function loadExamData(attemptId: string): Promise<{
  success: boolean;
  data?: {
    attemptData: any;
    paperData: ModuleData;
    studentId: string;
  };
  error?: string;
}> {
  try {
    console.log("\n=== [loadExamData] Starting exam data load ===");
    console.log("[loadExamData] Attempt ID:", attemptId);

    // Step 1: Validate access
    console.log("[loadExamData] Step 1: Validating access...");
    const accessResult = await validateStudentAttemptAccess(attemptId);

    console.log("[loadExamData] Access validation result:", accessResult);

    if (!accessResult.success || !accessResult.hasAccess) {
      console.error(
        "[loadExamData] Access validation failed:",
        accessResult.error,
      );
      return {
        success: false,
        error: accessResult.error || "Access denied to this test attempt",
      };
    }

    // Step 2: Get the attempt data to retrieve paper_id
    console.log("[loadExamData] Step 2: Fetching attempt data...");
    const supabase = await createClient();
    const { data: attemptData, error: attemptError } = await supabase
      .from("mock_attempts")
      .select("*, papers(id)")
      .eq("id", attemptId)
      .single();

    console.log("[loadExamData] Attempt data result:", {
      hasData: !!attemptData,
      paperId: attemptData?.paper_id,
      error: attemptError,
    });

    if (attemptError || !attemptData) {
      console.error("[loadExamData] Attempt data fetch failed:", attemptError);
      return {
        success: false,
        error: `Test attempt not found: ${attemptError?.message || "No data"}`,
      };
    }

    // Step 3: Load paper with modules
    console.log("[loadExamData] Step 3: Loading paper with modules...");
    const paperResult = await loadPaperWithModules(attemptData.paper_id);

    if (!paperResult.success || !paperResult.data) {
      console.error("[loadExamData] Paper loading failed:", paperResult.error);
      return {
        success: false,
        error: paperResult.error || "Failed to load test content",
      };
    }

    console.log("[loadExamData] ✅ All data loaded successfully");
    console.log("=== [loadExamData] Complete ===\n");

    return {
      success: true,
      data: {
        attemptData,
        paperData: paperResult.data,
        studentId: accessResult.studentId!,
      },
    };
  } catch (error: any) {
    console.error("Error loading exam data:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
    };
  }
}
