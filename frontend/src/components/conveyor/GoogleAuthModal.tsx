import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth, GOOGLE_CLIENT_ID } from "@/lib/authContext";
import { ShieldCheck, LogOut, CheckCircle2 } from "lucide-react";

export function GoogleAuthModal() {
  const {
    user,
    isAuthModalOpen,
    setIsAuthModalOpen,
    loginWithGoogleCredential,
    loginWithGooglePopup,
    logout,
  } = useAuth();

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize and render Google Identity Services button inside the dialog
  useEffect(() => {
    if (!isAuthModalOpen || user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (google?.accounts?.id && googleBtnRef.current) {
      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential?: string }) => {
            if (response.credential) {
              loginWithGoogleCredential(response.credential);
            }
          },
        });

        google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "filled_blue",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: "signin_with",
          logo_alignment: "left",
          width: 320,
        });
      } catch {
        // ignore initialization errors if already initialized
      }
    }
  }, [isAuthModalOpen, user, loginWithGoogleCredential]);

  const emailInitial = user?.email
    ? user.email.charAt(0).toUpperCase()
    : user?.name
      ? user.name.charAt(0).toUpperCase()
      : "U";

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
      <DialogContent className="sm:max-w-[420px] border-border/80 bg-panel/95 backdrop-blur-xl p-6 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-info text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="size-4 text-info" />
            <span>Control Room Security</span>
          </div>
          <DialogTitle className="text-xl font-extrabold tracking-tight text-foreground">
            {user ? "Active Operator Profile" : "Operator Authentication"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {user
              ? "Verified conveyor telemetry control session."
              : "Sign in with your Google Workspace or Operator account to access telemetry logs and work orders."}
          </DialogDescription>
        </DialogHeader>

        {user ? (
          /* Logged-in Operator Profile View */
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4 rounded-xl border border-normal/40 bg-normal-soft/20 p-4">
              <div className="relative">
                <div className="grid size-14 place-items-center rounded-full border-2 border-normal bg-info/20 text-2xl font-black text-info shadow-md">
                  {emailInitial}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background bg-normal" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-base font-bold text-foreground">{user.name}</h3>
                  <CheckCircle2 className="size-4 shrink-0 text-normal" />
                </div>
                <p className="truncate text-xs text-muted-foreground font-mono">{user.email}</p>
                <div className="mt-1 inline-flex items-center gap-1 rounded bg-normal/15 px-2 py-0.5 text-[0.625rem] font-bold text-normal uppercase">
                  {user.role}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border/70 bg-secondary/40 p-2.5">
                <span className="text-[0.625rem] font-semibold text-muted-foreground uppercase">Auth Provider</span>
                <p className="font-bold text-foreground capitalize">{user.authProvider}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/40 p-2.5">
                <span className="text-[0.625rem] font-semibold text-muted-foreground uppercase">Session Started</span>
                <p className="font-bold text-foreground font-mono">{user.signedInAt}</p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={logout}
                className="w-full border-critical/40 text-critical hover:bg-critical-soft text-xs font-bold uppercase tracking-wider"
              >
                <LogOut className="size-3.5 mr-2" />
                Sign Out Operator
              </Button>
            </div>
          </div>
        ) : (
          /* Sign-In View */
          <div className="space-y-4 pt-3">
            {/* Rendered Google Identity Services Button */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div ref={googleBtnRef} className="min-h-[44px] flex justify-center w-full" />

              {/* Direct Popup Trigger Button */}
              <Button
                type="button"
                onClick={loginWithGooglePopup}
                className="w-full flex items-center justify-center gap-2 bg-white text-gray-800 hover:bg-gray-100 font-semibold text-xs border border-gray-300 shadow-sm min-h-10 cursor-pointer"
              >
                <svg className="size-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
