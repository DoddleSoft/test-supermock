// ============================================================
// HELPER UTILITIES FOR GRADING
// ============================================================

import { NextResponse } from "next/server";
import { GRADING_VERSION } from "./constants";

/**
 * Get all sub_section IDs for a module
 */
export async function getModuleSubSectionIds(
  supabase: any,
  moduleId: string,
): Promise<string[]> {
  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("id")
    .eq("module_id", moduleId);

  if (sectionsError || !sections || sections.length === 0) {
    return [];
  }

  const sectionIds = sections.map((s: any) => s.id);

  const { data: subSections, error: subError } = await supabase
    .from("sub_sections")
    .select("id")
    .in("section_id", sectionIds);

  if (subError || !subSections) {
    return [];
  }

  return subSections.map((ss: any) => ss.id);
}

/**
 * Compute final time spent for a module
 */
export function computeFinalTimeSpent(
  startedAt: string | null,
  previousTimeSpent: number | null,
  clientTimeSpent?: number,
): number {
  if (clientTimeSpent !== undefined && clientTimeSpent > 0) {
    return clientTimeSpent;
  }

  const prev = previousTimeSpent || 0;

  if (startedAt) {
    const startMs = new Date(startedAt).getTime();
    const additionalSeconds = Math.max(
      0,
      Math.floor((Date.now() - startMs) / 1000),
    );
    return prev + additionalSeconds;
  }

  return prev;
}

/**
 * Standard error response helper
 */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      gradingVersion: GRADING_VERSION,
    },
    { status },
  );
}
