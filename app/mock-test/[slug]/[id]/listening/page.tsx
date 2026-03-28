import { ExamProvider } from "@/context/ExamContext";
import { loadExamData } from "@/app/actions/exam";
import { validateScheduledTestAccess } from "@/utils/validateTestAccess";
import { validateModuleAccess } from "@/utils/validateModuleAccess";
import TestExpiredScreen from "@/component/exam/TestExpiredScreen";
import ListeningTestClient from "./ListeningTestClient";
import { createClient } from "@/utils/supabase/server";

interface ListeningPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function ListeningPage({ params }: ListeningPageProps) {
  const { slug, id } = await params;

  // Single server client + single auth call for ALL validations
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // CRITICAL SECURITY CHECK: Validate scheduled test access
  const validation = await validateScheduledTestAccess(id, supabase);

  if (!validation.isValid) {
    return (
      <TestExpiredScreen
        message={validation.error}
        testTitle={validation.scheduledTest?.title}
        endedAt={validation.scheduledTest?.ended_at}
        centerSlug={slug}
      />
    );
  }

  if (!user?.email) {
    return (
      <TestExpiredScreen
        message="Authentication required to access this module"
        centerSlug={slug}
      />
    );
  }

  // CRITICAL SECURITY CHECK: Validate module-specific access (reuse client)
  const moduleAccess = await validateModuleAccess(
    id,
    "listening",
    user.email,
    supabase,
  );

  if (!moduleAccess.allowed) {
    return (
      <TestExpiredScreen
        message={
          moduleAccess.error || "You cannot access this module at this time"
        }
        centerSlug={slug}
      />
    );
  }

  // Load exam data — skip redundant validation, reuse client
  const studentProfile = await supabase
    .from("student_profiles")
    .select("student_id")
    .eq("email", user.email)
    .maybeSingle();

  const examData = await loadExamData(id, {
    studentId: studentProfile.data?.student_id,
    supabaseClient: supabase,
  });

  if (!examData.success || !examData.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Failed to Load Test
          </h2>
          <p className="text-gray-600 mb-6">{examData.error}</p>
        </div>
      </div>
    );
  }

  const { attemptData, paperData, studentId } = examData.data;
  const listeningModule =
    paperData.modules && typeof paperData.modules === "object"
      ? paperData.modules.listening
      : undefined;

  if (!listeningModule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Listening Module Found
          </h2>
        </div>
      </div>
    );
  }

  return (
    <ExamProvider
      attemptId={id}
      studentId={studentId}
      paperId={paperData.paper.id}
      centerSlug={slug}
      serverData={paperData}
    >
      <ListeningTestClient slug={slug} />
    </ExamProvider>
  );
}
