"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import ReadingNavbar from "@/component/modules/ReadingNavbar";

export default function ReadingTestPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes in seconds
  const [isStarted, setIsStarted] = useState(false);
  const [currentPassage, setCurrentPassage] = useState(1);
  const [selectedPassage, setSelectedPassage] = useState<number | null>(1);

  const passages = [
    {
      id: 1,
      title: "Passage 1",
      description: "The History of Time Measurement",
      questions: "1-13",
    },
    {
      id: 2,
      title: "Passage 2",
      description: "The Impact of Social Media",
      questions: "14-26",
    },
    {
      id: 3,
      title: "Passage 3",
      description: "Climate Change Solutions",
      questions: "27-40",
    },
  ];

  useEffect(() => {
    const authenticated = sessionStorage.getItem("authenticated");
    const storedStudentId = sessionStorage.getItem("studentId");

    if (!authenticated || !storedStudentId) {
      router.push("/auth/login");
      return;
    }

    setStudentId(storedStudentId);
  }, [router]);

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

  if (!isStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-12">
          {/* header */}
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
                <BookOpen className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
                  Reading Test
                </h1>
                <p className="text-center text-lg text-gray-600">
                  40 questions • 60 minutes
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">
                Instructions:
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Read three passages and answer 40 questions</li>
                <li>• Manage your time carefully across all passages</li>
                <li>• The timer will start automatically when you begin</li>
                <li>• You cannot pause or restart the test</li>
              </ul>
            </div>
          </div>

          {/* Passage Selection */}
          <div className="mb-8">
            <h2 className="mb-4 font-semibold text-gray-900">
              Select a passage to start:
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {passages.map((passage) => (
                <button
                  key={passage.id}
                  onClick={() => setSelectedPassage(passage.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedPassage === passage.id
                      ? "border-green-600 bg-green-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">
                    {passage.title}
                  </h3>
                  <p className="text-sm text-gray-600">{passage.description}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    Questions {passage.questions}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {/* Start Button */}
          <button
            onClick={() => {
              if (selectedPassage) {
                setIsStarted(true);
                setCurrentPassage(selectedPassage);
              }
            }}
            disabled={!selectedPassage}
            className="w-full rounded-lg bg-green-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedPassage ? "Start Test" : "Select a passage to begin"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <ReadingNavbar timeLeft={timeLeft} />

      {/* Main Test Area - Scrollable */}
      <main className="mx-auto max-w-7xl pt-28 px-6 py-8 pb-28">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Passage Section */}
          <div className="rounded-2xl bg-white p-4">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">
              Passage {currentPassage}
            </h2>
            <div className="prose prose-zinc max-w-none text-gray-700">
              <p className="mb-4">
                For thousands of years, humans have sought ways to measure time
                accurately. The earliest timekeeping devices were simple
                sundials, which used the position of the sun's shadow to
                indicate the time of day. However, these devices had significant
                limitations - they could not work at night or on cloudy days.
              </p>
              <p className="mb-4">
                The development of mechanical clocks in medieval Europe
                represented a major breakthrough. These devices used weighted
                mechanisms and later, spring-driven systems, to maintain
                consistent timekeeping regardless of weather conditions or time
                of day. The invention of the pendulum clock by Christiaan
                Huygens in 1656 dramatically improved accuracy.
              </p>
              <p>
                Modern atomic clocks, which measure time based on the vibrations
                of atoms, can maintain accuracy to within one second over
                millions of years. This precision has become essential for
                technologies like GPS navigation and telecommunications networks
                that depend on perfectly synchronized timing.
              </p>
            </div>
          </div>

          {/* Questions Section */}
          <div className="rounded-2xl bg-white p-4">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">
              Questions{" "}
              {currentPassage === 1
                ? "1-13"
                : currentPassage === 2
                ? "14-26"
                : "27-40"}
            </h2>
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((q) => (
                <div key={q}>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Question {q}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    placeholder="Type your answer here"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Navigation - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentPassage((prev) => Math.max(1, prev - 1))}
              disabled={currentPassage === 1}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex gap-3">
              {[1, 2, 3].map((passage) => (
                <button
                  key={passage}
                  onClick={() => setCurrentPassage(passage)}
                  className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                    passage === currentPassage
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {passage}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPassage((prev) => Math.min(3, prev + 1))}
              disabled={currentPassage === 3}
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
