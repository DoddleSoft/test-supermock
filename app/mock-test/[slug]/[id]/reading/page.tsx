import { notFound } from "next/navigation";
import { ExamProvider } from "@/context/ExamContext";
import { loadExamData } from "@/app/actions/exam";
import { validateScheduledTestAccess } from "@/utils/validateTestAccess";
import TestExpiredScreen from "@/component/exam/TestExpiredScreen";
import ReadingTestClient from "./ReadingTestClient";

interface ReadingPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function ReadingPage({ params }: ReadingPageProps) {
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

  // Load exam data using server action
  const examData = await loadExamData(id);

  if (!examData.success || !examData.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Failed to Load Test
          </h2>
          <p className="text-gray-600 mb-6">{examData.error}</p>
          <a
            href={`/mock-test/${slug}`}
            className="inline-block w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200"
          >
            Return to Tests
          </a>
        </div>
      </div>
    );
  }

  const { attemptData, paperData, studentId } = examData.data;

  // Defensive: check modules object and reading module
  const readingModule =
    paperData.modules && typeof paperData.modules === "object"
      ? paperData.modules.reading
      : undefined;

  if (!readingModule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Reading Module Found
          </h2>
          <p className="text-gray-600 mb-6">
            This test paper does not have a reading module configured. Please
            contact your administrator.
          </p>
          <a
            href={`/mock-test/${slug}`}
            className="inline-block w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200"
          >
            Return to Tests
          </a>
        </div>
      </div>
    );
  }

  return (
    <ExamProvider
      attemptId={id}
      studentId={studentId}
      paperId={attemptData.paper_id}
      centerSlug={slug}
      serverData={paperData}
    >
      <ReadingTestClient
        attemptId={id}
        centerSlug={slug}
        moduleId={readingModule.id}
      />
    </ExamProvider>
  );
}
