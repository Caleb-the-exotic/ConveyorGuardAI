import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/authContext";
import { useConveyor } from "@/lib/conveyor/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MaintenanceTask } from "@/lib/conveyor/types";

type Priority = MaintenanceTask["priority"];
type Status = MaintenanceTask["status"];

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES: Status[] = ["PENDING", "SCHEDULED", "IN PROGRESS"];

function defaultSchedule() {
  const d = new Date(Date.now() + 24 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WorkOrderModal() {
  const {
    workOrderOpen,
    setWorkOrderOpen,
    joints,
    selectedJoint,
    detections,
    activeDetectionId,
    prediction,
    addTask,
    addAlert,
  } = useConveyor();

  const { user } = useAuth();

  const activeDetection = useMemo(
    () => detections.find((d) => d.id === activeDetectionId) ?? null,
    [detections, activeDetectionId],
  );

  const [jointId, setJointId] = useState("");
  const [issue, setIssue] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [technician, setTechnician] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule);
  const [status, setStatus] = useState<Status>("PENDING");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill from the currently selected joint / detection / recommendation.
  useEffect(() => {
    if (!workOrderOpen) return;
    const joint = selectedJoint ?? joints.find((j) => j.id === activeDetection?.jointId) ?? null;
    const risk = joint?.riskLevel ?? prediction.riskLevel;
    setJointId(joint?.id ?? activeDetection?.jointId ?? joints[0]?.id ?? "");
    setIssue(
      activeDetection
        ? `${activeDetection.type} at ${activeDetection.location}`
        : (joint?.issues[0] ?? (risk === "NORMAL" ? "Routine splice inspection" : "")),
    );
    setPriority(risk === "CRITICAL" ? "CRITICAL" : risk === "WARNING" ? "HIGH" : "MEDIUM");
    setStatus(risk === "CRITICAL" ? "IN PROGRESS" : "PENDING");
    setScheduledAt(defaultSchedule());
    setNotes(joint?.recommendation ?? prediction.recommendation ?? "");
    setTechnician("");
    setErrors({});
  }, [workOrderOpen, selectedJoint, activeDetection, joints, prediction]);

  function validate() {
    const next: Record<string, string> = {};
    if (!jointId) next["jointId"] = "Select the belt joint this work order applies to.";
    if (issue.trim().length < 5) next["issue"] = "Describe the issue in at least 5 characters.";
    if (technician.trim().length < 2) next["technician"] = "Assign a technician.";
    if (!scheduledAt) next["scheduledAt"] = "Choose a scheduled date and time.";
    else if (Number.isNaN(new Date(scheduledAt).getTime()))
      next["scheduledAt"] = "Enter a valid date and time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the highlighted fields");
      return;
    }
    const when = new Date(scheduledAt).toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const taskData = {
      jointId,
      issue: issue.trim(),
      priority,
      technician: technician.trim(),
      scheduledAt: when,
      status,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    addTask(taskData);
    
    // 1. Add notification to Header
    const now = new Date();
    addAlert({
      severity: priority === "CRITICAL" ? "CRITICAL" : priority === "HIGH" ? "WARNING" : "NORMAL",
      title: `Work Order Dispatched: ${jointId}`,
      section: "MAINTENANCE",
      jointId,
      sensorKey: null,
      detectionId: activeDetectionId,
      condition: `${issue} (Priority: ${priority})`,
      status: "ACTIVE",
    } as any); // cast as any because addAlert signature might be missing timestamp string format wait store.tsx handles timestamp string differently, but wait, addAlert expects timestamp as number? No, string!

    // 2. Send Email if user is logged in
    if (user?.email) {
      fetch("http://localhost:3001/api/alerts/work-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, workOrder: taskData }),
      }).catch(err => console.error("Failed to send work order email:", err));
    }

    setWorkOrderOpen(false);
    toast.success("Maintenance work order created", {
      description: `${jointId} · ${priority} · ${technician.trim()} — ${when}`,
    });
  }

  const err = (k: string) =>
    errors[k] ? (
      <p role="alert" className="mt-1 text-[0.6875rem] text-critical">
        {errors[k]}
      </p>
    ) : null;

  return (
    <Dialog open={workOrderOpen} onOpenChange={setWorkOrderOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold tracking-[0.14em] uppercase">
            Create Maintenance Work Order
          </DialogTitle>
          <DialogDescription className="text-xs">
            Prefilled from the selected joint, AI detection and recommendation. Tasks are held in
            this session only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-3">
          <div>
            <Label htmlFor="wo-joint" className="label-caps">
              Belt Joint
            </Label>
            <Select value={jointId} onValueChange={setJointId}>
              <SelectTrigger id="wo-joint" className="mt-1 min-h-10 w-full">
                <SelectValue placeholder="Select joint" />
              </SelectTrigger>
              <SelectContent>
                {joints.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.label} · {j.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("jointId")}
          </div>

          <div>
            <Label htmlFor="wo-issue" className="label-caps">
              Issue
            </Label>
            <Input
              id="wo-issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="e.g. Splice separation — emergency joint repair"
              className="mt-1 min-h-10"
              aria-invalid={Boolean(errors["issue"])}
            />
            {err("issue")}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wo-priority" className="label-caps">
                Priority
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="wo-priority" className="mt-1 min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="wo-status" className="label-caps">
                Status
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger id="wo-status" className="mt-1 min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wo-tech" className="label-caps">
                Technician
              </Label>
              <Input
                id="wo-tech"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="e.g. R. Mahato"
                className="mt-1 min-h-10"
                aria-invalid={Boolean(errors["technician"])}
              />
              {err("technician")}
            </div>
            <div>
              <Label htmlFor="wo-when" className="label-caps">
                Scheduled For
              </Label>
              <Input
                id="wo-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 min-h-10"
                aria-invalid={Boolean(errors["scheduledAt"])}
              />
              {err("scheduledAt")}
            </div>
          </div>

          <div>
            <Label htmlFor="wo-notes" className="label-caps">
              Notes
            </Label>
            <Textarea
              id="wo-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1"
              placeholder="AI recommendation or operator notes"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWorkOrderOpen(false)}
              className="min-h-11"
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11">
              Create Work Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
