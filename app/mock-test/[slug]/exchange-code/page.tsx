"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RectangleEllipsis } from "lucide-react";
import { joinMockTest } from "@/helpers/scheduledTests";
import { authService } from "@/helpers/auth";
import { toast } from "sonner";

export default function JoinCenterPage() {
  // Store digits as an array of 6 strings
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const testId = searchParams.get("test");

  // Refs to manage focus for each input
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get user email on mount
  useEffect(() => {
    const getUserEmail = async () => {
      const access = await authService.getStudentAccess();
      if (!access.success || !access.userEmail) {
        toast.error("Please log in to continue");
        router.push("/auth/login");
        return;
      }
      setUserEmail(access.userEmail);
    };
    getUserEmail();
  }, [router]);

  // Focus the first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = digits.join("");

    if (fullCode.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    if (!testId) {
      setError("Test ID not found. Please go back and try again.");
      return;
    }

    if (!userEmail) {
      setError("User email not found. Please refresh and try again.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await joinMockTest(fullCode, testId, userEmail);

      if (!result.success) {
        setError(result.error || "Failed to join test");
        return;
      }

      // Validate RPC response structure
      if (!result.attemptId || !result.paperId) {
        console.error("[ExchangeCode] Invalid RPC response:", result);
        setError("Server returned incomplete data. Please try again.");
        return;
      }

      // Validate that modules were created (JSONB array from RPC)
      if (
        !result.moduleIds ||
        !Array.isArray(result.moduleIds) ||
        result.moduleIds.length === 0
      ) {
        console.error("[ExchangeCode] No modules returned from RPC:", {
          attemptId: result.attemptId,
          moduleIds: result.moduleIds,
        });
        setError(
          "Test modules not created. Please contact support with attempt ID: " +
            result.attemptId,
        );
        return;
      }

      console.log("[ExchangeCode] Join successful:", {
        attemptId: result.attemptId,
        paperId: result.paperId,
        status: result.status,
        modulesCount: result.moduleIds.length,
        modules: result.moduleIds.map((m) => ({
          type: m.module_type,
          status: m.status,
        })),
      });

      // Store attempt info in sessionStorage
      sessionStorage.setItem("attemptId", result.attemptId);
      sessionStorage.setItem("paperId", result.paperId);
      sessionStorage.setItem("attemptStatus", result.status || "created");

      // Store module info (JSONB array from RPC)
      sessionStorage.setItem("moduleIds", JSON.stringify(result.moduleIds));

      // Show success message based on status
      if (result.status === "resumed") {
        toast.success("Resuming your previous attempt");
      } else {
        toast.success(
          `Test joined successfully! ${result.moduleIds.length} modules ready.`,
        );
      }

      // Get center slug from current path
      const pathParts = window.location.pathname.split("/");
      const centerSlug = pathParts[2]; // /mock-test/[slug]/exchange-code

      // Redirect to exam interface
      router.push(`/mock-test/${centerSlug}/${result.attemptId}`);
    } catch (err) {
      console.error("[ExchangeCode] Unexpected error:", err);
      setError("Connection failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];

    // Take the last character entered (in case user types multiple chars in one box)
    const char = value.slice(-1);
    newDigits[index] = char;
    setDigits(newDigits);
    setError("");

    // If a digit was added, move to next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    // Handle Backspace
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // If current box is empty, move back and delete previous
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Just clear current box
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      }
    }
    // Handle Left Arrow
    else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    // Handle Right Arrow
    else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();

    // Check if pasted content is number only
    if (!/^\d+$/.test(pastedData)) return;

    const pastedDigits = pastedData.split("").slice(0, 6);
    const newDigits = [...digits];

    pastedDigits.forEach((digit, i) => {
      newDigits[i] = digit;
    });

    setDigits(newDigits);

    // Focus the box after the last pasted digit
    const nextFocusIndex = Math.min(pastedDigits.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  const isFormValid = digits.every((d) => d !== "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
      <div className="w-full max-w-full bg-white shadow-lg border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <RectangleEllipsis className="w-6 h-6 text-red-800" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Start a Mock Test
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Enter the 6-digit access code provided by your center.
          </p>
        </div>

        {/* Input Section */}
        <form onSubmit={handleJoin} className="px-8 pb-8 space-y-8">
          <div className="space-y-4">
            {/* 6-Box Input Grid */}
            <div className="flex justify-center gap-2 sm:gap-3 mt-8">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold border rounded-lg outline-none transition-all duration-200
                    ${
                      error
                        ? "border-red-300 focus:border-red-500 bg-red-50 text-red-900"
                        : "border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white text-gray-900"
                    }
                  `}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex justify-center">
                <p className="text-sm text-red-500 flex items-center animate-in fade-in slide-in-from-top-1">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {error}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="flex items-center justify-center py-3 px-10 w-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Verifying...
                </>
              ) : (
                "Join Center"
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 text-center border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Don't have a code? Contact your center administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
