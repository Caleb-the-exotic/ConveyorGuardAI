import { useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/authContext";
import { useConveyor } from "@/lib/conveyor/store";

const IN_APP_COOLDOWN_MS = 30 * 1000; // 30 seconds
const EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function useNotifications() {
  const lastInAppNotification = useRef<number>(0);
  const lastEmailNotification = useRef<number>(0);
  const { user } = useAuth();
  const { addAlert } = useConveyor();

  const triggerCriticalAlert = useCallback(async (defectDetails: any) => {
    const now = Date.now();

    // In-App Notification (Toast and Header Alert)
    if (now - lastInAppNotification.current > IN_APP_COOLDOWN_MS) {
      toast.error(`CRITICAL ISSUE DETECTED: ${defectDetails.label || "Anomaly"}`, {
        description: "Immediate inspection required.",
        duration: 8000,
      });
      addAlert({
        severity: "CRITICAL",
        title: `Vision Detection: ${defectDetails.label || "Anomaly"}`,
        section: "AI VISION",
        jointId: "CV-CAM-1",
        sensorKey: null,
        detectionId: null,
        condition: `Confidence: ${Math.round((defectDetails.confidence || 0) * 100)}%`,
        status: "ACTIVE",
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
  }, [user, addAlert]);

  return { triggerCriticalAlert };
}
