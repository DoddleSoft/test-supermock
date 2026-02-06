import { notFound } from "next/navigation";
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

  // CRITICAL SECURITY CHECK: Validate scheduled test access
  const validation = await validateScheduledTestAccess(id);

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

  // CRITICAL SECURITY CHECK: Validate module-specific access
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <TestExpiredScreen
        message="Authentication required to access this module"
        centerSlug={slug}
      />
    );
  }

  const moduleAccess = await validateModuleAccess(id, "listening", user.email);

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

  const examData = await loadExamData(id);

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
