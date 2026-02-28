import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/component/landing/Navbar";
import OverallScoreCard from "@/component/profile/OverallScoreCard";
import { formatProfileDate } from "@/helpers/scheduledTests";

interface ProfilePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return notFound();
  }

  // Initialize default values
  let tests: Array<{
    attempt_id: string;
    test_number: number;
    test_title: string;
    overall_score: number;
    completed_at: string;
    started_at: string;
    modules: {
      listening: number;
      reading: number;
      writing: number;
      speaking: number;
    };
  }> = [];

  // Call RPC to get student test scores with module breakdown
  const { data: scoresData, error: scoresError } = await supabase.rpc(
    "get_student_test_scores",
    {
      p_student_email: user.email!,
    },
  );

  if (!scoresError && scoresData) {
    const result = scoresData as {
      success: boolean;
      error?: string;
      student_id?: string;
      tests?: Array<{
        attempt_id: string;
        test_number: number;
        test_title: string;
        overall_score: number;
        completed_at: string;
        started_at: string;
        modules: {
          listening: number;
          reading: number;
          writing: number;
          speaking: number;
        };
      }>;
    };

    // Only assign tests if the result is successful and has tests
    if (result && result.success && result.tests && result.tests.length > 0) {
      tests = result.tests;
    }
  }

  // Fetch module feedback
  type ModuleFeedback = {
    attempt_id: string;
    test_title: string;
    test_completed_at: string;
    module_type: string;
    band_score: number;
    score_obtained: number;
    time_spent_seconds: number;
    module_duration_minutes: number;
    feedback: string | null;
    module_completed_at: string;
  };

  let moduleFeedback: ModuleFeedback[] = [];

  const { data: feedbackData, error: feedbackError } = await supabase.rpc(
    "get_student_module_feedback",
    {
      p_student_email: user.email!,
    },
  );

  if (!feedbackError && feedbackData) {
    const feedbackResult = feedbackData as {
      success: boolean;
      error?: string;
      modules?: ModuleFeedback[];
    };

    if (
      feedbackResult &&
      feedbackResult.success &&
      feedbackResult.modules &&
      feedbackResult.modules.length > 0
    ) {
      moduleFeedback = feedbackResult.modules;
    }
  }

  // Group feedback by attempt_id
  const feedbackByAttempt = moduleFeedback.reduce(
    (acc, module) => {
      if (!acc[module.attempt_id]) {
        acc[module.attempt_id] = {
          test_title: module.test_title,
          test_completed_at: module.test_completed_at,
          modules: [],
        };
      }
      acc[module.attempt_id].modules.push(module);
      return acc;
    },
    {} as Record<
      string,
      {
        test_title: string;
        test_completed_at: string;
        modules: ModuleFeedback[];
      }
    >,
  );

  const latestTest = tests[0];

  // Prepare module scores for latest test
  const moduleScores = latestTest
    ? latestTest.modules
    : {
        listening: 0,
        reading: 0,
        writing: 0,
        speaking: 0,
      };

  // Prepare chart data - reverse to show oldest to newest
  const chartData =
    tests.length > 0
      ? tests.reverse().map((test) => ({
          label: `T${test.test_number}`,
          testTitle: test.test_title,
          listening: test.modules.listening || 0,
          reading: test.modules.reading || 0,
          writing: test.modules.writing || 0,
          overall: test.overall_score || 0,
        }))
      : [];

  const minScore = 5;
  const maxScore = 9;

  // Helper functions for module feedback display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getModuleColor = (moduleType: string) => {
    switch (moduleType) {
      case "listening":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "reading":
        return "bg-green-100 text-green-700 border-green-200";
      case "writing":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "speaking":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getModuleName = (moduleType: string) => {
    return moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-10">
      {/* Navbar */}
      <Navbar hideInstructions={true} disableProfileLink={true} />

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 md:px-8">
        {/* Main Content Area */}
        <div className="lg:col-span-9 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <OverallScoreCard
                overallScore={latestTest?.overall_score || 0}
                testDate={
                  latestTest
                    ? formatProfileDate(latestTest.completed_at)
                    : "N/A"
                }
                testName={latestTest?.test_title || "IELTS MOCK TEST"}
                listening={moduleScores.listening || 0}
                reading={moduleScores.reading || 0}
                writing={moduleScores.writing || 0}
                speaking={moduleScores.speaking || 0}
              />
            </div>

            {/* Chart Section */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Scores for the last {chartData.length} tests
                </h2>

                {/* Legend */}
                <div className="flex items-center justify-end gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-xs text-gray-600">Listening</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-xs text-gray-600">Reading</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded"></div>
                    <span className="text-xs text-gray-600">Writing</span>
                  </div>
                </div>

                {chartData.length > 0 ? (
                  <div className="relative">
                    {/* Y-axis labels (5.0 to 9.0 with 0.5 increments) */}
                    <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-400 pr-4">
                      <span>9.0</span>
                      <span>8.5</span>
                      <span>8.0</span>
                      <span>7.5</span>
                      <span>7.0</span>
                      <span>6.5</span>
                      <span>6.0</span>
                      <span>5.5</span>
                      <span>5.0</span>
                    </div>

                    {/* Chart bars */}
                    <div className="ml-12 flex items-end justify-start gap-6 h-80 border-b border-gray-200 overflow-x-auto pb-2">
                      {chartData.map((test, testIndex) => {
                        // Calculate height percentage based on 5-9 scale
                        const getHeight = (score: number) => {
                          if (score < minScore) return 0;
                          if (score > maxScore) score = maxScore;
                          return (
                            ((score - minScore) / (maxScore - minScore)) * 100
                          );
                        };

                        return (
                          <div
                            key={testIndex}
                            className="flex items-end gap-1.5 min-w-[60px] h-full"
                            title={test.testTitle}
                          >
                            {/* Listening Bar */}
                            <div className="flex-1 h-full flex flex-col items-center justify-end group relative">
                              <div
                                className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                style={{
                                  height: `${getHeight(test.listening)}%`,
                                  minHeight: "3px",
                                }}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                L: {test.listening.toFixed(1)}
                              </div>
                            </div>

                            {/* Reading Bar */}
                            <div className="flex-1 h-full flex flex-col items-center justify-end group relative">
                              <div
                                className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                                style={{
                                  height: `${getHeight(test.reading)}%`,
                                  minHeight: "3px",
                                }}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                R: {test.reading.toFixed(1)}
                              </div>
                            </div>

                            {/* Writing Bar */}
                            <div className="flex-1 h-full flex flex-col items-center justify-end group relative">
                              <div
                                className="w-full bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                                style={{
                                  height: `${getHeight(test.writing)}%`,
                                  minHeight: "3px",
                                }}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                W: {test.writing.toFixed(1)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* X-axis labels */}
                    <div className="ml-12 flex justify-start gap-6 mt-2">
                      {chartData.map((test, index) => (
                        <div
                          key={index}
                          className="min-w-[60px] text-center text-xs text-gray-500 font-medium"
                        >
                          {test.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No test history available
                  </div>
                )}
              </div>

              {!latestTest && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-700">
                    No completed tests yet. Start your first test to see your
                    scores!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Module Feedback Section */}
          {Object.keys(feedbackByAttempt).length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Module Feedback & Performance
              </h2>

              <div className="space-y-6">
                {Object.entries(feedbackByAttempt).map(
                  ([attemptId, attempt]) => (
                    <div
                      key={attemptId}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                    >
                      {/* Test Header */}
                      <div className="bg-gradient-to-r from-red-50 to-red-100 px-6 py-4 border-b border-red-200">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {attempt.test_title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Completed on{" "}
                          {formatProfileDate(attempt.test_completed_at)}
                        </p>
                      </div>

                      {/* Modules Grid */}
                      <div className="p-6 space-y-6">
                        {attempt.modules.map((module, idx) => (
                          <div
                            key={idx}
                            className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                          >
                            {/* Module Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-semibold border ${getModuleColor(module.module_type)}`}
                                >
                                  {getModuleName(module.module_type)}
                                </span>
                                <div className="text-2xl font-bold text-gray-900">
                                  {module.band_score.toFixed(1)}
                                  <span className="text-sm text-gray-500 font-normal ml-1">
                                    / 9.0
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                  Band Score
                                </p>
                                <p className="text-lg font-bold text-gray-900">
                                  {module.band_score.toFixed(1)}
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                  Time Taken
                                </p>
                                <p className="text-lg font-bold text-gray-900">
                                  {formatTime(module.time_spent_seconds)}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  of {module.module_duration_minutes} min
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                  Score
                                </p>
                                <p className="text-lg font-bold text-gray-900">
                                  {module.score_obtained.toFixed(1)}
                                </p>
                              </div>
                            </div>

                            {/* Feedback */}
                            {module.feedback && (
                              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0">
                                    <svg
                                      className="w-5 h-5 text-blue-600 mt-0.5"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">
                                      Feedback
                                    </p>
                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                      {module.feedback}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
