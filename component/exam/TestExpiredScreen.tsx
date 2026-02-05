"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export interface TestExpiredScreenProps {
  message?: string;
  testTitle?: string;
  endedAt?: string;
  centerSlug?: string;
}

export default function TestExpiredScreen({
  message = "This test has ended. You can no longer access the questions.",
  testTitle,
  endedAt,
  centerSlug,
}: TestExpiredScreenProps) {
  const router = useRouter();

  const handleGoHome = () => {
    if (centerSlug) {
      router.push(`/mock-test/${centerSlug}/profile`);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-3">
          Test Ended
        </h1>

        {testTitle && (
          <p className="text-sm text-gray-600 text-center mb-4">{testTitle}</p>
        )}

        {/* Message */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 text-center">{message}</p>

          {endedAt && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Test ended at: {new Date(endedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleGoHome}
            className="w-full py-3 px-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors duration-200"
          >
            Go to Dashboard
          </button>

          <button
            onClick={() => router.back()}
            className="w-full py-2 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-200"
          >
            Go Back
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center mt-6">
          If you believe this is an error, please contact your test
          administrator.
        </p>
      </div>
    </div>
  );
}
