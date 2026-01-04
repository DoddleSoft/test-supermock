"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
} from "lucide-react";
import Navbar from "@/component/landing/Navbar";
import Footer from "@/component/landing/Footer";

type QuestionSet = {
  id: string;
  title: string;
  description: string;
  difficulty?: string;
  topic?: string;
  time?: string;
};

const questionSets = {
  listening: [
    {
      id: "ls-1",
      title: "Question Set 1",
      description: "Everyday conversations and monologues",
      difficulty: "Easy",
    },
    {
      id: "ls-2",
      title: "Question Set 2",
      description: "Academic discussions and lectures",
      difficulty: "Medium",
    },
    {
      id: "ls-3",
      title: "Question Set 3",
      description: "Complex conversations in various contexts",
      difficulty: "Hard",
    },
    {
      id: "ls-4",
      title: "Question Set 4",
      description: "Academic monologues and debates",
      difficulty: "Hard",
    },
  ],
  reading: [
    {
      id: "rd-1",
      title: "Question Set 1",
      description: "Technology and Innovation",
      difficulty: "Easy",
      topic: "Science & Tech",
    },
    {
      id: "rd-2",
      title: "Question Set 2",
      description: "Environmental Issues",
      difficulty: "Medium",
      topic: "Environment",
    },
    {
      id: "rd-3",
      title: "Question Set 3",
      description: "Historical Events",
      difficulty: "Medium",
      topic: "History",
    },
    {
      id: "rd-4",
      title: "Question Set 4",
      description: "Social Sciences",
      difficulty: "Hard",
      topic: "Society",
    },
  ],
  writing: [
    {
      id: "wr-1",
      title: "Question Set 1",
      description: "Task 1: Bar Chart | Task 2: Education",
      difficulty: "Easy",
    },
    {
      id: "wr-2",
      title: "Question Set 2",
      description: "Task 1: Line Graph | Task 2: Technology",
      difficulty: "Medium",
    },
    {
      id: "wr-3",
      title: "Question Set 3",
      description: "Task 1: Pie Chart | Task 2: Environment",
      difficulty: "Medium",
    },
    {
      id: "wr-4",
      title: "Question Set 4",
      description: "Task 1: Process Diagram | Task 2: Society",
      difficulty: "Hard",
    },
  ],
  speaking: [
    {
      id: "sp-1",
      title: "Morning Session",
      description: "9:00 AM - 10:00 AM",
      time: "9:00 AM",
    },
    {
      id: "sp-2",
      title: "Afternoon Session",
      description: "2:00 PM - 3:00 PM",
      time: "2:00 PM",
    },
    {
      id: "sp-3",
      title: "Evening Session",
      description: "5:00 PM - 6:00 PM",
      time: "5:00 PM",
    },
  ],
};

export default function MockTestPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const authenticated = sessionStorage.getItem("authenticated");
    const storedStudentId = sessionStorage.getItem("studentId");
    const storedModule = sessionStorage.getItem("selectedModule");

    if (!authenticated || !storedStudentId) {
      router.push("/auth/login");
      return;
    }

    setStudentId(storedStudentId);
    setSelectedModule(storedModule || "");
    setIsLoading(false);
  }, [router]);

  const handleSignOut = () => {
    sessionStorage.clear();
    router.push("/");
  };

  const handleModuleClick = (module: string) => {
    setExpandedModule(expandedModule === module ? null : module);
  };

  const handleQuestionSetSelect = (module: string, setId: string) => {
    router.push(`/mock-test/${module}?set=${setId}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Navbar />

        {/* Test Modules */}
        <div className="mb-12 mt-24 space-y-4">
          {/* Listening Module */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => handleModuleClick("listening")}
              className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <Headphones className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Listening Test
                  </h3>
                  <p className="text-sm text-gray-600">
                    40 questions • 30 minutes
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`h-6 w-6 text-gray-400 transition-transform ${
                  expandedModule === "listening" ? "rotate-90" : ""
                }`}
              />
            </button>
            {expandedModule === "listening" && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <h4 className="mb-4 font-semibold text-gray-900">
                  Select a Question Set:
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {questionSets.listening.map((set) => (
                    <button
                      key={set.id}
                      onClick={() =>
                        handleQuestionSetSelect("listening", set.id)
                      }
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-blue-600 hover:shadow-md"
                    >
                      <FileText className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">
                          {set.title}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {set.description}
                        </p>
                        {set.difficulty && (
                          <span
                            className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${
                              set.difficulty === "Easy"
                                ? "bg-green-100 text-green-700"
                                : set.difficulty === "Medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {set.difficulty}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reading Module */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => handleModuleClick("reading")}
              className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Reading Test
                  </h3>
                  <p className="text-sm text-gray-600">
                    40 questions • 60 minutes
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`h-6 w-6 text-gray-400 transition-transform ${
                  expandedModule === "reading" ? "rotate-90" : ""
                }`}
              />
            </button>
            {expandedModule === "reading" && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <h4 className="mb-4 font-semibold text-gray-900">
                  Select a Question Set:
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {questionSets.reading.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => handleQuestionSetSelect("reading", set.id)}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-green-600 hover:shadow-md"
                    >
                      <FileText className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">
                          {set.title}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {set.description}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {set.topic && (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                              {set.topic}
                            </span>
                          )}
                          {set.difficulty && (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                set.difficulty === "Easy"
                                  ? "bg-green-100 text-green-700"
                                  : set.difficulty === "Medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {set.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Writing Module */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => handleModuleClick("writing")}
              className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
                  <PenTool className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Writing Test
                  </h3>
                  <p className="text-sm text-gray-600">2 tasks • 60 minutes</p>
                </div>
              </div>
              <ChevronRight
                className={`h-6 w-6 text-gray-400 transition-transform ${
                  expandedModule === "writing" ? "rotate-90" : ""
                }`}
              />
            </button>
            {expandedModule === "writing" && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <h4 className="mb-4 font-semibold text-gray-900">
                  Select a Question Set:
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {questionSets.writing.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => handleQuestionSetSelect("writing", set.id)}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-purple-600 hover:shadow-md"
                    >
                      <FileText className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">
                          {set.title}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {set.description}
                        </p>
                        {set.difficulty && (
                          <span
                            className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${
                              set.difficulty === "Easy"
                                ? "bg-green-100 text-green-700"
                                : set.difficulty === "Medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {set.difficulty}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Speaking Module */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => handleModuleClick("speaking")}
              className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                  <Mic className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Speaking Test
                  </h3>
                  <p className="text-sm text-gray-600">
                    3 parts • 11-14 minutes
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`h-6 w-6 text-gray-400 transition-transform ${
                  expandedModule === "speaking" ? "rotate-90" : ""
                }`}
              />
            </button>
            {expandedModule === "speaking" && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <h4 className="mb-4 font-semibold text-gray-900">
                  Select a Time Slot:
                </h4>
                <div className="grid gap-3 md:grid-cols-3">
                  {questionSets.speaking.map((set) => (
                    <button
                      key={set.id}
                      onClick={() =>
                        handleQuestionSetSelect("speaking", set.id)
                      }
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-orange-600 hover:shadow-md"
                    >
                      <Clock className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">
                          {set.title}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {set.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Instructions */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            Before You Begin
          </h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span>
                Ensure you have a stable internet connection throughout the test
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span>
                Once you start a test, the timer will begin automatically and
                cannot be paused
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span>
                All answers are auto-saved. Your progress will be preserved if
                disconnected
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span>
                Results will be available within 24 hours of test completion
              </span>
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
