"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import ReadingNavbar from "@/component/modules/ReadingNavbar";
import { readingModuleData } from "@/dummy/reading";

export default function ReadingTestPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [isStarted, setIsStarted] = useState(false);
  const [currentPassage, setCurrentPassage] = useState(1);
  const [selectedPassage, setSelectedPassage] = useState<number | null>(1);

  // State to store user answers: { "1": "TRUE", "8": "doctors" }
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const passages = readingModuleData.passages.map((p, idx) => {
    const questionNums = Object.keys(p.questions)
      .map(Number)
      .sort((a, b) => a - b);
    const firstQ = questionNums[0];
    const lastQ = questionNums[questionNums.length - 1];
    return {
      id: idx + 1,
      title: p.title,
      description: p.heading || "IELTS Reading Passage",
      questions: `${firstQ}-${lastQ}`,
    };
  });

  // Handle saving answers
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

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
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isStarted, timeLeft]);

  // --- RENDER LOGIC START ---
  const currentPassageData = readingModuleData.passages[currentPassage - 1];

  if (!isStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-12">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
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
            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">
                Instructions:
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Read three passages and answer 40 questions</li>
                <li>• Manage your time carefully across all passages</li>
                <li>• The timer will start automatically when you begin</li>
              </ul>
            </div>
          </div>

          {/* Passage Selection */}
          <div className="mb-8 mt-8">
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
            Start Test
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <ReadingNavbar
        timeLeft={timeLeft}
        questions={passages[currentPassage - 1].questions}
      />

      {/* Main Test Area - Scrollable */}
      <main className="mx-auto max-w-7xl px-4 pt-28">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Passage Text Section */}
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-md bg-white shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 px-4 py-2">
              <h2 className="mb-2 text-sm font-bold text-gray-900">
                {currentPassageData.title}
              </h2>
              <h3 className="text-md font-semibold text-gray-800">
                {currentPassageData.heading}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="prose prose-zinc max-w-none text-gray-700">
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {currentPassageData.passage_text}
                </div>
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="flex h-[calc(100vh-200px)] flex-col bg-white">
            <p className="text-xs text-gray-900 mb-2 bg-red-200 p-2 rounded text-center font-medium">
              {currentPassageData.instruction}
            </p>
            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="space-y-3">
                {currentPassageData.render_blocks.map((block, idx) => (
                  <RenderBlock
                    key={idx}
                    block={block}
                    questions={currentPassageData.questions as any}
                    answers={answers}
                    onAnswerChange={handleAnswerChange}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-6 py-2 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={() => setCurrentPassage((prev) => Math.max(1, prev - 1))}
            disabled={currentPassage === 1}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex gap-2">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPassage(p)}
                className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                  p === currentPassage
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentPassage((prev) => Math.min(3, prev + 1))}
            disabled={currentPassage === 3}
            className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// Component to render each block type
const RenderBlock = ({
  block,
  questions,
  answers,
  onAnswerChange,
}: {
  block: { type: string; content: string };
  questions: Record<string, { answer: string; options?: string[] }>;
  answers: Record<string, string>;
  onAnswerChange: (qNum: string, value: string) => void;
}) => {
  const { type, content } = block;

  // Parse placeholders like {{1}boolean}, {{8}blanks}, {{14}dropdown}
  const renderContent = (text: string) => {
    const regex = /{{(\d+)}(boolean|blanks|dropdown)}/g;
    const parts: React.ReactElement[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      const qNum = match[1];
      const inputType = match[2];
      const qData = questions[qNum];

      if (inputType === "boolean" && qData?.options) {
        // Render dropdown for TRUE/FALSE/NOT GIVEN
        parts.push(
          <select
            key={`q-${qNum}`}
            value={answers[qNum] || ""}
            onChange={(e) => onAnswerChange(qNum, e.target.value)}
            className="mx-1 inline-block min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="">Select...</option>
            {qData.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      } else if (inputType === "dropdown" && qData?.options) {
        // Render dropdown for MCQ options (i, ii, iii, A, B, C, etc.)
        parts.push(
          <select
            key={`q-${qNum}`}
            value={answers[qNum] || ""}
            onChange={(e) => onAnswerChange(qNum, e.target.value)}
            className="mx-1 inline-block min-w-[100px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="">Select...</option>
            {qData.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      } else if (inputType === "blanks") {
        // Render text input for fill-in-the-blank with question number
        parts.push(
          <span key={`q-${qNum}`} className="inline-flex items-center gap-1">
            <span className="text-xs font-semibold text-gray-600">{qNum}.</span>
            <input
              type="text"
              value={answers[qNum] || ""}
              onChange={(e) => onAnswerChange(qNum, e.target.value)}
              placeholder="___"
              className="inline-block w-32 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after the last match
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>
      );
    }

    return parts;
  };

  switch (type) {
    case "header":
      return (
        <h3 className="mt-4 mb-3 text-base font-bold text-gray-900">
          {content}
        </h3>
      );
    case "instruction":
      return (
        <p className="mb-4 rounded-lg bg-blue-50 p-3 text-xs italic text-blue-900">
          {content}
        </p>
      );
    case "title":
      return (
        <h4 className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-gray-800">
          {content}
        </h4>
      );
    case "subtitle":
      return (
        <h5 className="mt-3 mb-2 text-xs font-semibold text-gray-700">
          {content}
        </h5>
      );
    case "box":
      return (
        <div className="my-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
            {content}
          </pre>
        </div>
      );
    case "text":
      return (
        <div className="mb-2 text-xs leading-7 text-gray-800">
          {renderContent(content)}
        </div>
      );
    case "image":
      return (
        <div className="my-6 flex justify-center">
          <img
            src={block.content}
            alt={"Diagram"}
            className="max-h-96 w-auto rounded-lg border shadow-sm object-contain"
          />
        </div>
      );
    default:
      return null;
  }
};
