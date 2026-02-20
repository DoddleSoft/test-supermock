"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { BrandedSection } from "@/component/auth/BrandedSection";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  // Visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showConfirmCurrentPassword, setShowConfirmCurrentPassword] =
    useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    currentPassword: "",
    confirmCurrentPassword: "",
    newPassword: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    // 1. Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      toast.error("Email address is required.");
      return false;
    }
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return false;
    }

    // 2. Validate Current Password
    if (!formData.currentPassword) {
      toast.error("Current password is required.");
      return false;
    }

    // 3. Validate Confirm Current Password (The Fix)
    if (formData.currentPassword !== formData.confirmCurrentPassword) {
      toast.error("Current passwords do not match.");
      return false;
    }

    // 4. Validate New Password
    if (!formData.newPassword) {
      toast.error("New password is required.");
      return false;
    }
    if (formData.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return false;
    }

    // 5. Check if new password is different from current
    if (formData.currentPassword === formData.newPassword) {
      toast.error("New password must be different from current password.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      // Step 1: Sign in with current credentials to verify
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.currentPassword,
        });

      if (signInError || !signInData.user) {
        toast.error(
          "Invalid email or current password. Please check your credentials.",
        );
        setIsLoading(false);
        return;
      }

      // Step 2: Update password using the authenticated session
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (updateError) {
        toast.error("Failed to update password: " + updateError.message);
        setIsLoading(false);
        return;
      }

      // Step 3: Sign out after successful password change
      await supabase.auth.signOut();

      // Clear form
      setFormData({
        email: "",
        currentPassword: "",
        confirmCurrentPassword: "",
        newPassword: "",
      });

      // Redirect to login after 1.5 seconds
      setTimeout(() => {
        router.push("/auth/login?password_reset=true");
      }, 1500);
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(
        "An unexpected error occurred: " +
          (error?.message || "Please try again"),
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-white">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Change Password
            </h1>
            <p className="text-md text-gray-500">
              Remember your password?{" "}
              <span className="text-red-600">
                <Link href="/auth/login" className="underline">
                  Log in
                </Link>
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  name="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-12 text-gray-900 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-3 text-gray-400"
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Current Password - FIXED BINDING */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  name="confirmCurrentPassword"
                  type={showConfirmCurrentPassword ? "text" : "password"}
                  placeholder="Re-enter your current password"
                  value={formData.confirmCurrentPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-12 py-2.5 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmCurrentPassword(!showConfirmCurrentPassword)
                  }
                  className="absolute right-3 top-3 text-gray-400"
                >
                  {showConfirmCurrentPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 text-gray-900 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-gray-400"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 8 characters
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
            >
              {isLoading ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      <BrandedSection />
    </div>
  );
}
