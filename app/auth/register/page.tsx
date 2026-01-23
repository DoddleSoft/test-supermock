"use client";

import { BrandedSection } from "@/component/auth/BrandedSection";
import { RegisterForm } from "@/component/auth/RegisterForm";

export default function Register() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 flex">
      <RegisterForm />
      <BrandedSection />
    </div>
  );
}
