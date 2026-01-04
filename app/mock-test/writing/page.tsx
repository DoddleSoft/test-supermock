"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PenTool } from "lucide-react";
import WritingNavbar from "@/component/modules/WritingNavbar";

export default function WritingTestPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes in seconds
  const [isStarted, setIsStarted] = useState(false);
  const [currentTask, setCurrentTask] = useState(1);
  const [task1Answer, setTask1Answer] = useState("");
  const [task2Answer, setTask2Answer] = useState("");
  const [selectedTask, setSelectedTask] = useState<number | null>(1);

  const tasks = [
    {
      id: 1,
      title: "Task 1",
      description: "Describe visual information (graph, table, chart)",
      minWords: 150,
      time: "20 minutes",
    },
    {
      id: 2,
      title: "Task 2",
      description: "Present an argument or discuss a problem",
      minWords: 250,
      time: "40 minutes",
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const countWords = (text: string) => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  };

  const handleStartTest = () => {
    setIsStarted(true);
  };

  const handleSubmitTest = () => {
    if (confirm("Are you sure you want to submit your test?")) {
      router.push("/mock-test");
    }
  };

  if (!isStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-12">
          {/* header */}
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-50">
                <PenTool className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
                  Writing Test
                </h1>
                <p className="text-center text-lg text-gray-600">
                  2 tasks • 60 minutes
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">
                Instructions:
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Task 1: Write at least 150 words</li>
                <li>• Task 2: Write at least 250 words</li>
                <li>• The timer will start automatically when you begin</li>
                <li>• You cannot pause or restart the test</li>
              </ul>
            </div>
          </div>

          {/* Task Selection */}
          <div className="mb-8">
            <h2 className="mb-4 font-semibold text-gray-900">
              Select a task to start:
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedTask === task.id
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">{task.title}</h3>
                  <p className="text-sm text-gray-600">{task.description}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    Min. {task.minWords} words
                  </p>
                </button>
              ))}
            </div>
          </div>
          {/* Start Button */}
          <button
            onClick={() => {
              if (selectedTask) {
                setIsStarted(true);
                setCurrentTask(selectedTask);
              }
            }}
            disabled={!selectedTask}
            className="w-full rounded-lg bg-purple-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedTask ? "Start Test" : "Select a task to begin"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <WritingNavbar timeLeft={timeLeft} />

      {/* Main Test Area - Scrollable */}
      <main className="mx-auto max-w-7xl pt-28 px-6 py-8 pb-20">
        {currentTask === 1 ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Task Description */}
            <div className="rounded-2xl bg-white p-4">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Task 1
              </h2>
              <p className="mb-6 text-sm text-gray-600">
                Describe visual information (graph, table, chart).
              </p>
              <div className="rounded-lg bg-gray-100 p-6">
                <p className="mb-4 text-sm font-semibold text-gray-900">
                  The chart shows household electronic device ownership.
                </p>
                <div className="flex h-48 items-center justify-center rounded-lg bg-zinc-200">
                  <p className="text-sm text-gray-500">
                    [Chart/Graph would appear here]
                  </p>
                </div>
              </div>
            </div>

            {/* Answer Area */}
            <div className="rounded-2xl bg-white p-4">
              <div className="text-sm text-end mb-1">
                <span
                  className={
                    countWords(task1Answer) >= 150
                      ? "text-green-600 "
                      : "text-gray-600 "
                  }
                >
                  {countWords(task1Answer)} words
                </span>
                <span className="text-gray-500"> / 150 minimum</span>
              </div>
              <textarea
                value={task1Answer}
                onChange={(e) => setTask1Answer(e.target.value)}
                className="min-h-[400px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                placeholder="Type your answer here..."
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Task Description */}
            <div className="rounded-2xl bg-white p-4">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Task 2
              </h2>
              <p className="mb-6 text-sm text-gray-600">
                Present an argument or discuss a problem.
              </p>
              <div className="rounded-lg bg-gray-100 p-6">
                <p className="text-sm text-gray-900 mb-4">
                  Some people believe that technology has made our lives more
                  complicated, while others argue that it has made life easier
                  and more convenient.
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  Discuss both views and give your own opinion.
                </p>
              </div>
            </div>

            {/* Answer Area */}
            <div className="rounded-2xl bg-white p-4">
              <div className="text-sm text-end mb-1">
                <span
                  className={
                    countWords(task2Answer) >= 250
                      ? "text-green-600 "
                      : "text-gray-600 "
                  }
                >
                  {countWords(task2Answer)} words
                </span>
                <span className="text-gray-500"> / 250 minimum</span>
              </div>
              <textarea
                value={task2Answer}
                onChange={(e) => setTask2Answer(e.target.value)}
                className="min-h-[400px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                placeholder="Type your answer here..."
              />
            </div>
          </div>
        )}
      </main>

      {/* Navigation - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentTask(1)}
              disabled={currentTask === 1}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous Task
            </button>
            <div className="flex gap-2">
              {[1, 2].map((task) => (
                <button
                  key={task}
                  onClick={() => setCurrentTask(task)}
                  className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                    task === currentTask
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {task}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentTask(2)}
              disabled={currentTask === 2}
              className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
