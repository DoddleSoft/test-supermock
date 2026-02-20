"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { authService, UserProfile } from "@/helpers/auth";
import { createClient } from "@/utils/supabase/client";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  studentCenterId: string | null;
  studentCenterSlug: string | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    captchaToken?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signIn: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  getUserRedirect: () => Promise<{
    success: boolean;
    path?: string;
    centerName?: string;
    error?: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [studentCenterId, setStudentCenterId] = useState<string | null>(null);
  const [studentCenterSlug, setStudentCenterSlug] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Load initial session
  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true);
        const session = await authService.getSession();
        setSession(session);

        if (session?.user) {
          setUser(session.user);
          // Don't block on user profile loading
          loadUserProfile(session.user.id).catch(console.error);
          loadStudentContext(session.user).catch(console.error);
        }
      } catch (error) {
        console.error("Error loading session:", error);
      } finally {
        // Always set loading to false after 1 second max
        setTimeout(() => setLoading(false), 100);
      }
    };

    loadSession();
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, !!session);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Don't block on user profile loading
        loadUserProfile(session.user.id).catch(console.error);
        loadStudentContext(session.user).catch(console.error);
      } else {
        setUserProfile(null);
        setStudentId(null);
        setStudentName(null);
        setStudentEmail(null);
        setStudentCenterId(null);
        setStudentCenterSlug(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user profile from public.users table
  const loadUserProfile = async (userId: string) => {
    try {
      const { success, profile, error } =
        await authService.getUserProfile(userId);

      if (success && profile) {
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setUserProfile(null);
    }
  };

  const loadStudentContext = async (authUser: User) => {
    try {
      const { data: byId, error: byIdError } = await supabase
        .from("student_profiles")
        .select("student_id, center_id, email, name")
        .eq("student_id", authUser.id)
        .maybeSingle();

      const studentProfile =
        byId ||
        (authUser.email
          ? (
              await supabase
                .from("student_profiles")
                .select("student_id, center_id, email, name")
                .eq("email", authUser.email)
                .maybeSingle()
            ).data
          : null);

      if (byIdError) {
        console.error("Student profile query error:", byIdError);
      }

      if (!studentProfile) {
        setStudentId(null);
        setStudentName(null);
        setStudentEmail(authUser.email ?? null);
        setStudentCenterId(null);
        setStudentCenterSlug(null);
        return;
      }

      setStudentId(studentProfile.student_id ?? null);
      setStudentName((studentProfile as any).name ?? null);
      setStudentEmail(studentProfile.email ?? authUser.email ?? null);
      setStudentCenterId(studentProfile.center_id ?? null);

      let resolvedCenterSlug: string | null = null;
      if (studentProfile.center_id) {
        const { data: center, error: centerError } = await supabase
          .from("centers")
          .select("slug")
          .eq("center_id", studentProfile.center_id)
          .maybeSingle();

        if (centerError) {
          console.error("Center lookup error:", centerError);
        }

        resolvedCenterSlug = center?.slug ?? null;
        setStudentCenterSlug(resolvedCenterSlug);
      } else {
        setStudentCenterSlug(null);
      }

      if (studentProfile.email) {
        sessionStorage.setItem("studentEmail", studentProfile.email);
      }
      if (studentProfile.student_id) {
        sessionStorage.setItem("studentId", studentProfile.student_id);
      }
      if (studentProfile.center_id) {
        sessionStorage.setItem("studentCenterId", studentProfile.center_id);
      }
      if (resolvedCenterSlug) {
        sessionStorage.setItem("centerSlug", resolvedCenterSlug);
      }
    } catch (error) {
      console.error("Error loading student context:", error);
      setStudentId(null);
      setStudentName(null);
      setStudentEmail(authUser.email ?? null);
      setStudentCenterId(null);
      setStudentCenterSlug(null);
    }
  };

  // Sign up function
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    captchaToken?: string,
  ) => {
    try {
      setLoading(true);

      // Register user with Supabase auth (student-only platform)
      const authResult = await authService.register({
        email,
        password,
        fullName,
        captchaToken,
      });

      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || "Registration failed",
        };
      }

      // Database trigger will automatically create student_profiles entry
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Registration failed",
      };
    } finally {
      setLoading(false);
    }
  };

  // Sign in function
  const signIn = async (
    email: string,
    password: string,
    captchaToken?: string,
  ) => {
    try {
      setLoading(true);

      const result = await authService.login({ email, password, captchaToken });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Login failed",
        };
      }

      // Database trigger ensures student profile exists
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    } finally {
      setLoading(false);
    }
  };

  // Get user redirect without signing in (for checking existing session)
  const getUserRedirect = async () => {
    try {
      return await authService.getUserRedirectPath();
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get redirect",
      };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setLoading(true);
      await authService.signOut();
      setUser(null);
      setSession(null);
      setUserProfile(null);
      setStudentId(null);
      setStudentName(null);
      setStudentEmail(null);
      setStudentCenterId(null);
      setStudentCenterSlug(null);

      // Redirect to login after logout
      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh user profile
  const refreshUserProfile = async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    studentId,
    studentName,
    studentEmail,
    studentCenterId,
    studentCenterSlug,
    loading,
    signUp,
    signIn,
    signOut,
    refreshUserProfile,
    getUserRedirect,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
