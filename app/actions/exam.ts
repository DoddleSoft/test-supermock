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
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        hasAccess: false,
        error: "Authentication required",
      };
    }

    if (!user.email) {
      return {
        success: false,
        hasAccess: false,
        error: "User email not found in authentication data",
      };
    }

    // Get student profile by email (no user_id column exists in student_profiles)

    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select("student_id, email, status, center_id, name")
      .eq("email", user.email)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        hasAccess: false,
        error: `Student profile not found for email ${user.email}. Error: ${profileError?.message || "No profile exists"}`,
      };
    }

    const { data: hasAccess, error: rpcError } = await supabase.rpc(
      "validate_student_attempt_access",
      {
        p_student_id: profile.student_id,
        p_mock_attempt_id: mockAttemptId,
      },
    );

    if (rpcError) {
      return {
        success: false,
        hasAccess: false,
        error: `Access validation failed: ${rpcError.message}`,
      };
    }

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
    const supabase = await createClient();

    // Call the RPC function to load paper with modules
    const { data, error } = await supabase.rpc("load_paper_with_modules", {
      p_paper_id: paperId,
    });

    if (error) {
      return {
        success: false,
        error: `Failed to load paper: ${error.message}`,
      };
    }

    if (!data) {
      return {
        success: false,
        error: "No data returned from server",
      };
    }

    return {
      success: true,
      data: data as ModuleData,
    };
  } catch (error: any) {
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
    // Step 1: Validate access
    const accessResult = await validateStudentAttemptAccess(attemptId);

    if (!accessResult.success || !accessResult.hasAccess) {
      return {
        success: false,
        error: accessResult.error || "Access denied to this test attempt",
      };
    }

    const supabase = await createClient();
    const { data: attemptData, error: attemptError } = await supabase
      .from("mock_attempts")
      .select("*, papers(id)")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attemptData) {
      return {
        success: false,
        error: `Test attempt not found: ${attemptError?.message || "No data"}`,
      };
    }

    // Step 3: Load paper with modules
    const paperResult = await loadPaperWithModules(attemptData.paper_id);

    if (!paperResult.success || !paperResult.data) {
      return {
        success: false,
        error: paperResult.error || "Failed to load test content",
      };
    }

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
