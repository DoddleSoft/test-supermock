import { loadExamData } from "@/app/actions/exam";
import { ExamProvider } from "@/context/ExamContext";
import WaitingRoomClient from "../../../../component/modules/WaitingRoomClient";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  // Validate and load exam data using RPC functions
  const result = await loadExamData(id);

  if (!result.success || !result.data) {
    // Redirect to error page or show error
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
          <p className="text-gray-600 mb-6">{result.error}</p>
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

  const { paperData, studentId } = result.data;

  // Validate modules data
  console.log("[ExamPage] Paper data structure:", {
    hasPaper: !!paperData.paper,
    paperId: paperData.paper?.id,
    hasModules: !!paperData.modules,
    modulesType: typeof paperData.modules,
    modulesKeys: paperData.modules ? Object.keys(paperData.modules) : [],
  });

  // Check if modules exist
  if (!paperData.modules || typeof paperData.modules !== "object") {
    console.error("[ExamPage] No modules data in paper:", paperData);
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
            No Test Modules Found
          </h2>
          <p className="text-gray-600 mb-6">
            This test paper has no modules configured. Please contact your
            administrator.
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

  // Transform paper data to modules array
  const modulesArray = Object.values(paperData.modules).map((module) => ({
    id: module.id,
    module_type: module.module_type,
    heading: module.heading,
    subheading: module.subheading,
    instruction: module.instruction,
  }));

  console.log(
    "[ExamPage] Transformed modules:",
    modulesArray.map((m) => ({ id: m.id, type: m.module_type })),
  );

  return (
    <ExamProvider
      attemptId={id}
      studentId={studentId}
      paperId={paperData.paper.id}
      serverData={paperData}
    >
      <WaitingRoomClient
        attemptId={id}
        centerSlug={slug}
        modules={modulesArray}
      />
    </ExamProvider>
  );
}
