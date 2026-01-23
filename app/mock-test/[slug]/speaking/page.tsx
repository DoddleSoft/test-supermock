"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic } from "lucide-react";
import SpeakingNavbar from "@/component/modules/SpeakingNavbar";
import { authService } from "@/helpers/auth";

export default function SpeakingTestPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [studentId, setStudentId] = useState("");
  const [timeLeft, setTimeLeft] = useState(14 * 60); // 14 minutes in seconds
  const [isStarted, setIsStarted] = useState(false);
  const [currentPart, setCurrentPart] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedPart, setSelectedPart] = useState<number | null>(1);

  const parts = [
    {
      id: 1,
      title: "Part 1",
      description: "Introduction & Interview",
      duration: "4-5 minutes",
    },
    {
      id: 2,
      title: "Part 2",
      description: "Individual Long Turn",
      duration: "3-4 minutes",
    },
    {
      id: 3,
      title: "Part 3",
      description: "Two-way Discussion",
      duration: "4-5 minutes",
    },
  ];

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
        router.replace(`/mock-test/${access.centerSlug}/speaking`);
        return;
      }

      setStudentId(access.userId || "");
    };

    validateAccess();
  }, [router, slug]);

  useEffect(() => {
    if (!isStarted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleStartTest = () => {
    setIsStarted(true);
  };

  const handleSubmitTest = () => {
    if (confirm("Are you sure you want to submit your test?")) {
      router.push("/mock-test");
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  if (!isStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-12">
          {/* header */}
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-50">
                <Mic className="h-8 w-8 text-orange-600" />
              </div>
              <div>
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
                  Speaking Test
                </h1>
                <p className="text-center text-lg text-gray-600">
                  3 parts • 11-14 minutes
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">
                Instructions:
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Part 1: Introduction (4-5 minutes)</li>
                <li>• Part 2: Individual Long Turn (3-4 minutes)</li>
                <li>• Part 3: Two-way Discussion (4-5 minutes)</li>
                <li>• Ensure microphone is working</li>
              </ul>
            </div>
          </div>

          {/* Part Selection */}
          <div className="mb-8">
            <h2 className="mb-4 font-semibold text-gray-900">
              Select a part to start:
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {parts.map((part) => (
                <button
                  key={part.id}
                  onClick={() => setSelectedPart(part.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedPart === part.id
                      ? "border-orange-600 bg-orange-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">{part.title}</h3>
                  <p className="text-sm text-gray-600">{part.description}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    {part.duration}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {/* Start Button */}
          <button
            onClick={() => {
              if (selectedPart) {
                setIsStarted(true);
                setCurrentPart(selectedPart);
              }
            }}
            disabled={!selectedPart}
            className="w-full rounded-lg bg-orange-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedPart ? "Start Test" : "Select a part to begin"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SpeakingNavbar timeLeft={timeLeft} />

      {/* Main Test Area - Scrollable */}
      <main className="mx-auto max-w-4xl pt-32 px-6 py-8 pb-28">
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          {/* Recording Status */}
          <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <div className="mb-6 flex justify-center">
              <div
                className={`flex h-32 w-32 items-center justify-center rounded-full ${
                  isRecording ? "bg-red-50 " : "bg-orange-50 "
                }`}
              >
                {isRecording ? (
                  <div className="flex flex-col items-center">
                    <div className="mb-2 h-4 w-4 animate-pulse rounded-full bg-red-600"></div>
                    <span className="text-xs font-medium text-red-600">
                      RECORDING
                    </span>
                  </div>
                ) : (
                  <Mic className="h-16 w-16 text-orange-600" />
                )}
              </div>
            </div>
            <button
              onClick={toggleRecording}
              className={`rounded-lg px-8 py-4 text-lg font-medium transition-colors ${
                isRecording
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-900 text-white hover:bg-gray-100"
              }`}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </button>
          </div>

          {/* Questions */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Part {currentPart}
            </h2>

            {currentPart === 1 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-gray-50 p-6">
                  <h3 className="mb-3 font-semibold text-gray-900">
                    Topic: Work or Studies
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li>• Do you work or are you a student?</li>
                    <li>• Why did you choose this job/course?</li>
                    <li>• What do you enjoy most about it?</li>
                    <li>• What are your future plans?</li>
                  </ul>
                </div>
              </div>
            )}

            {currentPart === 2 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-gray-50 p-6">
                  <h3 className="mb-3 font-semibold text-gray-900">
                    Describe a place you visited that left a strong impression
                  </h3>
                  <p className="mb-4 text-sm text-gray-600">
                    You will have 1 minute to prepare. Speak for 1-2 minutes.
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Where this place was</li>
                    <li>• When you visited it</li>
                    <li>• What you did there</li>
                    <li>
                      • And explain why it left a strong impression on you
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {currentPart === 3 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-gray-50 p-6">
                  <h3 className="mb-3 font-semibold text-gray-900">
                    Topic: Tourism and Travel
                  </h3>
                  <ul className="space-y-3 text-gray-700">
                    <li>
                      • How has tourism changed in your country over the years?
                    </li>
                    <li>• What are the benefits and drawbacks of tourism?</li>
                    <li>
                      • Do you think tourism will continue to grow in the
                      future?
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Navigation - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentPart((prev) => Math.max(1, prev - 1))}
              disabled={currentPart === 1}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex gap-3">
              {[1, 2, 3].map((part) => (
                <button
                  key={part}
                  onClick={() => setCurrentPart(part)}
                  className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                    part === currentPart
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {part}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPart((prev) => Math.min(3, prev + 1))}
              disabled={currentPart === 3}
              className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
