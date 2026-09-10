import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Cpu,
  AlertTriangle,
  ChevronDown,
  Upload,
  SwitchCamera,
  ImageIcon,
  VideoIcon,
} from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import type { Condition } from "@/lib/conveyor/types";
import { Panel, conditionClasses } from "./primitives";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

// ─────────────────────────────────────────────────────────────────────────────
// Run inference on a single image dataUrl via REST (returns detections)
// ─────────────────────────────────────────────────────────────────────────────
async function runInferenceRest(dataUrl: string, modelId: string) {
  const blob = await fetch(dataUrl).then((r) => r.blob());
  const fd = new FormData();
  fd.append("file", blob, "image.jpg");
  fd.append("model_id", modelId);
  const res = await fetch("http://127.0.0.1:8000/api/evaluate", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error("Backend error");
  return res.json();
}

export function AIVision() {
  const { detections, activeDetectionId, focusDetection, selectedJointId, joints, activeScenario } =
    useConveyor();

  // View mode: "video" | "image"
  const [viewMode, setViewMode] = useState<"video" | "image">("video");

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [fps, setFps] = useState<number>(0);

  const [selectedModel, setSelectedModel] = useState<string>("stage1");
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [activeDetections, setActiveDetections] = useState<Detection[]>([]);
  const [currentModelName, setCurrentModelName] = useState<string>("best_stage1.pt");
  const [inferenceLatency, setInferenceLatency] = useState<number | null>(null);
  const [anomalyCount, setAnomalyCount] = useState<number>(0);

  // Image mode state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
  const lastEvalTimeRef = useRef<number>(0);

  // Keep ref synchronized
  useEffect(() => {
    selectedModelRef.current = selectedModel;
    const found = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
    if (found) setCurrentModelName(found.filename);
  }, [selectedModel]);

  const active = detections.find((d) => d.id === activeDetectionId) ?? null;
  const jointLabel = joints.find((j) => j.id === selectedJointId)?.label;

  // ── Backend health check ──
  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then((r) => r.json())
      .then(() => setBackendConnected(true))
      .catch(() => setBackendConnected(false));
  }, []);

  // ── WebSocket ──
  const connectWebSocket = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      const ws = new WebSocket("ws://127.0.0.1:8000/ws/evaluate");
      wsRef.current = ws;

      ws.onopen = () => setBackendConnected(true);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.data) {
            const res = payload.data;
            setActiveDetections(res.detections || []);
            setInferenceLatency(res.duration_ms || null);
            setAnomalyCount(res.count || 0);
          }
        } catch { /* ignore */ }
        isSendingFrameRef.current = false;
      };

      ws.onerror = () => {
        setBackendConnected(false);
        isSendingFrameRef.current = false;
      };
      ws.onclose = () => { isSendingFrameRef.current = false; };
    } catch { setBackendConnected(false); }
  }, []);

  // ── Stop camera ──
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setIsCameraActive(false);
    setActiveDetections([]);
    setFps(0);
    isSendingFrameRef.current = false;
  }, []);

  // ── Enumerate devices ──
  const updateCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      return videoInputs;
    } catch { return []; }
  }, []);

  // ── Start camera ──
  const startCamera = async (targetDeviceId?: string) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API not supported.");
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

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) { video.srcObject = stream; await video.play(); }
      setIsCameraActive(true);

      const devices = await updateCameraDevices();
      const settings = stream.getVideoTracks()[0]?.getSettings();
      const activeId = targetDeviceId || settings?.deviceId;
      if (activeId) setSelectedDeviceId(activeId);

      connectWebSocket();
      toast.success("Camera connected.");
    } catch (err: unknown) {
      toast.error(`Camera error: ${err instanceof Error ? err.message : "Permission denied."}`);
    }
  };

  // ── Switch camera ──
  const switchCamera = async () => {
    let devices = videoDevices;
    if (devices.length <= 1) devices = await updateCameraDevices();
    if (!devices.length) { toast.error("No camera devices detected."); return; }

    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextDevice = devices[(currentIndex + 1) % devices.length];
    if (nextDevice) {
      setSelectedDeviceId(nextDevice.deviceId);
      await startCamera(nextDevice.deviceId);
      toast.info(`Switched to: ${nextDevice.label || `Camera ${devices.indexOf(nextDevice) + 1}`}`);
    }
  };

  // ── Auto-start on mount ──
  useEffect(() => {
    if (viewMode === "video") {
      startCamera();
      updateCameraDevices();
    }
    const onDeviceChange = () => updateCameraDevices();
    if (navigator.mediaDevices) navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    return () => {
      stopCamera();
      if (navigator.mediaDevices) navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Image mode: run inference ──
  const analyzeImage = useCallback(async (dataUrl: string) => {
    setIsAnalyzingImage(true);
    setActiveDetections([]);
    setInferenceLatency(null);
    setAnomalyCount(0);
    try {
      // Prefer WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        isSendingFrameRef.current = true;
        wsRef.current.send(JSON.stringify({ image: dataUrl, model: selectedModelRef.current }));
        // result handled in ws.onmessage
      } else {
        const data = await runInferenceRest(dataUrl, selectedModelRef.current);
        setActiveDetections(data.detections || []);
        setInferenceLatency(data.duration_ms || null);
        setAnomalyCount(data.count || 0);
      }
    } catch {
      toast.error("Image analysis failed. Is the backend running?");
    } finally {
      setIsAnalyzingImage(false);
    }
  }, []);

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files are supported."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedImage(dataUrl);
      analyzeImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [analyzeImage]);

  // ── Drag & drop handlers ──
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadImageFile(file);
  };
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
    e.target.value = "";
  };

  // ── OPTIMIZED real-time camera loop ──
  // Uses rAF only for drawing, throttled inference via elapsed time check
  useEffect(() => {
    if (!isCameraActive || viewMode !== "video") return;

    let running = true;

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

        // Draw frame — no pixel manipulation = no freeze
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);

          // FPS — update max once per second
          frameCountRef.current++;
          if (now - lastFpsTimeRef.current >= 1000) {
            setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current)));
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
          }

          // Send to backend at most every 350ms to avoid backing up the pipeline
          if (now - lastEvalTimeRef.current > 350 && !isSendingFrameRef.current) {
            lastEvalTimeRef.current = now;

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              isSendingFrameRef.current = true;
              // Encode at lower quality to reduce bandwidth
              const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
              wsRef.current.send(JSON.stringify({ image: dataUrl, model: selectedModelRef.current }));
            } else {
              // REST fallback — off the main thread path
              isSendingFrameRef.current = true;
              canvas.toBlob(
                async (blob) => {
                  if (!blob) { isSendingFrameRef.current = false; return; }
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
                      setActiveDetections(data.detections || []);
                      setInferenceLatency(data.duration_ms || null);
                      setAnomalyCount(data.count || 0);
                    }
                  } catch { /* ignore */ }
                  finally { isSendingFrameRef.current = false; }
                },
                "image/jpeg",
                0.55,
              );
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
  }, [isCameraActive, viewMode]);

  // ── Switch to image mode ──
  const enterImageMode = () => {
    setViewMode("image");
    // Don't stop camera — just hide it so switching back is instant
  };

  // ── Switch to video mode ──
  const enterVideoMode = () => {
    setViewMode("video");
    setUploadedImage(null);
    setActiveDetections([]);
    setInferenceLatency(null);
    setAnomalyCount(0);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Panel
      bare
      id="ai-vision"
      title="Live OpenCV Feed & Belt Anomaly Detection"
      subtitle={
        viewMode === "image"
          ? "Image mode — drag & drop or click to analyse"
          : isCameraActive
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
            onChange={onFileInput}
          />

          {/* Mode toggle */}
          {viewMode === "video" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={enterImageMode}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-info border-info/40 hover:bg-info-soft"
            >
              <ImageIcon className="size-3.5 mr-1" /> Image Mode
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={enterVideoMode}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-normal border-normal/40 hover:bg-normal-soft"
            >
              <VideoIcon className="size-3.5 mr-1" /> Video Mode
            </Button>
          )}

          {/* Switch Camera (only in video mode, when active) */}
          {viewMode === "video" && isCameraActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={switchCamera}
              title="Switch to next camera"
              className="h-7 text-[0.625rem] font-bold tracking-wider text-info border-info/40 hover:bg-info-soft"
            >
              <SwitchCamera className="size-3.5 mr-1" />
              Switch Cam
              {videoDevices.length > 1 && (
                <span className="ml-1 rounded bg-info/20 px-1 py-0.5 text-[0.5625rem]">
                  {videoDevices.findIndex((d) => d.deviceId === selectedDeviceId) + 1}/{videoDevices.length}
                </span>
              )}
            </Button>
          )}

          {/* Stop/Start cam buttons in video mode */}
          {viewMode === "video" && isCameraActive && (
            <Button size="sm" variant="outline" onClick={stopCamera}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-critical hover:bg-critical-soft">
              <CameraOff className="size-3.5 mr-1" /> Stop Cam
            </Button>
          )}
          {viewMode === "video" && !isCameraActive && (
            <Button size="sm" variant="outline" onClick={() => startCamera(selectedDeviceId)}
              className="h-7 text-[0.625rem] font-bold tracking-wider text-normal border-normal/40 hover:bg-normal-soft">
              <Camera className="size-3.5 mr-1" /> Start Cam
            </Button>
          )}
        </div>
      }
    >
      {/* Vision Screen */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-steel bg-background shadow-inner">

        {/* ── IMAGE MODE ── */}
        {viewMode === "image" && (
          <>
            {uploadedImage ? (
              /* Uploaded image with detections */
              <>
                <img
                  src={uploadedImage}
                  alt="Uploaded belt image"
                  className="absolute inset-0 h-full w-full object-contain"
                />

                {activeDetections.map((box, idx) => (
                  <div
                    key={idx}
                    style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                    className="absolute border-2 border-warning rounded-lg pointer-events-none"
                  >
                    <span className="absolute -top-5 left-0 rounded bg-background/95 px-1.5 py-0.5 text-[0.5625rem] font-extrabold text-warning uppercase border border-warning/40 shadow-sm flex items-center gap-1">
                      <AlertTriangle className="size-2.5 text-warning" />
                      {box.label} · {Math.round(box.confidence * 100)}%
                    </span>
                  </div>
                ))}

                {/* Analyzing spinner */}
                {isAnalyzingImage && (
                  <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
                    <span className="flex items-center gap-2 text-[0.6875rem] tracking-[0.14em] text-info uppercase animate-pulse">
                      <Cpu className="size-4 animate-spin" /> Running Model…
                    </span>
                  </div>
                )}

                {/* Top-left badge */}
                <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-2 rounded-sm bg-background/90 px-2 py-1 text-[0.5625rem] font-bold tracking-wider text-foreground uppercase border border-border/50">
                  <Upload className="size-3 text-info" /> IMAGE
                </div>

                {/* Clear button */}
                <button
                  type="button"
                  onClick={() => { setUploadedImage(null); setActiveDetections([]); setInferenceLatency(null); setAnomalyCount(0); }}
                  className="pointer-events-auto absolute top-2 right-2 rounded-sm border border-border/60 bg-background/90 px-2 py-1 text-[0.5625rem] font-bold tracking-wider text-muted-foreground uppercase hover:border-critical/50 hover:text-critical transition-colors"
                >
                  ✕ Clear
                </button>
              </>
            ) : (
              /* Drag & Drop Zone */
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200",
                  isDragging
                    ? "bg-info/10 border-2 border-dashed border-info"
                    : "bg-background/40 border-2 border-dashed border-border/40 hover:border-info/60 hover:bg-info/5"
                )}
              >
                <div className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed transition-colors duration-200",
                  isDragging ? "border-info bg-info/20 text-info" : "border-border/50 text-muted-foreground"
                )}>
                  <Upload className="size-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {isDragging ? "Drop image here" : "Drop images here"}
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                    or click to browse · JPG, PNG, WEBP
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── VIDEO MODE ── */}
        {viewMode === "video" && (
          <>
            {/* Hidden video source */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="hidden"
            />

            {/* Camera canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ display: isCameraActive ? "block" : "none" }}
            />

            {/* Real-time bounding boxes */}
            {isCameraActive && activeDetections.map((box, idx) => (
              <div
                key={idx}
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                className="absolute border-2 border-warning rounded-lg pointer-events-none"
              >
                <span className="absolute -top-5 left-0 rounded bg-background/95 px-1.5 py-0.5 text-[0.5625rem] font-extrabold text-warning uppercase border border-warning/40 shadow-sm flex items-center gap-1">
                  <AlertTriangle className="size-2.5 text-warning" />
                  {box.label} · {Math.round(box.confidence * 100)}%
                </span>
              </div>
            ))}

            {/* Live HUD badge */}
            {isCameraActive && (
              <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-2 rounded-sm bg-background/90 px-2 py-1 text-[0.5625rem] font-bold tracking-wider text-foreground uppercase border border-border/50">
                <Camera className="size-3 text-info" /> LIVE · {fps} FPS
                {videoDevices.length > 0 && (
                  <span className="text-info font-mono text-[0.5625rem] border-l border-border/60 pl-1.5 max-w-[140px] truncate">
                    {videoDevices.find((d) => d.deviceId === selectedDeviceId)?.label
                      || `CAM ${videoDevices.findIndex((d) => d.deviceId === selectedDeviceId) + 1}`}
                  </span>
                )}
              </div>
            )}

            {/* Standby screen */}
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
                      className={cn("absolute border-2 rounded-lg transition-all cursor-pointer", boxTone(d.severity),
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
                      Initialising Camera…
                    </span>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Bottom HUD overlay strip ── */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          {/* Grainy translucent black backdrop */}
          <div
            className="absolute inset-0 backdrop-blur-[2px]"
            style={{
              background: "rgba(0,0,0,0.72)",
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E")`,
              backgroundSize: "120px 120px",
            }}
          />
          {/* Stats row */}
          <div className="pointer-events-auto relative grid grid-cols-2 gap-px sm:grid-cols-4">
            {/* Active Model dropdown */}
            <div className="flex flex-col justify-center gap-0.5 px-3 py-2.5 border-r border-white/10">
              <label htmlFor="active-model-select" className="flex items-center justify-between text-[0.5rem] font-bold uppercase tracking-[0.14em] text-white/50 cursor-pointer">
                Active Model <Cpu className="size-2.5 text-info" />
              </label>
              <div className="relative">
                <select
                  id="active-model-select"
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setActiveDetections([]);
                    setInferenceLatency(null);
                    setAnomalyCount(0);
                  }}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-4 text-[0.6875rem] font-bold text-info hover:text-white focus:outline-none truncate"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-neutral-900 text-white font-normal">
                      {m.name} — {m.desc}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-0.5 right-0 size-3 text-info" />
              </div>
            </div>

            {/* Architecture */}
            <div className="flex flex-col justify-center gap-0.5 px-3 py-2.5 border-r border-white/10">
              <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-white/50">Architecture</div>
              <div className="text-[0.6875rem] font-bold text-white truncate">
                {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.desc.split(" ")[0]} Detector
              </div>
            </div>

            {/* Inference Speed */}
            <div className="flex flex-col justify-center gap-0.5 px-3 py-2.5 border-r border-white/10">
              <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-white/50">Inference Speed</div>
              <div className="tabular text-[0.6875rem] font-bold text-white">
                {inferenceLatency ? `${inferenceLatency} ms` : "Awaiting"}
              </div>
            </div>

            {/* Detected Anomalies */}
            <div className="flex flex-col justify-center gap-0.5 px-3 py-2.5">
              <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-white/50">Anomalies</div>
              <div className="tabular text-[0.6875rem] font-bold text-warning">
                {anomalyCount} {anomalyCount === 1 ? "Defect" : "Defects"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
