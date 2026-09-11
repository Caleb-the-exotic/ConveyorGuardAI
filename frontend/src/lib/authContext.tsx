import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export const GOOGLE_CLIENT_ID =
  "636323915989-tv86d297r75nsghrak09t9u1ct59i2a7.apps.googleusercontent.com";
export const GOOGLE_CLIENT_SECRET =
  "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";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: string;
  signedInAt: string;
  authProvider: "google";
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginWithGoogleCredential: (jwtToken: string) => void;
  loginWithGooglePopup: () => void;
  logout: () => void;
  isOtpPending: boolean;
  pendingEmail?: string;
  verifyOtp: (code: string) => Promise<void>;
}

const STORAGE_KEY = "conveyorguard_auth_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOtpPending, setIsOtpPending] = useState(false);
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setIsOtpPending(false);
    setPendingUser(null);
  }, []);

  const initiateOtpFlow = async (authUser: AuthUser) => {
    try {
      toast.info("Sending verification code to your email...");
      const res = await fetch("http://localhost:3001/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authUser.email })
      });
      if (res.ok) {
        setPendingUser(authUser);
        setIsOtpPending(true);
        toast.success("Verification code sent to your email.");
      } else {
        toast.error("Failed to send verification code. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error communicating with authentication server.");
    }
  };

  const verifyOtp = async (code: string) => {
    if (!pendingUser) return;
    try {
      const res = await fetch("http://localhost:3001/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingUser.email, code })
      });
      if (res.ok) {
        setUser(pendingUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingUser));
        setIsAuthModalOpen(false);
        setIsOtpPending(false);
        setPendingUser(null);
        toast.success(`Welcome, ${pendingUser.name}! Login successful.`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Invalid OTP code.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error verifying code.");
    }
  };

  const loginWithGoogleCredential = useCallback((jwtToken: string) => {
    const payload = parseJwt(jwtToken);
    if (!payload) {
      toast.error("Invalid Google authentication token.");
      return;
    }

    const authUser: AuthUser = {
      id: payload.sub || "google-user",
      name: payload.name || payload.email || "Conveyor Operator",
      email: payload.email || "",
      picture: payload.picture,
      role: "Lead Conveyor Systems Operator",
      signedInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      authProvider: "google",
    };

    initiateOtpFlow(authUser);
  }, []);

  const loginWithGooglePopup = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (google?.accounts?.oauth2) {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "email profile openid",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: async (resp: any) => {
          if (resp.error) {
            toast.error(`Google Sign-In Error: ${resp.error}`);
            return;
          }
          if (resp.access_token) {
            try {
              const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${resp.access_token}` },
              });
              if (res.ok) {
                const data = await res.json();
                const authUser: AuthUser = {
                  id: data.sub || "google-user",
                  name: data.name || data.email,
                  email: data.email,
                  picture: data.picture,
                  role: "Lead Conveyor Systems Operator",
                  signedInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  authProvider: "google",
                };
                initiateOtpFlow(authUser);
              }
            } catch {
              toast.error("Failed to retrieve profile from Google API.");
            }
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
      toast.info("Google Identity Services is loading. Please try in a moment.");
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setIsAuthModalOpen(false);
    setIsOtpPending(false);
    setPendingUser(null);
    toast.info("Signed out of ConveyorGuard AI.");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthModalOpen,
        setIsAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithGoogleCredential,
        loginWithGooglePopup,
        logout,
        isOtpPending,
        pendingEmail: pendingUser?.email,
        verifyOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
