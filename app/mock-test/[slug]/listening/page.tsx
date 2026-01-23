"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Headphones } from "lucide-react";
import ListeningNavbar from "@/component/modules/ListeningNavbar";
import { RenderBlock } from "@/component/modules/RenderBlock";
import { listeningModuleData } from "@/dummy/listening";
import { authService } from "@/helpers/auth";

export default function ListeningTestPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
  const [isStarted, setIsStarted] = useState(false);
  const [selectedSection, setSelectedSection] = useState<number | null>(1);
  const [currentSection, setCurrentSection] = useState<number>(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const sections = listeningModuleData.sections.map((section, idx) => {
    const questionNums = Object.keys(section.questions)
      .map(Number)
      .sort((a, b) => a - b);
    const firstQ = questionNums[0];
    const lastQ = questionNums[questionNums.length - 1];
    return {
      id: idx + 1,
      title: section.title,
      description: section.title,
      questions: `${firstQ}-${lastQ}`,
    };
  });

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

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
        router.replace(`/mock-test/${access.centerSlug}/listening`);
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

  // Handle audio playback - autoplay on section change and prevent pausing
  useEffect(() => {
    if (isStarted && audioRef.current) {
      const audio = audioRef.current;

      // Load and play the audio file
      audio.load();
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.error("Audio autoplay failed:", err);
            // If autoplay fails, try again after user interaction
            setIsPlaying(false);
          });
      }

      // Prevent pausing - if user tries to pause, immediately resume
      const handlePause = () => {
        if (audio.currentTime > 0 && !audio.ended) {
          audio.play().catch((err) => console.error("Resume failed:", err));
        }
      };

      // Track when audio starts playing
      const handlePlay = () => {
        setIsPlaying(true);
      };

      // When audio ends, mark as not playing
      const handleEnded = () => {
        setIsPlaying(false);
      };

      // Prevent seeking
      const handleSeeking = () => {
        if (audio.currentTime > 0) {
          audio.currentTime = audio.currentTime;
        }
      };

      audio.addEventListener("pause", handlePause);
      audio.addEventListener("play", handlePlay);
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("seeking", handleSeeking);

      return () => {
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("seeking", handleSeeking);
      };
    }
  }, [currentSection, isStarted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
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
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
                <Headphones className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
                  Listening Test
                </h1>
                <p className="text-center text-lg text-gray-600">
                  40 questions • 30 minutes
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">
                Instructions:
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>
                  • You will hear four recordings of native English speakers
                </li>
                <li>• The timer will start automatically when you begin</li>
                <li>• You cannot pause or restart the test</li>
              </ul>
            </div>
          </div>

          {/* Section Selection */}
          <div className="mb-8">
            <h2 className="mb-4 font-semibold text-gray-900">
              Select a section to start:
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedSection === section.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    Questions {section.questions}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {/* Start Button */}
          <button
            onClick={() => {
              if (selectedSection) {
                setIsStarted(true);
                setCurrentSection(selectedSection);
              }
            }}
            disabled={!selectedSection}
            className="w-full rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedSection ? "Start Test" : "Select a section to begin"}
          </button>
        </div>
      </div>
    );
  }

  const currentSectionData = listeningModuleData.sections[currentSection - 1];
  const audioPath = currentSectionData.audio_path;

  // Get question range for navbar
  const questionNums = Object.keys(currentSectionData.questions)
    .map(Number)
    .sort((a, b) => a - b);
  const questionRange = `${questionNums[0]}-${
    questionNums[questionNums.length - 1]
  }`;

  return (
    <div className="min-h-screen bg-white">
      <ListeningNavbar timeLeft={timeLeft} questions={questionRange} />

      {/* Main Test Area - Scrollable */}
      <main className="mx-auto max-w-7xl pt-28 px-4">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Audio Player Section */}
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-md bg-white shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentSectionData.title} - Audio
              </h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-full max-w-md">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
                    <Headphones className="h-10 w-10 text-blue-600" />
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  className="hidden"
                  src={audioPath}
                  preload="auto"
                />
                <div className="mb-6 text-center">
                  {isPlaying ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">
                        Audio Playing...
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-lg">
                      <span className="text-sm font-medium">
                        Loading audio...
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> The audio will play automatically.
                    You will hear the recording only once and it cannot be
                    paused, stopped, or replayed. Make sure your audio is
                    working properly.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="flex h-[calc(100vh-200px)] flex-col bg-white">
            <p className="text-xs text-gray-900 mb-2 bg-red-200 p-2 rounded text-center font-medium">
              {currentSectionData.instruction}
            </p>
            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="space-y-3">
                {currentSectionData.render_blocks.map((block, idx) => (
                  <RenderBlock
                    key={idx}
                    block={block}
                    theme="blue"
                    questions={currentSectionData.questions as any}
                    answers={answers}
                    onAnswerChange={handleAnswerChange}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Navigation - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentSection((prev) => Math.max(1, prev - 1))}
              disabled={currentSection === 1}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map((section) => (
                <button
                  key={section}
                  onClick={() => setCurrentSection(section)}
                  className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                    section === currentSection
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {section}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentSection((prev) => Math.min(4, prev + 1))}
              disabled={currentSection === 4}
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
