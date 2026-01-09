"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const module = searchParams.get("module");

  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate authentication
    setTimeout(() => {
      if (studentId && password) {
        // Store auth state (in production, use proper auth solution)
        sessionStorage.setItem("authenticated", "true");
        sessionStorage.setItem("studentId", studentId);
        if (module) {
          sessionStorage.setItem("selectedModule", module);
        }

        // Redirect to mock test page
        router.push("/mock-test");
      } else {
        setError("Please enter both Student ID and Password");
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-6">
        {/* Logo/Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            SuperMock
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your test portal
          </p>
          {module && (
            <div className="mt-4 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
              Selected Module:{" "}
              <span className="font-semibold capitalize">{module}</span>
            </div>
          )}
        </div>

        {/* Login Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="studentId"
                className="block text-sm font-medium text-gray-700"
              >
                Student ID
              </label>
              <input
                type="text"
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                placeholder="Enter your student ID"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to home
            </Link>
          </div>

          <div className="mt-4 text-center">
            <a
              href="#"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Forgot password?
            </a>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Need help? Contact{" "}
            <a
              href="mailto:contact@supermock.net"
              className="font-medium text-gray-900 hover:underline"
            >
              contact@supermock.net
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
