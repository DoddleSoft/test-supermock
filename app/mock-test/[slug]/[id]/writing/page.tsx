import { ExamProvider } from "@/context/ExamContext";
import { loadExamData } from "@/app/actions/exam";
import WritingTestClient from "./WritingTestClient";

interface WritingPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function WritingPage({ params }: WritingPageProps) {
  const { slug, id } = await params;
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

  const { paperData, studentId } = examData.data;
  const writingModule =
    paperData.modules && typeof paperData.modules === "object"
      ? paperData.modules.writing
      : undefined;

  if (!writingModule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Writing Module Found
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
      serverData={paperData}
    >
      <WritingTestClient slug={slug} />
    </ExamProvider>
  );
}
