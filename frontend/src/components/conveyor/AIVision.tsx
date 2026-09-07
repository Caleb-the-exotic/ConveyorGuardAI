import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  CameraOff,
  ScanLine,
  Cpu,
  AlertTriangle,
  ChevronDown,
  Activity,
  Upload,
  SwitchCamera,
} from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import type { Condition } from "@/lib/conveyor/types";
import { Panel, conditionClasses } from "./primitives";
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
    desc: "Trained Roboflow Belt Damage Detector",
  },
  {
    id: "stage1",
    name: "best_stage1.pt",
    filename: "best_stage1.pt",
    desc: "YOLOv8 Belt ROI & Surface Tear Detector",
  },
  {
    id: "stage2",
    name: "best_stage2.pt",
    filename: "best_stage2.pt",
    desc: "PatchCore Memory Bank Anomaly Detector",
  },
  {
    id: "model_pt",
    name: "model.pt",
    filename: "model.pt",
    desc: "ConveyCheck Visual Inspection ResNet",
  },
  {
    id: "yolox",
    name: "yolox_s.pth",
    filename: "yolox_s.pth",
    desc: "YOLOX-S Surface Crack & Fracture Network",
  },
];

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

  // Model Selection Dropdown State
  const [selectedModel, setSelectedModel] = useState<string>("stage1");
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [activeDetections, setActiveDetections] = useState<Detection[]>([]);
  const [currentModelName, setCurrentModelName] = useState<string>("best_stage1.pt (YOLOv8 Belt ROI)");
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

  // Keep ref synchronized for immediate access in loops/callbacks
  useEffect(() => {
    selectedModelRef.current = selectedModel;
    const found = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
    if (found) {
      setCurrentModelName(`${found.filename} (${found.desc})`);
    }
  }, [selectedModel]);

  const active = detections.find((d) => d.id === activeDetectionId) ?? null;
  const jointLabel = joints.find((j) => j.id === selectedJointId)?.label;

  // Check Backend health
  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then((r) => r.json())
      .then(() => setBackendConnected(true))
      .catch(() => setBackendConnected(false));
  }, []);

  // WebSocket Connection
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket("ws://127.0.0.1:8000/ws/evaluate");
      wsRef.current = ws;

      ws.onopen = () => {
        setBackendConnected(true);
      };

      ws.onmessage = (event) => {
        try {
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
        setBackendConnected(false);
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

      // Stop previous stream tracks cleanly if switching or re-opening
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      const chosenDeviceId = targetDeviceId || selectedDeviceId;
      if (chosenDeviceId) {
        videoConstraints.deviceId = { exact: chosenDeviceId };
      } else {
        videoConstraints.facingMode = "environment";
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setIsCameraActive(true);

      // Refresh list of devices with granted permissions
      const devices = await updateCameraDevices();
      const currentTrack = stream.getVideoTracks()[0];
      const settings = currentTrack?.getSettings();
      const activeId = targetDeviceId || settings?.deviceId;
      if (activeId) {
        setSelectedDeviceId(activeId);
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
      toast.success("Camera feed connected.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to acquire camera permission.";
      toast.error(`Camera error: ${msg}`);
    }
  };

  // Switch to the next available video device
  const switchCamera = async () => {
    let devices = videoDevices;
    if (devices.length <= 1) {
      devices = await updateCameraDevices();
    }

    if (devices.length === 0) {
      toast.error("No camera devices detected.");
      return;
    }

    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    if (nextDevice) {
      setSelectedDeviceId(nextDevice.deviceId);
      await startCamera(nextDevice.deviceId);
      const label = nextDevice.label || `Camera ${nextIndex + 1}`;
      toast.info(`Switched to: ${label}`);
    } else {
      await startCamera();
      toast.info("Switched camera.");
    }
  };

  // Auto-start camera on mount and listen to device changes
  useEffect(() => {
    startCamera();
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

  // Handle image upload: show image + run ML inference on it
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedImage(dataUrl);
      setIsAnalyzingImage(true);
      setActiveDetections([]);
      setInferenceLatency(null);
      setAnomalyCount(0);

      try {
        // Send via WebSocket if open, else fall back to REST
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          isSendingFrameRef.current = true;
          wsRef.current.send(
            JSON.stringify({ image: dataUrl, model: selectedModelRef.current })
          );
        } else {
          // REST fallback
          const blob = await fetch(dataUrl).then((r) => r.blob());
          const fd = new FormData();
          fd.append("file", blob, file.name);
          fd.append("model_id", selectedModelRef.current);
          const res = await fetch("http://127.0.0.1:8000/api/evaluate", {
            method: "POST",
            body: fd,
          });
          if (res.ok) {
            const data = await res.json();
            setActiveDetections(data.detections || []);
            setInferenceLatency(data.duration_ms || null);
            setAnomalyCount(data.count || 0);
            if (data.model_name) setCurrentModelName(data.model_name);
          }
        }
      } catch {
        toast.error("Image analysis failed. Is the backend running?");
      } finally {
        setIsAnalyzingImage(false);
        // reset file input so same file can be re-submitted
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  }, []);

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
              // HTTP REST fallback with model selection
              canvas.toBlob(async (blob) => {
                if (!blob) return;
                isSendingFrameRef.current = true;
                const fd = new FormData();
                fd.append("file", blob, "frame.jpg");
                fd.append("model_id", selectedModelRef.current);
                try {
                  const res = await fetch("http://127.0.0.1:8000/api/evaluate", {
                    method: "POST",
                    body: fd,
                  });
                  if (res.ok) {
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
      title="Live OpenCV Feed & Belt Anomaly Detection"
      subtitle={
        isCameraActive
          ? `Evaluating with: ${currentModelName}${inferenceLatency ? ` (${inferenceLatency} ms)` : ""}`
          : selectedJointId
            ? `Simulated: ${jointLabel}`
            : "Belt surface, tear & crack inspection"
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

          {/* Switch Camera button (cycles through connected cameras) */}
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
            className="h-7 text-[0.625rem] font-bold tracking-wider"
          >
            <Upload className="size-3.5 mr-1" />
            {isAnalyzingImage ? "Analyzing…" : "Submit Image"}
          </Button>

          {/* Stop Cam button only when camera is active and no uploaded image */}
          {isCameraActive && !uploadedImage && (
            <Button size="sm" variant="outline" onClick={stopCamera}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-critical hover:bg-critical-soft">
              <CameraOff className="size-3.5 mr-1" /> Stop Cam
            </Button>
          )}

          {/* Start Cam button when camera is stopped and no uploaded image */}
          {!isCameraActive && !uploadedImage && (
            <Button size="sm" variant="outline" onClick={() => startCamera(selectedDeviceId)}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-normal border-normal/40 hover:bg-normal-soft">
              <Camera className="size-3.5 mr-1" /> Start Cam
            </Button>
          )}
        </div>
      }
    >
      {/* View Filter & Model Selection Dropdowns */}
      <div className="mb-2 flex flex-wrap items-center justify-start gap-4 rounded-md border border-border/70 bg-secondary/50 p-1.5">
        {/* View Mode Dropdown (on the left side) */}
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
              <option value="AI_OVERLAY" className="bg-popover text-foreground">AI Detections</option>
              <option value="CANNY_EDGE" className="bg-popover text-foreground">Canny Edge</option>
              <option value="THERMAL_IR" className="bg-popover text-foreground">Thermal IR</option>
              <option value="RAW_RGB" className="bg-popover text-foreground">RGB</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-2 right-1.5 size-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Model Selection Dropdown (to the right of View dropdown) */}
        <div className="flex items-center gap-2">
          <label htmlFor="model-select" className="flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider text-foreground">
            <Cpu className="size-3.5 text-info" /> Model:
          </label>
          <div className="relative">
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setActiveDetections([]);
                setInferenceLatency(null);
                setAnomalyCount(0);
              }}
              className="h-7 cursor-pointer appearance-none rounded border border-border bg-background py-0.5 pr-7 pl-2 text-xs font-semibold text-foreground transition-colors hover:border-info focus:border-info focus:outline-none"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-popover text-foreground">
                  {m.name} — {m.desc}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-2 right-1.5 size-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Vision Screen */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-steel bg-background shadow-inner">

        {uploadedImage ? (
          /* ── Uploaded image mode ── */
          <>
            <img
              src={uploadedImage}
              alt="Uploaded belt image"
              className="absolute inset-0 h-full w-full object-contain"
            />

            {/* Bounding boxes over the uploaded image */}
            {cvMode === "AI_OVERLAY" && activeDetections.map((box, idx) => (
              <div
                key={idx}
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                className="absolute border-2 border-warning shadow-[0_0_14px_rgba(242,184,75,0.7)] pointer-events-none animate-pulse"
              >
                <span className="absolute -top-5 left-0 rounded bg-background/95 px-1.5 py-0.5 text-[0.5625rem] font-extrabold text-warning uppercase border border-warning/40 shadow-sm flex items-center gap-1">
                  <AlertTriangle className="size-2.5 text-warning" />
                  {box.label} · {Math.round(box.confidence * 100)}%
                </span>
              </div>
            ))}

            {/* Analyzing spinner overlay */}
            {isAnalyzingImage && (
              <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-[0.6875rem] tracking-[0.14em] text-info uppercase animate-pulse">
                  <Cpu className="size-4 animate-spin" /> Running Model…
                </span>
              </div>
            )}

            {/* HUD badges for uploaded image */}
            <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-2 rounded-sm bg-background/90 px-2 py-1 text-[0.5625rem] font-bold tracking-wider text-foreground uppercase border border-border/50">
              <Upload className="size-3 text-info" /> IMAGE
            </div>

            {/* Clear image button */}
            <button
              type="button"
              onClick={() => { setUploadedImage(null); setActiveDetections([]); setInferenceLatency(null); setAnomalyCount(0); }}
              className="pointer-events-auto absolute bottom-2 right-2 rounded-sm border border-border/60 bg-background/90 px-2 py-1 text-[0.5625rem] font-bold tracking-wider text-muted-foreground uppercase hover:border-critical/50 hover:text-critical transition-colors"
            >
              ✕ Clear Image
            </button>
          </>
        ) : (
          /* ── Live camera / standby mode ── */
          <>
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
            {isCameraActive && cvMode === "AI_OVERLAY" && activeDetections.map((box, idx) => (
              <div
                key={idx}
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                className="absolute border-2 border-warning shadow-[0_0_14px_rgba(242,184,75,0.7)] pointer-events-none animate-pulse"
              >
                <span className="absolute -top-5 left-0 rounded bg-background/95 px-1.5 py-0.5 text-[0.5625rem] font-extrabold text-warning uppercase border border-warning/40 shadow-sm flex items-center gap-1">
                  <AlertTriangle className="size-2.5 text-warning" />
                  {box.label} · {Math.round(box.confidence * 100)}%
                </span>
              </div>
            ))}

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
                      <ScanLine className="size-3.5" aria-hidden /> Initialising Camera…
                    </span>
                  </div>
                )}
              </>
            )}
          </>
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
              {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.desc.split(" ")[0]} Detector
            </div>
          </div>

          <div className="tile rounded-md p-2.5 border border-border/60">
            <div className="label-caps text-[0.5625rem]">Inference Speed</div>
            <div className="tabular text-xs font-bold text-foreground">
              {inferenceLatency ? `${inferenceLatency} ms` : "Awaiting frames"}
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
    </Panel>
  );
}
