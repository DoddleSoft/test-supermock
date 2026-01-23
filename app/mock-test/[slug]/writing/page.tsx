"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenTool } from "lucide-react";
import WritingNavbar from "@/component/modules/WritingNavbar";
import { RenderBlock } from "@/component/modules/RenderBlock";
import { writingModuleData } from "@/dummy/writing";
import { authService } from "@/helpers/auth";

export default function WritingTestPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [studentId, setStudentId] = useState("");
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes in seconds
  const [isStarted, setIsStarted] = useState(false);
  const [currentTask, setCurrentTask] = useState(1);
  const [selectedTask, setSelectedTask] = useState<number | null>(1);
  const [answers, setAnswers] = useState<Record<string, string>>({
    "task-1": "",
    "task-2": "",
  });

  const tasks = writingModuleData.tasks.map((task, idx) => ({
    id: idx + 1,
    task_id: task.task_id,
    title: task.title,
    description:
      task.task_id === "task-1"
        ? "Describe visual information (graph, table, chart)"
        : "Present an argument or discuss a problem",
    minWords: task.word_count_min,
    time: `${task.duration_recommendation} minutes`,
  }));

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
        router.replace(`/mock-test/${access.centerSlug}/writing`);
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

  const countWords = (text: string) => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  };

  const handleAnswerChange = (taskId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [taskId]: value,
    }));
  };

  const handleSubmitTest = () => {
    if (confirm("Are you sure you want to submit your test?")) {
      router.push(slug ? `/mock-test/${slug}` : "/mock-test");
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

  const currentTaskData = writingModuleData.tasks[currentTask - 1];

  return (
    <div className="min-h-screen bg-white">
      <WritingNavbar timeLeft={timeLeft} />

      {/* Main Test Area - Scrollable */}
      <main className="mx-auto max-w-7xl px-4 pt-28">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Task Prompt Section */}
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-md bg-white shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 px-4 py-2">
              <h2 className="mb-2 text-sm font-bold text-gray-900">
                {currentTaskData.title}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="space-y-3">
                {currentTaskData.render_blocks.map((block, idx) => (
                  <RenderBlock key={idx} block={block} theme="purple" />
                ))}
              </div>
            </div>
          </div>

          {/* Answer Section */}
          <div className="flex h-[calc(100vh-200px)] flex-col bg-white">
            <div className="mb-2 text-right text-sm">
              <span
                className={
                  countWords(answers[currentTaskData.task_id] || "") >=
                  currentTaskData.word_count_min
                    ? "text-green-600 font-semibold"
                    : "text-gray-600"
                }
              >
                {countWords(answers[currentTaskData.task_id] || "")} words
              </span>
              <span className="text-gray-500">
                {" "}
                / {currentTaskData.word_count_min} minimum
              </span>
            </div>
            <textarea
              value={answers[currentTaskData.task_id] || ""}
              onChange={(e) =>
                handleAnswerChange(currentTaskData.task_id, e.target.value)
              }
              className="flex-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-200 resize-none scrollbar-thin scrollbar-thumb-gray-200"
              placeholder="Type your answer here..."
            />
          </div>
        </div>
      </main>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-6 py-2 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={() => setCurrentTask((prev) => Math.max(1, prev - 1))}
            disabled={currentTask === 1}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
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
            onClick={() => setCurrentTask((prev) => Math.min(2, prev + 1))}
            disabled={currentTask === 2}
            className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
