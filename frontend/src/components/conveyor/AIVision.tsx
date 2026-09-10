import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  CameraOff,
  ScanLine,
  Cpu,
  AlertTriangle,
  ChevronDown,
  Upload,
  SwitchCamera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import type { Condition } from "@/lib/conveyor/types";
import { Panel } from "./primitives";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CVMode = "AI_OVERLAY" | "CANNY_EDGE" | "THERMAL_IR" | "RAW_RGB";

interface Detection {
  label: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  box_raw?: number[];
}

interface ModelOption {
  id: string;
  name: string;
  filename: string;
  desc: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "roboflow_damage",
    name: "roboflow_conveyor_damage.pt",
    filename: "roboflow_conveyor_damage.pt",
    desc: "Trained Conveyor Belt Crack & Damage Detector",
  },
];

function getDefectStyle(label: string) {
  const l = label.toLowerCase();
  if (l.includes("conveyor belt") || l === "belt" || l.includes("belt surface")) {
    return {
      border: "border-emerald-500 bg-emerald-500/15 ",
      badge: "border-emerald-500 bg-emerald-600 text-white font-bold",
      text: "text-emerald-400 font-bold",
      severity: "NORMAL",
    };
  }
  if (l.includes("crack") || l.includes("tear") || l.includes("fracture") || l.includes("fissure")) {
    return {
      border: "border-red-500 bg-red-500/10 ",
      badge: "border-red-500 bg-red-600 text-white font-bold",
      text: "text-red-500 font-bold",
      severity: "CRITICAL",
    };
  }
  if (l.includes("puncture") || l.includes("hole") || l.includes("gouge") || l.includes("perforation")) {
    return {
      border: "border-amber-500 bg-amber-500/10 ",
      badge: "border-amber-500 bg-amber-500 text-black font-extrabold",
      text: "text-amber-500 font-bold",
      severity: "CRITICAL",
    };
  }
  if (l.includes("patch") || l.includes("wear") || l.includes("damage") || l.includes("anomaly")) {
    return {
      border: "border-yellow-400 bg-yellow-400/10 ",
      badge: "border-yellow-400 bg-yellow-400 text-black font-extrabold",
      text: "text-yellow-400 font-bold",
      severity: "WARNING",
    };
  }
  return {
    border: "border-cyan-400 bg-cyan-400/10 ",
    badge: "border-cyan-400 bg-cyan-500 text-white font-bold",
    text: "text-cyan-400 font-bold",
    severity: "INFO",
  };
}

function boxTone(c: Condition) {
  switch (c) {
    case "CRITICAL": return "border-critical text-critical";
    case "WARNING":  return "border-warning text-warning";
    case "NORMAL":   return "border-normal text-normal";
    default:         return "border-border text-muted-foreground";
  }
}

