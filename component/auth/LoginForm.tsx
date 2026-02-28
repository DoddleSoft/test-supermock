"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/helpers/auth";
import { toast } from "sonner";
// import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  // const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // const turnstileRef = useRef<TurnstileInstance>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Check if user just registered or reset password
  useEffect(() => {
    const registered = searchParams.get("registered");
    const passwordReset = searchParams.get("password_reset");
    const authError = searchParams.get("error");

    if (registered === "true") {
      const msg =
        "Account created successfully! Please check your email to verify your account, then sign in.";
      toast.success(msg);
    }

    if (passwordReset === "true") {
      const msg =
        "Password reset successfully! Please sign in with your new password.";
      toast.success(msg);
    }

    if (authError) {
      let errorMsg = "";
      switch (authError) {
        case "verification_failed":
          errorMsg = "Email verification failed. Please try signing in again.";
          break;
        case "no_code":
          errorMsg = "Verification code missing. Please try signing in again.";
          break;
        case "exchange_failed":
          errorMsg = "Failed to verify your session. Please sign in again.";
          break;
        case "no_session":
          errorMsg = "Session could not be created. Please sign in again.";
          break;
        case "no_email":
          errorMsg = "Email address not found. Please sign in again.";
          break;
        case "profile_query_failed":
          errorMsg = "Failed to verify student profile. Please try again.";
          break;
        case "not_student":
          errorMsg =
            "You are not registered as a student. Please contact your mock test center.";
          break;
        case "no_center":
          errorMsg =
            "No test center assigned to your account. Please contact support.";
          break;
        case "center_query_failed":
          errorMsg = "Failed to load center information. Please try again.";
          break;
        case "center_not_found":
          errorMsg = "Test center not found. Please contact support.";
          break;
        default:
          errorMsg = "An error occurred. Please try signing in again.";
      }
      setError(errorMsg);
      toast.error(errorMsg);
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      const msg = "Email address is required.";
      toast.error(msg);
      setError(msg);
      setIsLoading(false);
      return;
    }
    if (!emailRegex.test(formData.email)) {
      const msg = "Please enter a valid email address.";
      toast.error(msg);
      setError(msg);
      setIsLoading(false);
      return;
    }

    // Validate password
    if (!formData.password) {
      const msg = "Password is required.";
      toast.error(msg);
      setError(msg);
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      const msg = "Password must be at least 6 characters.";
      toast.error(msg);
      setError(msg);
      setIsLoading(false);
      return;
    }

    // Validate captcha token
    // if (!captchaToken) {
    //   const msg = "Please complete the captcha verification.";
    //   toast.error(msg);
    //   setError(msg);
    //   setIsLoading(false);
    //   return;
    // }

    try {
      // Step 1: Validate credentials with Supabase Auth
      const result = await signIn(
        formData.email,
        formData.password,
        // captchaToken,
      );

      if (!result.success) {
        const errorMsg =
          result.error ||
          "Invalid email or password. Please check your credentials.";
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      // Step 2: Deep verification - Check student_profiles by email
      const supabase = authService.supabase;
      const { data: studentProfile, error: studentError } = await supabase
        .from("student_profiles")
        .select("student_id, center_id, email")
        .eq("email", formData.email)
        .maybeSingle();

      if (studentError) {
        const errorMsg = "Failed to verify student profile. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
        console.error("Student profile query error:", studentError);
        setIsLoading(false);
        return;
      }

      if (!studentProfile) {
        const errorMsg =
          "You are not registered as a student. Please contact your mock test center.";
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      if (!studentProfile.center_id) {
        const errorMsg =
          "No test center assigned to your account. Please contact support.";
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      // Step 3: Get center slug from centers table
      const { data: center, error: centerError } = await supabase
        .from("centers")
        .select("slug")
        .eq("center_id", studentProfile.center_id)
        .maybeSingle();

      if (centerError) {
        const errorMsg = "Failed to load center information. Please try again.";
        setError(errorMsg);
        toast.error(errorMsg);
        console.error("Center query error:", centerError);
        setIsLoading(false);
        return;
      }

      if (!center || !center.slug) {
        const errorMsg = "Test center not found. Please contact support.";
        setError(errorMsg);
        toast.error(errorMsg);
        console.error(
          "No center found for center_id:",
          studentProfile.center_id,
        );
        setIsLoading(false);
        return;
      }

      // Step 4: Success - Redirect to /mock-test/[slug]
      toast.success(`Signed in successfully!`);
      setTimeout(() => {
        router.push(`/mock-test/${center.slug}`);
      }, 1000);
    } catch (error) {
      const errorMsg =
        "An unexpected error occurred during sign in. Please check your internet connection and try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Login error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600">
            New to SuperMock?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Create Account
            </Link>
          </p>
        </div>

        {/* Form Container */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border text-gray-600 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors placeholder-gray-400"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <Link
                  href="/auth/reset-password"
                  className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-12 py-3 border text-gray-600 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors placeholder-gray-400"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <label
                htmlFor="rememberMe"
                className="ml-2 block text-sm text-gray-700 cursor-pointer"
              >
                Remember me
              </label>
            </div>

            {/* Turnstile Captcha */}

            {/* <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            /> */}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-sm"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Footer Text */}
          <p className="text-center text-xs text-gray-500 mt-4">
            By signing in, you agree to our{" "}
            <Link
              href="#"
              className="underline hover:text-gray-700 transition-colors"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="underline hover:text-gray-700 transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
