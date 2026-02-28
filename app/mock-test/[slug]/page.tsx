"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Wifi,
  Timer,
  CloudLightning,
  FileCheck,
  Headphones,
  MonitorX,
} from "lucide-react";
import { toast } from "sonner";
import { ChevronRight, Clock, Calendar, Building2 } from "lucide-react";
import Navbar from "@/component/landing/Navbar";
import Footer from "@/component/landing/Footer";
import { authService } from "@/helpers/auth";
import { Loader } from "@/component/ui/loader";
import {
  formatTestTime,
  formatTestDate,
  getTestStatus,
  getStatusBadgeColor,
  toScheduledTest,
  fetchStudentRegisteredTests,
  type StudentRegisteredTest,
  type ScheduledTest,
} from "@/helpers/scheduledTests";

const INSTRUCTIONS = [
  {
    id: 1,
    title: "Stable Connection",
    description:
      "Ensure a reliable internet connection. Weak signals may cause lag, though we try to sync your progress.",
    icon: Wifi,
  },
  {
    id: 2,
    title: "Continuous Timer",
    description:
      "Once the test begins, the timer runs automatically. It cannot be paused or reset under any circumstances.",
    icon: Timer,
  },
  {
    id: 3,
    title: "Smart Auto-Save",
    description:
      "Don't panic if you disconnect. Your answers are saved automatically and synced when you reconnect.",
    icon: CloudLightning,
  },
  {
    id: 4,
    title: "Audio Requirements",
    description:
      "For Listening modules, ensure your headphones are connected and volume is adjusted before starting.",
    icon: Headphones,
  },
  {
    id: 5,
    title: "No Tab Switching",
    description:
      "Please remain in the test window. Frequent tab switching may be flagged as suspicious behavior.",
    icon: MonitorX,
  },
  {
    id: 6,
    title: "Result Processing",
    description:
      "Comprehensive band scores and analytics will be available in your dashboard within 24 hours.",
    icon: FileCheck,
  },
];

export default function MockTestPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [isLoading, setIsLoading] = useState(true);
  const [registeredTests, setRegisteredTests] = useState<
    StudentRegisteredTest[]
  >([]);

  useEffect(() => {
    const validateAccess = async () => {
      const access = await authService.getStudentAccess();

      if (!access.success || !access.allowed) {
        if (access.error) {
          toast.error(access.error);
        }
        router.push(access.redirectPath || "/auth/login");
        return;
      }

      if (access.centerSlug && slug && access.centerSlug !== slug) {
        router.replace(`/mock-test/${access.centerSlug}`);
        return;
      }

      // Fetch only the tests this student is registered for
      if (access.userEmail) {
        const { tests, error } = await fetchStudentRegisteredTests(
          access.userEmail,
        );
        if (error) {
          toast.error(error);
        } else {
          setRegisteredTests(tests);
        }
      }

      setIsLoading(false);
    };

    validateAccess();
  }, [router, slug]);

  const handleJoinTest = (scheduledTestId: string) => {
    router.push(`/mock-test/${slug}/exchange-code?test=${scheduledTestId}`);
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Navbar />

        {/* Registered Tests Section */}
        {registeredTests.length > 0 ? (
          <div className="mb-12 mt-24">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Your Mock Tests
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {registeredTests.map((rTest) => {
                const scheduled = toScheduledTest(rTest);
                const testStatus = getTestStatus(scheduled);
                return (
                  <div
                    key={rTest.attempt_id}
                    className="group rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-red-300"
                  >
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {rTest.test_title}
                        </h3>
                        {rTest.paper_type && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                            {rTest.paper_type}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1.5 text-xs font-bold rounded-full border-2 ${getStatusBadgeColor(testStatus.status)}`}
                      >
                        {testStatus.status === "in_progress"
                          ? "LIVE"
                          : testStatus.status === "completed"
                            ? "COMPLETED"
                            : testStatus.status === "cancelled"
                              ? "CANCELLED"
                              : "SCHEDULED"}
                      </span>
                    </div>

                    {/* Paper Info */}
                    <div className="mb-3">
                      <p className="text-sm text-gray-500">
                        Paper:{" "}
                        <span className="font-semibold text-gray-800">
                          {rTest.paper_title}
                        </span>
                      </p>
                    </div>

                    {/* Details Grid */}
                    <div className="space-y-3 mb-5 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-3 text-gray-700">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500">Date</p>
                          <p className="font-semibold">
                            {formatTestDate(rTest.scheduled_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700">
                        <Clock className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-xs text-gray-500">
                            Time & Duration
                          </p>
                          <p className="font-semibold">
                            {formatTestTime(rTest.scheduled_at)} •{" "}
                            {rTest.duration_minutes} min
                          </p>
                        </div>
                      </div>
                      {rTest.center_name && (
                        <div className="flex items-center gap-3 text-gray-700">
                          <Building2 className="h-5 w-5 text-orange-600" />
                          <div>
                            <p className="text-xs text-gray-500">Test Center</p>
                            <p className="font-semibold">{rTest.center_name}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleJoinTest(rTest.scheduled_test_id)}
                      disabled={!testStatus.canJoin}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 ${
                        testStatus.canJoin
                          ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md hover:shadow-lg "
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {testStatus.canJoin ? (
                        <span className="flex items-center justify-center gap-2">
                          <span>Join Now</span>
                          <ChevronRight className="h-5 w-5" />
                        </span>
                      ) : (
                        testStatus.countdown || testStatus.message
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-12 mt-24 text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Upcoming Tests
            </h3>
            <p className="text-gray-600">
              You are not registered for any tests at the moment. Check back
              later.
            </p>
          </div>
        )}

        <div
          id="instructions"
          className="w-full bg-white py-8 scroll-smooth scroll-mt-28"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Before You Begin
            </h2>
            <p className="mt-2 text-gray-500">
              Please review the following guidelines to ensure a smooth
              examination experience.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INSTRUCTIONS.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col items-start rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-red-100 hover:shadow-md"
              >
                {/* Red Accent Line on Hover */}
                <div className="absolute top-0 left-0 h-1 w-full bg-red-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100 rounded-t-xl" />

                {/* Icon Container */}
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors group-hover:bg-red-400 group-hover:text-white">
                  <item.icon className="h-6 w-6" strokeWidth={2} />
                </div>

                {/* Content */}
                <h3 className="mb-2 text-lg font-semibold text-gray-900 group-hover:text-red-700 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
