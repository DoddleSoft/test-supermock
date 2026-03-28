"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/component/ui/loader";
import { toast } from "sonner";

export default function MockTestHub() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { studentCenterSlug, studentEmail, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return; // wait for auth context to resolve

    try {
      if (!studentEmail) {
        toast.error("Failed to verify access");
        router.push("/auth/login");
        return;
      }

      if (!studentCenterSlug) {
        router.push("/?reason=no-center");
        return;
      }

      // Redirect to user's center
      router.replace(`/mock-test/${studentCenterSlug}`);
    } catch (error) {
      console.error("[MockTestHub] Error:", error);
      toast.error("Failed to load your center");
      router.push("/auth/login");
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, studentEmail, studentCenterSlug, router]);

  if (isLoading) {
    return <Loader fullScreen />;
  }

  return <Loader fullScreen />;
}
