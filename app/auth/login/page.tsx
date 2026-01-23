"use client";

import { Suspense } from "react";

import { Loader } from "@/component/ui/loader";
import { BrandedSection } from "@/component/auth/BrandedSection";
import { LoginForm } from "@/component/auth/LoginForm";

function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 flex">
      <LoginForm />
      <BrandedSection />
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<Loader subtitle="Loading..." />}>
      <LoginPage />
    </Suspense>
  );
}
