import { User, AuthError, Session } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

export interface AuthFormData {
  email: string;
  password: string;
  fullName?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  role?: "regular" | "admin" | "owner" | "examiner";
  captchaToken?: string;
}

export interface LoginData {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  session?: Session | null;
  user?: User;
}

export interface UserProfile {
  user_id: string;
  email: string;
  role: "student" | "examiner" | "admin";
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class AuthService {
  supabase = createClient();

  private isAdminRole(role?: string) {
    return role === "admin" || role === "owner" || role === "examiner";
  }

  private normalizeCenterName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Sync user profile with auth session
   */
  async upsertUserFromSession(
    session: Session | null,
    opts?: {
      fullName?: string;
      role?: "regular" | "admin" | "owner" | "examiner";
    },
  ) {
    try {
      const user = session?.user;
      if (!user) {
        return;
      }

      if (!this.isAdminRole(opts?.role)) {
        return;
      }

      const metadata: any = user.user_metadata || {};
      const full_name =
        opts?.fullName ??
        metadata.full_name ??
        metadata.name ??
        user.email?.split("@")[0] ??
        "User";

      const nowIso = new Date().toISOString();

      // First, try to check if user profile exists
      const { data: existingProfile } = await this.supabase
        .from("users")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

      if (existingProfile) {
        // Profile exists, just update it
        const { error } = await this.supabase
          .from("users")
          .update({
            full_name,
            updated_at: nowIso,
            is_active: true,
          })
          .eq("user_id", user.id);

        if (error) {
          console.error("Error updating user profile:", error);
        }
      } else {
        // Profile doesn't exist, create it (no center_id needed)
        const { error } = await this.supabase.from("users").insert({
          user_id: user.id,
          email: user.email!,
          role: opts?.role || "admin", // Use provided role or default to admin
          full_name,
          is_active: true,
        });

        if (error) {
          console.error("Error creating user profile:", error);
          // Try upsert as fallback
          const { error: upsertError } = await this.supabase
            .from("users")
            .upsert(
              {
                user_id: user.id,
                email: user.email!,
                role: opts?.role || "admin",
                full_name,
                is_active: true,
              },
              { onConflict: "user_id" },
            );

          if (upsertError) {
            console.error("Error upserting user profile:", upsertError);
          }
        }
      }
    } catch (e) {
      console.error("Exception during user profile management:", e);
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Attempt to sign up with Supabase Auth
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");

      const { data: authData, error: authError } =
        await this.supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${siteUrl}/auth/callback`,
            data: {
              full_name: data.fullName,
            },
            captchaToken: data.captchaToken,
          },
        });

      if (authError) {
        console.error("Signup error:", authError);
        let errorMessage = authError.message;

        switch (authError.message) {
          case "User already registered":
            errorMessage =
              "An account with this email already exists. Please try signing in instead.";
            break;
          case "Password should be at least 6 characters":
            errorMessage = "Password must be at least 6 characters long.";
            break;
          case "Invalid email":
            errorMessage = "Please enter a valid email address.";
            break;
          case "Signup is disabled":
            errorMessage =
              "Account registration is currently disabled. Please contact support.";
            break;
          case "Email rate limit exceeded":
            errorMessage =
              "Too many signup attempts. Please wait a few minutes before trying again.";
            break;
          case "Database error saving new user":
            errorMessage =
              "Unable to create your account. This may be a temporary issue. Please try again in a few moments or contact support if the problem persists.";
            break;
          case "Error sending confirmation email":
            errorMessage =
              "Your account was created successfully! However, we couldn't send the confirmation email. Please contact support to verify your account, or try signing in.";
            break;
          default:
            if (
              authError.message.includes("Error sending confirmation email") ||
              authError.message.includes("SMTP") ||
              authError.message.includes("mail")
            ) {
              errorMessage =
                "Your account was created successfully! However, we couldn't send the confirmation email. Please contact support to verify your account, or try signing in.";
            } else if (authError.message.includes("email")) {
              errorMessage =
                "Please check that your email address is valid and not already in use.";
            } else if (authError.message.includes("password")) {
              errorMessage = "Password does not meet the requirements.";
            } else if (
              authError.message.includes("500") ||
              authError.message.includes("Internal")
            ) {
              errorMessage =
                "Our server is experiencing issues. Please try again in a few moments.";
            } else {
              errorMessage =
                "Unable to create account. Please try again or contact support if the issue persists.";
            }
            break;
        }

        return { success: false, error: errorMessage };
      }

      if (authData.user && !authData.session) {
        const verificationMessage =
          "Please check your email for a verification link to complete your sign-up.";

        return {
          success: true,
          error: verificationMessage,
          user: authData.user,
        };
      }

      if (authData.user && authData.session) {
        return {
          success: true,
          session: authData.session,
          user: authData.user,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: "Failed to create account. Please try again.",
        };
      }

      return {
        success: true,
        session: authData.session,
        user: authData.user,
      };
    } catch (error) {
      return {
        success: false,
        error:
          "An unexpected error occurred during registration. Please check your internet connection and try again.",
      };
    }
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const { data: authData, error } =
        await this.supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
          options: {
            captchaToken: data.captchaToken,
          },
        });

      if (error) {
        // Handle specific error cases with user-friendly messages
        let errorMessage = error.message;

        switch (error.message) {
          case "Invalid login credentials":
            errorMessage =
              "Invalid email or password. Please check your credentials and try again.";
            break;
          case "Email not confirmed":
            errorMessage =
              "Please verify your email address before signing in. Check your inbox for a verification link.";
            break;
          case "Too many requests":
            errorMessage =
              "Too many login attempts. Please wait a few minutes before trying again.";
            break;
          case "User not found":
            errorMessage =
              "No account found with this email address. Please check your email or create a new account.";
            break;
          default:
            errorMessage = error.message;
            break;
        }

        return { success: false, error: errorMessage };
      }

      if (!authData.session) {
        return {
          success: false,
          error: "Failed to create session. Please try again.",
        };
      }

      return {
        success: true,
        session: authData.session,
        user: authData.user,
      };
    } catch (error) {
      return {
        success: false,
        error:
          "An unexpected error occurred. Please check your internet connection and try again.",
      };
    }
  }

  /**
   * Get student's access status (role + student profile + center)
   */
  async getStudentAccess(): Promise<{
    success: boolean;
    allowed: boolean;
    userId?: string;
    userEmail?: string;
    centerSlug?: string;
    redirectPath?: string;
    error?: string;
  }> {
    try {
      const {
        data: { user: authUser },
      } = await this.supabase.auth.getUser();

      if (!authUser) {
        return {
          success: false,
          allowed: false,
          redirectPath: "/auth/login",
          error: "Authentication failed. Please try again.",
        };
      }

      if (!authUser.email) {
        return {
          success: false,
          allowed: false,
          redirectPath: "/auth/login",
          error: "Email not available.",
        };
      }

      const { data: studentProfile, error: studentError } = await this.supabase
        .from("student_profiles")
        .select("student_id, center_id, email")
        .eq("email", authUser.email)
        .maybeSingle();

      if (!studentProfile) {
        return {
          success: true,
          allowed: false,
          redirectPath: "/auth/login",
          error: studentError?.message || "Student profile not found.",
        };
      }

      const { data: center, error: centerError } = await this.supabase
        .from("centers")
        .select("center_id, slug")
        .eq("center_id", studentProfile.center_id)
        .maybeSingle();

      if (!center?.slug || centerError) {
        return {
          success: true,
          allowed: false,
          redirectPath: "/auth/login",
          error: "Center not found.",
        };
      }

      return {
        success: true,
        allowed: true,
        userId: authUser.id,
        userEmail: authUser.email,
        centerSlug: center.slug,
      };
    } catch (error) {
      console.error("Error determining redirect path:", error);
      return {
        success: false,
        allowed: false,
        redirectPath: "/auth/login",
        error: "Failed to determine access",
      };
    }
  }

  /**
   * Verify student profile against a center name (onboarding)
   */
  async verifyStudentCenterName(centerName: string): Promise<{
    success: boolean;
    allowed: boolean;
    centerId?: string;
    error?: string;
  }> {
    try {
      const {
        data: { user: authUser },
      } = await this.supabase.auth.getUser();

      if (!authUser) {
        return {
          success: false,
          allowed: false,
          error: "Not authenticated",
        };
      }

      if (!authUser.email) {
        return {
          success: false,
          allowed: false,
          error: "Email not available",
        };
      }

      const normalizedInput = this.normalizeCenterName(centerName);

      const { data: centers, error: centersError } = await this.supabase
        .from("centers")
        .select("center_id, name, is_active")
        .ilike("name", centerName);

      if (centersError || !centers || centers.length === 0) {
        return {
          success: true,
          allowed: false,
          error: "Center not found",
        };
      }

      const matchedCenter = centers.find(
        (center) =>
          center.is_active &&
          this.normalizeCenterName(center.name) === normalizedInput,
      );

      if (!matchedCenter) {
        return {
          success: true,
          allowed: false,
          error: "Center not found or inactive",
        };
      }

      const { data: studentProfile, error: studentError } = await this.supabase
        .from("student_profiles")
        .select("student_id, center_id, email")
        .eq("center_id", matchedCenter.center_id)
        .eq("email", authUser.email)
        .single();

      if (studentError || !studentProfile) {
        return {
          success: true,
          allowed: false,
          error: "Student profile not found",
        };
      }

      return {
        success: true,
        allowed: true,
        centerId: matchedCenter.center_id,
      };
    } catch (error) {
      return {
        success: false,
        allowed: false,
        error:
          error instanceof Error ? error.message : "Failed to verify center",
      };
    }
  }

  /**
   * Get redirect path after login for student-only access
   */
  async getUserRedirectPath(): Promise<{
    success: boolean;
    path?: string;
    centerName?: string;
    error?: string;
  }> {
    const access = await this.getStudentAccess();

    if (!access.success) {
      return {
        success: false,
        error: access.error || "Failed to determine redirect path",
      };
    }

    if (!access.allowed) {
      return {
        success: true,
        path: access.redirectPath || "/auth/login",
      };
    }

    return {
      success: true,
      path: access.centerSlug
        ? `/mock-test/${access.centerSlug}`
        : "/mock-test",
    };
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        error: "Password reset instructions sent to your email",
      };
    } catch (error) {
      const authError = error as AuthError;
      return { success: false, error: authError.message };
    }
  }

  /**
   * Update password (for password reset)
   */
  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        // Handle specific error cases with user-friendly messages
        let errorMessage = error.message;

        switch (error.message) {
          case "Password should be at least 6 characters":
            errorMessage = "Password must be at least 6 characters long.";
            break;
          case "New password should be different from the old password.":
            errorMessage =
              "Please choose a different password from your current one.";
            break;
          default:
            if (error.message.includes("password")) {
              errorMessage = "Password does not meet the requirements.";
            }
            break;
        }

        return { success: false, error: errorMessage };
      }

      if (!data.user) {
        return {
          success: false,
          error: "Failed to update password. Please try again.",
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          "An unexpected error occurred while updating your password. Please try again.",
      };
    }
  }

  /**
   * Change password (requires current password verification)
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: sessionData } = await this.supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session?.user?.email) {
        return { success: false, error: "Not authenticated" };
      }

      if (newPassword !== confirmPassword) {
        return { success: false, error: "Passwords do not match" };
      }

      // Re-authenticate with current password
      const { error: signInError } =
        await this.supabase.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword,
        });

      if (signInError) {
        return { success: false, error: "Current password is incorrect" };
      }

      // Update to new password
      const { error: updateError } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Create user profile in public.users table
   */
  async createUserProfile(
    userId: string,
    email: string,
    fullName: string,
    role: "regular" | "admin" | "owner" | "examiner" = "admin",
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .insert({
          user_id: userId,
          email: email,
          role: role,
          full_name: fullName,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create user profile",
      };
    }
  }

  /**
   * Get user profile from public.users table
   */
  async getUserProfile(
    userId: string,
  ): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      if (!data) {
        return {
          success: false,
          error: "No user profile found",
        };
      }

      return {
        success: true,
        profile: data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch user profile",
      };
    }
  }

  /**
   * Get user's centers
   */
  async getUserCenters(userId: string): Promise<{
    success: boolean;
    centers?: Array<{ slug: string; name: string; center_id: string }>;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from("centers")
        .select("center_id, name, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        centers: data || [],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch user centers",
      };
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<AuthResponse> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Sign out failed",
      };
    }
  }

  /**
   * Get current session
   */
  async getSession() {
    try {
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      if (error) {
        throw error;
      }

      return session;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      if (error) {
        if (error.name === "AuthSessionMissingError") {
          return null;
        }
        throw error;
      }

      return user;
    } catch (error) {
      if (error instanceof Error && error.name === "AuthSessionMissingError") {
        return null;
      }
      console.error("Error getting user:", error);
      return null;
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export helper functions for convenience
export const signInWithEmail = (email: string, password: string) =>
  authService.login({ email, password });

export const signUpWithEmail = (
  email: string,
  password: string,
  fullName: string,
) => authService.register({ email, password, fullName });

export const resetPassword = (email: string) =>
  authService.resetPassword(email);

export const getCurrentUser = () => authService.getCurrentUser();

export const getUser = () => authService.getCurrentUser();

export const updatePassword = (newPassword: string) =>
  authService.updatePassword(newPassword);

export const changePassword = (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) => authService.changePassword(currentPassword, newPassword, confirmPassword);
