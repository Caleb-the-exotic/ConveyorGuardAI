import { useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/authContext";

const IN_APP_COOLDOWN_MS = 30 * 1000; // 30 seconds
const EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function useNotifications() {
  const lastInAppNotification = useRef<number>(0);
  const lastEmailNotification = useRef<number>(0);
  const { user } = useAuth();

  const triggerCriticalAlert = useCallback(async (defectDetails: any) => {
    const now = Date.now();

    // In-App Notification (Toast)
    if (now - lastInAppNotification.current > IN_APP_COOLDOWN_MS) {
      toast.error(`CRITICAL ISSUE DETECTED: ${defectDetails.label || "Anomaly"}`, {
        description: "Immediate inspection required.",
        duration: 8000,
      });
      lastInAppNotification.current = now;
    }

    // Email Notification
    if (user && user.email && now - lastEmailNotification.current > EMAIL_COOLDOWN_MS) {
      try {
        const res = await fetch("http://localhost:3001/api/alerts/critical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            defectDetails,
          }),
        });

        if (res.ok) {
          console.log(`Sent critical alert email to ${user.email}`);
          lastEmailNotification.current = now;
        } else {
          console.error("Failed to send critical alert email.");
        }
      } catch (err) {
        console.error("Error connecting to notification service:", err);
      }
    }
  }, [user]);

  return { triggerCriticalAlert };
}
