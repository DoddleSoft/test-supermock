import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/component/landing/Navbar";
import OverallScoreCard from "@/component/profile/OverallScoreCard";

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

  // Get student profile
  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("email", user.email)
    .single();

  if (profileError || !profile) {
    return notFound();
  }

  // Get all mock attempts for this student
  const { data: attempts, error: attemptsError } = await supabase
    .from("mock_attempts")
    .select(
      `
      id,
      overall_band_score,
      status,
      started_at,
      completed_at,
      scheduled_test_id,
      scheduled_tests(title)
    `,
    )
    .eq("student_id", profile.student_id)
    .order("started_at", { ascending: false })
    .limit(10);

  // Get the most recent completed attempt with module scores
  const { data: latestAttempt, error: latestError } = await supabase
    .from("mock_attempts")
    .select(
      `
      id,
      overall_band_score,
      completed_at,
      scheduled_test_id,
      scheduled_tests(title)
    `,
    )
    .eq("student_id", profile.student_id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  let moduleScores = {
    listening: 0,
    reading: 0,
    writing: 0,
    speaking: 0,
  };

  if (latestAttempt) {
    // Get module scores for the latest attempt
    const { data: modules } = await supabase
      .from("attempt_modules")
      .select("band_score, modules(module_type)")
      .eq("attempt_id", latestAttempt.id)
      .eq("status", "completed");

    if (modules) {
      modules.forEach((module: any) => {
        const moduleType = module.modules?.module_type;
        if (moduleType && module.band_score) {
          moduleScores[moduleType as keyof typeof moduleScores] =
            module.band_score;
        }
      });
    }
  }

  // Prepare chart data
  const chartData =
    attempts?.map((attempt, index) => ({
      label: `T${index + 1}`,
      score: attempt.overall_band_score || 0,
      highlight:
        attempt.status === "completed" &&
        attempt.overall_band_score &&
        attempt.overall_band_score >= 7,
    })) || [];

  const maxScore = 9;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-10">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 md:px-8">
        {/* Main Content Area */}
        <div className="lg:col-span-9 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Overall Score Card Section */}
            <div className="lg:col-span-5">
              {latestAttempt ? (
                <OverallScoreCard
                  overallScore={latestAttempt.overall_band_score || 0}
                  testDate={formatDate(latestAttempt.completed_at)}
                  testName={
                    (latestAttempt as any).scheduled_tests?.title ||
                    "IELTS MOCK TEST"
                  }
                  listening={moduleScores.listening}
                  reading={moduleScores.reading}
                  writing={moduleScores.writing}
                  speaking={moduleScores.speaking}
                />
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <p className="text-gray-600">
                    No completed tests yet. Start your first test!
                  </p>
                </div>
              )}
            </div>

            {/* Chart Section */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-8">
                  Scores for the last {chartData.length} tests
                </h2>

                {chartData.length > 0 ? (
                  <div className="relative">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-400 pr-4">
                      <span>9</span>
                      <span>6</span>
                      <span>3</span>
                      <span>0</span>
                    </div>

                    {/* Chart bars */}
                    <div className="ml-8 flex items-end justify-between gap-1 h-64 border-b border-gray-200">
                      {chartData.map((item, index) => {
                        const heightPercentage = (item.score / maxScore) * 100;
                        return (
                          <div
                            key={index}
                            className="flex-1 flex flex-col items-center justify-end"
                          >
                            {/* Bar */}
                            <div
                              className={`w-full rounded-t transition-all ${
                                item.highlight ? "bg-red-500" : "bg-red-200"
                              }`}
                              style={{ height: `${heightPercentage}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* X-axis labels */}
                    <div className="ml-8 flex justify-between mt-2">
                      {chartData.map((item, index) => (
                        <div
                          key={index}
                          className="flex-1 text-center text-xs text-gray-400"
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No test history available
                  </div>
                )}

                {/* Red dot indicator */}
                {chartData.length > 0 && (
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Score 7.0+</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
