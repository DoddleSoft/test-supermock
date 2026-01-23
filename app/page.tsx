"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader } from "@/component/ui/loader";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  useEffect(() => {
    if (!reason) {
      router.push("/auth/login");
    }
  }, [router, reason]);

  if (!reason) {
    return <Loader fullScreen />;
  }

  const isNoCenter = reason === "no-center";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Access Not Available
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          {isNoCenter
            ? "Your student account is not associated with a mock test center. Please contact your nearest mock test center to conduct a mock test."
            : "This portal is for students only. Please contact your nearest mock test center to conduct a mock test."}
        </p>
        <button
          onClick={() => router.push("/auth/login")}
          className="mt-6 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