export function AIVision() {
  const { detections, activeDetectionId, focusDetection, selectedJointId, joints, activeScenario } =
    useConveyor();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cvMode, setCvMode] = useState<CVMode>("AI_OVERLAY");
  const [fps, setFps] = useState<number>(0);

  // Model Selection Dropdown State (Defaults to Trained Crack & Damage Detector)
  const [selectedModel, setSelectedModel] = useState<string>("roboflow_damage");
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [activeDetections, setActiveDetections] = useState<Detection[]>([]);
  const [currentModelName, setCurrentModelName] = useState<string>("Roboflow Dual AI (Belt Isolation & Defect Engine)");
  const [inferenceLatency, setInferenceLatency] = useState<number | null>(null);
  const [anomalyCount, setAnomalyCount] = useState<number>(0);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const wsRef = useRef<WebSocket | null>(null);
  const isSendingFrameRef = useRef<boolean>(false);
  const selectedModelRef = useRef<string>(selectedModel);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep refs synchronized
  useEffect(() => {
    selectedModelRef.current = selectedModel;
    const found = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
    if (found) {
      setCurrentModelName(`${found.filename} (${found.desc})`);
    }
  }, [selectedModel]);

  const jointLabel = joints.find((j) => j.id === selectedJointId)?.label;

  // Active Recurring Backend Health Poller (checks 127.0.0.1 and localhost)
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch("http://127.0.0.1:8000/health", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok && mounted) {
          setBackendConnected(true);
          return;
        }
      } catch {
        try {
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 2000);
          const res2 = await fetch("http://localhost:8000/health", { signal: controller2.signal });
          clearTimeout(timeoutId2);
          if (res2.ok && mounted) {
            setBackendConnected(true);
            return;
          }
        } catch {
          if (mounted) setBackendConnected(false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // WebSocket Connection for Live Camera Stream
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket("ws://127.0.0.1:8000/ws/evaluate");
      wsRef.current = ws;

      ws.onopen = () => {
        setBackendConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          setBackendConnected(true);
          const payload = JSON.parse(event.data);
          if (payload.data) {
            const res = payload.data;
            setActiveDetections(res.detections || []);
            setInferenceLatency(res.duration_ms || null);
            setAnomalyCount(res.count || 0);
            if (payload.model_name) {
              setCurrentModelName(payload.model_name);
            }
          }
        } catch {
          // ignore
        } finally {
          isSendingFrameRef.current = false;
        }
      };

      ws.onerror = () => {
        isSendingFrameRef.current = false;
      };

      ws.onclose = () => {
        isSendingFrameRef.current = false;
      };
    } catch {
      setBackendConnected(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsCameraActive(false);
    setActiveDetections([]);
    setFps(0);
    isSendingFrameRef.current = false;
  }, []);

  // Enumerate video devices
  const updateCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      return videoInputs;
    } catch {
      return [];
    }
  }, []);

  const startCamera = async (targetDeviceId?: string) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser environment.");
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const devList = await updateCameraDevices();
      const activeDevId = targetDeviceId || selectedDeviceId || (devList[0]?.deviceId ?? "");

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(activeDevId ? { deviceId: { exact: activeDevId } } : { facingMode: "environment" }),
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        if (settings.deviceId) setSelectedDeviceId(settings.deviceId);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      setUploadedImage(null);
      setActiveDetections([]);
      connectWebSocket();
      toast.success("Industrial Vision feed active");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not open camera";
      toast.error(msg);
      setIsCameraActive(false);
    }
  };

  const switchCamera = async () => {
    if (videoDevices.length <= 1) {
      toast.info("Only one camera device detected.");
      return;
    }
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    if (nextDevice) {
      setSelectedDeviceId(nextDevice.deviceId);
      await startCamera(nextDevice.deviceId);
      toast.info(`Switched to camera: ${nextDevice.label || `Device ${nextIndex + 1}`}`);
    }
  };

  useEffect(() => {
    updateCameraDevices();
    const onDeviceChange = () => {
      updateCameraDevices();
    };
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    }

    return () => {
      stopCamera();
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // High-reliability REST evaluation for uploaded images
  const analyzeImageDirectly = useCallback(async (dataUrl: string, modelId: string) => {
    setIsAnalyzingImage(true);
    setActiveDetections([]);
    setInferenceLatency(null);
    setAnomalyCount(0);

    try {
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const fd = new FormData();
      fd.append("file", blob, "uploaded_frame.jpg");
      fd.append("model_id", modelId);
      fd.append("confidence", "0.05");

      let res: Response | null = null;
      try {
        res = await fetch("http://127.0.0.1:8000/api/evaluate", {
          method: "POST",
          body: fd,
        });
      } catch {
        res = await fetch("http://localhost:8000/api/evaluate", {
          method: "POST",
          body: fd,
        });
      }

      if (res && res.ok) {
        setBackendConnected(true);
        const data = await res.json();
        const results = data.detections || [];
        setActiveDetections(results);
        setInferenceLatency(data.duration_ms || null);
        setAnomalyCount(data.count || results.length);
        if (data.model_name) setCurrentModelName(data.model_name);
        toast.success(`Evaluation complete: ${results.length} defect(s) detected`);
      } else {
        toast.error("Backend error during defect analysis");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Inference failed. Please ensure the backend server is running on port 8000.");
    } finally {
      setIsAnalyzingImage(false);
    }
  }, []);

  // Automatically re-evaluate whenever user changes model while an image is displayed
  useEffect(() => {
    if (uploadedImage && !isCameraActive) {
      analyzeImageDirectly(uploadedImage, selectedModel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);

  // Handle image upload: show image + run ML inference on it
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value immediately so user can select the same file multiple times
    if (fileInputRef.current) fileInputRef.current.value = "";
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setUploadedImage(dataUrl);
        analyzeImageDirectly(dataUrl, selectedModelRef.current);
      }
    };
    reader.readAsDataURL(file);
  }, [analyzeImageDirectly]);

  // Real-time CV & Backend ML inference dispatch loop
  useEffect(() => {
    if (!isCameraActive) return;

    let running = true;
    let lastEvalTime = 0;

    const loop = (now: number) => {
      if (!running) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);

          // FPS tracking
          frameCountRef.current++;
          if (now - lastFpsTimeRef.current >= 1000) {
            setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current)));
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
          }

          // Real-time OpenCV Edge / Thermal image transformations
          if (cvMode === "CANNY_EDGE") {
            const frame = ctx.getImageData(0, 0, w, h);
            const d = frame.data;
            const gray = new Uint8ClampedArray(w * h);

            for (let i = 0, j = 0; i < d.length; i += 4, j++) {
              gray[j] = ((d[i]! * 77 + d[i + 1]! * 150 + d[i + 2]! * 29) >> 8) & 0xff;
            }

            for (let y = 1; y < h - 1; y++) {
              for (let x = 1; x < w - 1; x++) {
                const c00 = gray[(y - 1) * w + (x - 1)]!;
                const c01 = gray[(y - 1) * w + x]!;
                const c02 = gray[(y - 1) * w + (x + 1)]!;
                const c10 = gray[y * w + (x - 1)]!;
                const c12 = gray[y * w + (x + 1)]!;
                const c20 = gray[(y + 1) * w + (x - 1)]!;
                const c21 = gray[(y + 1) * w + x]!;
                const c22 = gray[(y + 1) * w + (x + 1)]!;
                const gx = -c00 + c02 - 2 * c10 + 2 * c12 - c20 + c22;
                const gy = -c00 - 2 * c01 - c02 + c20 + 2 * c21 + c22;
                const mag = Math.min(255, Math.abs(gx) + Math.abs(gy));
                const out = (y * w + x) * 4;
                if (mag > 48) {
                  d[out] = 53; d[out + 1] = 199; d[out + 2] = 111; d[out + 3] = 255;
                } else {
                  d[out] = 16; d[out + 1] = 18; d[out + 2] = 20; d[out + 3] = 240;
                }
              }
            }
            ctx.putImageData(frame, 0, 0);

          } else if (cvMode === "THERMAL_IR") {
            const frame = ctx.getImageData(0, 0, w, h);
            const d = frame.data;
            for (let i = 0; i < d.length; i += 4) {
              const lum = ((d[i]! * 77 + d[i + 1]! * 150 + d[i + 2]! * 29) >> 8) & 0xff;
              if (lum < 64) {
                d[i] = 10; d[i + 1] = 20; d[i + 2] = lum * 3;
              } else if (lum < 140) {
                d[i] = (lum - 64) * 3; d[i + 1] = 20; d[i + 2] = 180 - lum;
              } else {
                d[i] = 255;
                d[i + 1] = Math.min(255, Math.round((lum - 140) * 2.5));
                d[i + 2] = 30;
              }
            }
            ctx.putImageData(frame, 0, 0);
          }

          // Send camera frame to the selected model every ~280ms
          if (now - lastEvalTime > 280 && !isSendingFrameRef.current) {
            lastEvalTime = now;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              isSendingFrameRef.current = true;
              const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
              wsRef.current.send(
                JSON.stringify({
                  image: dataUrl,
                  model: selectedModelRef.current,
                })
              );
            } else {
              canvas.toBlob(async (blob) => {
                if (!blob) return;
                isSendingFrameRef.current = true;
                const fd = new FormData();
                fd.append("file", blob, "frame.jpg");
                fd.append("model_id", selectedModelRef.current);
                fd.append("confidence", "0.05");
                try {
                  let res: Response | null = null;
                  try {
                    res = await fetch("http://127.0.0.1:8000/api/evaluate", {
                      method: "POST",
                      body: fd,
                    });
                  } catch {
                    res = await fetch("http://localhost:8000/api/evaluate", {
                      method: "POST",
                      body: fd,
                    });
                  }
                  if (res && res.ok) {
                    setBackendConnected(true);
                    const data = await res.json();
                    if (data.detections) {
                      setActiveDetections(data.detections);
                      setInferenceLatency(data.duration_ms);
                      setAnomalyCount(data.count);
                      setCurrentModelName(data.model_name);
                    }
                  }
                } catch {
                  // ignore
                } finally {
                  isSendingFrameRef.current = false;
                }
              }, "image/jpeg", 0.7);
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isCameraActive, cvMode]);

  return (
    <Panel
      bare
      id="ai-vision"
      title="ConveyorGuard AI Vision & Defect Detection"
      subtitle={
        isCameraActive
          ? `Evaluating live feed: ${currentModelName}${inferenceLatency ? ` (${inferenceLatency} ms)` : ""}`
          : uploadedImage
            ? `Evaluating image frame: ${currentModelName}${inferenceLatency ? ` (${inferenceLatency} ms)` : ""}`
            : selectedJointId
              ? `Simulated joint inspection: ${jointLabel}`
              : "Belt surface fracture, longitudinal tear & crack inspection"
      }
      actions={
        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* Switch Camera button */}
          {isCameraActive && !uploadedImage && (
            <Button
              size="sm"
              variant="outline"
              onClick={switchCamera}
              title="Switch to next camera"
              className="h-7 text-[0.625rem] font-bold tracking-wider text-info border-info/40 hover:bg-info-soft"
            >
              <SwitchCamera className="size-3.5 mr-1" />
              Switch Camera
              {videoDevices.length > 1 && (
                <span className="ml-1 rounded bg-info/20 px-1 py-0.5 text-[0.5625rem]">
                  {videoDevices.findIndex((d) => d.deviceId === selectedDeviceId) + 1}/{videoDevices.length}
                </span>
              )}
            </Button>
          )}

          {/* Submit Image button */}
          <Button
            size="sm"
            variant="default"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzingImage}
            className="h-7 text-[0.625rem] font-bold tracking-wider cursor-pointer shadow-xs"
          >
            <Upload className="size-3.5 mr-1" />
            {isAnalyzingImage ? "Evaluating…" : "Submit Image"}
          </Button>

          {/* Stop Cam button */}
          {isCameraActive && !uploadedImage && (
            <Button size="sm" variant="outline" onClick={stopCamera}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-critical hover:bg-critical-soft">
              <CameraOff className="size-3.5 mr-1" /> Stop Cam
            </Button>
          )}

          {/* Start Cam button */}
          {!isCameraActive && !uploadedImage && (
            <Button size="sm" variant="outline" onClick={() => startCamera(selectedDeviceId)}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-normal border-normal/40 hover:bg-normal-soft">
              <Camera className="size-3.5 mr-1" /> Start Cam
            </Button>
          )}
        </div>
      }
    >
      {/* View Filter, Model Selection, and Status Controls */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-secondary/50 p-2">
        <div className="flex flex-wrap items-center gap-4">
          {/* View Mode Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="view-select" className="flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider text-foreground">
              <ScanLine className="size-3.5 text-info" /> View:
            </label>
            <div className="relative">
              <select
                id="view-select"
                value={cvMode}
                onChange={(e) => setCvMode(e.target.value as CVMode)}
                className="h-7 cursor-pointer appearance-none rounded border border-border bg-background py-0.5 pr-7 pl-2 text-xs font-semibold text-foreground transition-colors hover:border-info focus:border-info focus:outline-none"
              >
                <option value="AI_OVERLAY" className="bg-popover text-foreground">AI Overlay</option>
                <option value="CANNY_EDGE" className="bg-popover text-foreground">Canny Edge</option>
                <option value="THERMAL_IR" className="bg-popover text-foreground">Thermal IR</option>
                <option value="RAW_RGB" className="bg-popover text-foreground">RGB</option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-2 right-1.5 size-3.5 text-muted-foreground" />
            </div>
          </div>

          {/* Unified AI Model Badge */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider text-foreground">
              <Cpu className="size-3.5 text-info" /> Model:
            </span>
            <div className="flex items-center gap-1.5 rounded border border-border/80 bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground shadow-xs">
              <span className="size-1.5 rounded-full bg-info" />
              <span>roboflow_conveyor_damage.pt</span>
            </div>
          </div>
        </div>

        {/* Live Active Backend Status Indicator */}
        <div className="flex items-center gap-2">
          {backendConnected ? (
            <span className="flex items-center gap-1.5 text-[0.6875rem] font-bold text-normal bg-normal/15 border border-normal/40 px-2.5 py-1 rounded-md shadow-xs">
              <span className="size-2 rounded-full bg-normal animate-pulse" /> Backend Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[0.6875rem] font-bold text-critical bg-critical/15 border border-critical/40 px-2.5 py-1 rounded-md shadow-xs">
              <span className="size-2 rounded-full bg-critical" /> Backend Offline (port 8000)
            </span>
          )}
        </div>
      </div>

      {/* Vision Screen */}
      <div className="relative w-full overflow-hidden rounded-md border border-steel bg-zinc-950 shadow-inner min-h-[380px]">

        {uploadedImage ? (
          /* ── Uploaded image mode with Pixel-Perfect Bounding Box Fitting ── */
          <div className="relative flex h-full min-h-[380px] w-full items-center justify-center p-4 bg-zinc-950">
            <div className="relative inline-block max-h-[500px] max-w-full">
              <img
                src={uploadedImage}
                alt="Uploaded conveyor belt frame"
                className="block max-h-[480px] w-auto max-w-full rounded border border-steel object-contain shadow-2xl"
              />

              {/* Pixel-perfect Bounding boxes aligned to exact image dimensions */}
              {cvMode === "AI_OVERLAY" && activeDetections.map((box, idx) => {
                const style = getDefectStyle(box.label);
                return (
                  <div
                    key={idx}
                    style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                    className={cn("absolute border-2 rounded-lg pointer-events-none transition-all", style.border)}
                  >
                    <span className={cn("absolute -top-6 left-0 rounded px-1.5 py-0.5 text-[0.625rem] font-black uppercase shadow-lg flex items-center gap-1 whitespace-nowrap z-20", style.badge)}>
                      <AlertTriangle className="size-3" />
                      {box.label} · {Math.round(box.confidence * 100)}%
                    </span>
                  </div>
                );
              })}

              {/* Analyzing spinner overlay */}
              {isAnalyzingImage && (
                <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm rounded">
                  <span className="flex items-center gap-2 text-xs font-bold tracking-widest text-info uppercase animate-pulse bg-background/90 px-3 py-1.5 rounded border border-info/40 shadow-lg">
                    <Cpu className="size-4 animate-spin" /> Evaluating Conveyor Defects…
                  </span>
                </div>
              )}
            </div>

            {/* HUD badges for uploaded image */}
            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded bg-background/95 px-2.5 py-1 text-xs font-bold tracking-wider text-foreground uppercase border border-border shadow-md">
              <Upload className="size-3.5 text-info" /> Image Analysis · {activeDetections.length} Defect(s)
            </div>

            {/* Image Action Buttons */}
            <div className="pointer-events-auto absolute bottom-3 right-3 flex items-center gap-2 z-30">
              <Button
                size="sm"
                variant="default"
                disabled={isAnalyzingImage}
                onClick={() => uploadedImage && analyzeImageDirectly(uploadedImage, selectedModel)}
                className="h-8 text-xs font-bold text-primary-foreground shadow flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={cn("size-3.5", isAnalyzingImage && "animate-spin")} />
                Re-Analyze Image
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setUploadedImage(null); setActiveDetections([]); setInferenceLatency(null); setAnomalyCount(0); }}
                className="h-8 text-xs font-bold text-muted-foreground hover:border-destructive hover:text-destructive shadow cursor-pointer"
              >
                ✕ Clear
              </Button>
            </div>
          </div>
        ) : (
          /* ── Live camera / standby mode ── */
          <div className="relative aspect-[16/9] w-full">
            {/* Video feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
              style={{ display: isCameraActive && cvMode === "RAW_RGB" ? "block" : "none" }}
            />

            {/* OpenCV Processed canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ display: isCameraActive && cvMode !== "RAW_RGB" ? "block" : "none" }}
            />

            {/* Real-time Bounding Boxes from the selected model */}
            {isCameraActive && cvMode === "AI_OVERLAY" && activeDetections.map((box, idx) => {
              const style = getDefectStyle(box.label);
              return (
                <div
                  key={idx}
                  style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                  className={cn("absolute border-2 rounded-lg pointer-events-none transition-all", style.border)}
                >
                  <span className={cn("absolute -top-6 left-0 rounded px-1.5 py-0.5 text-[0.625rem] font-black uppercase shadow-md flex items-center gap-1 whitespace-nowrap z-20", style.badge)}>
                    <AlertTriangle className="size-3" />
                    {box.label} · {Math.round(box.confidence * 100)}%
                  </span>
                </div>
              );
            })}

            {/* Live HUD Badges */}
            {isCameraActive && (
              <>
                <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-2 rounded-sm bg-background/90 px-2 py-1 text-[0.5625rem] font-bold tracking-wider text-foreground uppercase border border-border/50">
                  <Camera className="size-3 text-info" /> LIVE · {fps} FPS
                  {videoDevices.length > 0 && (
                    <span className="text-info font-mono text-[0.5625rem] border-l border-border/60 pl-1.5 max-w-[140px] truncate">
                      {videoDevices.find((d) => d.deviceId === selectedDeviceId)?.label || `CAM ${videoDevices.findIndex((d) => d.deviceId === selectedDeviceId) + 1}`}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Standby screen when camera is OFF */}
            {!isCameraActive && (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.3_0.01_250)_0%,oklch(0.16_0.008_250)_100%)]" />
                <div className="belt-surface absolute inset-x-0 top-[24%] h-[52%] border-y-2 border-steel opacity-90" />
                {joints.map((j) => (
                  <div key={j.id} style={{ left: `${j.position}%` }}
                    className={cn("absolute top-[24%] h-[52%] w-1.5 -translate-x-1/2 hatch", j.id === selectedJointId && "ring-2 ring-info")}
                    aria-hidden />
                ))}
                <div className="pointer-events-none absolute inset-x-0 top-[24%] border-t border-info/20" />
                <div className="scan-line pointer-events-none absolute inset-x-0 top-[24%] h-8 bg-gradient-to-b from-info/25 to-transparent" />

                {detections.map((d) => {
                  const isActive = d.id === activeDetectionId;
                  return (
                    <button key={d.id} type="button" onClick={() => focusDetection(d.id)}
                      aria-label={`${d.type}, ${Math.round(d.confidence * 100)}% confidence`}
                      style={{ left: `${d.box.x}%`, top: `${d.box.y}%`, width: `${d.box.w}%`, height: `${d.box.h}%` }}
                      className={cn("absolute border-2 transition-all cursor-pointer", boxTone(d.severity),
                        isActive ? "opacity-100" : "opacity-60 hover:opacity-100")}>
                      <span className={cn("absolute -top-5 left-0 max-w-[180px] truncate rounded-sm bg-background/90 px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-wider uppercase", boxTone(d.severity))}>
                        {d.type} · {Math.round(d.confidence * 100)}%
                      </span>
                    </button>
                  );
                })}

                <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 rounded-sm bg-background/80 px-2 py-0.5 text-[0.5625rem] font-bold tracking-wider text-foreground uppercase">
                  <Camera className="size-3" aria-hidden /> Standby Mode
                </div>
                {activeScenario && (
                  <div className="pointer-events-none absolute top-2 right-2 rounded-sm border border-warning/50 bg-warning-soft px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-wider text-warning uppercase">
                    Simulated AI
                  </div>
                )}
                {detections.length === 0 && (
                  <div className="absolute inset-0 grid place-items-center bg-background/70">
                    <span className="flex items-center gap-2 text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">
                      <ScanLine className="size-3.5" aria-hidden /> Initialising Camera or Upload Image…
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Live Single Execution Status Bar */}
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="tile rounded-md p-2.5 border border-info/40 bg-info-soft/20">
            <div className="label-caps text-[0.5625rem]">Active Model</div>
            <div className="text-xs font-bold text-info truncate">
              {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.filename}
            </div>
          </div>

          <div className="tile rounded-md p-2.5 border border-border/60">
            <div className="label-caps text-[0.5625rem]">Architecture / Role</div>
            <div className="text-xs font-bold text-foreground truncate">
              Belt Surface Defect Detector
            </div>
          </div>

          <div className="tile rounded-md p-2.5 border border-border/60">
            <div className="label-caps text-[0.5625rem]">Inference Speed</div>
            <div className="tabular text-xs font-bold text-foreground">
              {inferenceLatency ? `${inferenceLatency} ms` : "Awaiting evaluation"}
            </div>
          </div>

          <div className="tile rounded-md p-2.5 border border-border/60">
            <div className="label-caps text-[0.5625rem]">Detected Anomalies</div>
            <div className="tabular text-xs font-bold text-warning">
              {anomalyCount} {anomalyCount === 1 ? "Defect" : "Defects"}
            </div>
          </div>
        </div>
      </div>

      {/* Detected Defects Breakdown List */}
      {activeDetections.length > 0 && (
        <div className="mt-3 rounded-md border border-border/80 bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold tracking-wider uppercase text-foreground flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-warning" /> Detected Conveyor Anomalies ({activeDetections.length})
            </h4>
            <span className="text-[0.625rem] text-muted-foreground font-mono">
              Model: {selectedModel} · Precision NMS Filter Active
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeDetections.map((defect, i) => {
              const style = getDefectStyle(defect.label);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between rounded border p-2 bg-secondary/30 transition-all hover:bg-secondary/60",
                    style.border
                  )}
                >
                  <div className="flex flex-col">
                    <span className={cn("text-xs", style.text)}>
                      {defect.label}
                    </span>
                    <span className="text-[0.625rem] text-muted-foreground">
                      Coordinates: X={Math.round(defect.x)}% Y={Math.round(defect.y)}% · W={Math.round(defect.w)}% H={Math.round(defect.h)}%
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={cn("rounded px-1.5 py-0.5 text-[0.5625rem]", style.badge)}>
                      {Math.round(defect.confidence * 100)}%
                    </span>
                    <span className="text-[0.5625rem] uppercase font-bold text-muted-foreground mt-0.5">
                      {style.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
