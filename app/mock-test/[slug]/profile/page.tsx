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

  if (scoresError) {
    console.error("Error fetching test scores:", scoresError);
    // Don't return notFound - just use empty tests array
  } else {
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
        </div>
      </div>
    </div>
  );
}
