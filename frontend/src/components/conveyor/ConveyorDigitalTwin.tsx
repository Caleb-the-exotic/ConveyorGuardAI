import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Box,
  RotateCcw,
  Play,
  Pause,
  Grid,
  Flame,
  Maximize2,
  Minimize2,
  Eye,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scenario, Condition } from "@/lib/conveyor/types";

interface ConveyorDigitalTwinProps {
  scenario: Scenario;
  condition: Condition;
  selectedJointId?: string | null;
  onSelectJoint?: (jointId: string) => void;
}

// 5 Splice Joint Normalized Positions along the belt length (-23.5 tail to +6.5 head)
const SPLICE_LOCATIONS = [
  { id: "J1", label: "Splice #1", yRel: 0.10, zCoord: 19.5 },
  { id: "J2", label: "Splice #2", yRel: 0.28, zCoord: 14.1 },
  { id: "J3", label: "Splice #3", yRel: 0.48, zCoord: 8.1 },
  { id: "J4", label: "Splice #4", yRel: 0.68, zCoord: 2.1 },
  { id: "J5", label: "Splice #5", yRel: 0.86, zCoord: -3.3 },
];

export function ConveyorDigitalTwin({
  scenario,
  condition,
  selectedJointId,
  onSelectJoint,
}: ConveyorDigitalTwinProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [thermalMode, setThermalMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeJointHover, setActiveJointHover] = useState<string | null>(null);

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    anomalyPoint: THREE.PointLight;
  } | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const pulseUniformsRef = useRef({ time: 0 });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Initialize Three.js Scene
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color("#090d13");
    scene.fog = new THREE.FogExp2("#090d13", 0.008);

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 500);
    camera.position.set(34, 22, 38);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 14;
    controls.maxDistance = 130;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight("#1e293b", 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight("#f8fafc", 2.4);
    keyLight.position.set(25, 40, 20);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#38bdf8", 1.2);
    fillLight.position.set(-25, 20, -20);
    scene.add(fillLight);

    const anomalyPoint = new THREE.PointLight("#ef4444", 0, 30);
    anomalyPoint.position.set(0, 7, 0);
    scene.add(anomalyPoint);

    lightsRef.current = {
      ambient: ambientLight,
      key: keyLight,
      fill: fillLight,
      anomalyPoint,
    };

    // Ground Grid & Halo
    const grid = new THREE.GridHelper(60, 30, "#38bdf8", "#1e293b");
    grid.position.y = -6.8;
    (grid.material as THREE.Material).opacity = 0.25;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    // Load OBJ Model
    const loader = new OBJLoader();
    loader.load(
      "/Conveyor%20Belt%20Assembly.obj",
      (obj) => {
        // Rotate so Z-up becomes standard Y-up
        obj.rotation.x = -Math.PI / 2;

        // Center model around (0, 0, 0)
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);

        // Apply specialized PBR materials by part role
        materialsRef.current.clear();
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const name = mesh.name || "";
            let mat: THREE.MeshStandardMaterial;

            // Belt surface
            if (name.includes("Body1:10") || name.toLowerCase().includes("belt")) {
              mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color("#181c22"),
                roughness: 0.7,
                metalness: 0.1,
                name: "belt_surface",
              });
            }
            // Pulleys & Rollers (Cylindrical drums)
            else if (name.includes("Body2:2") || name.includes("Body2:3") || name.includes("Body2:4")) {
              mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color("#8da2b5"),
                roughness: 0.28,
                metalness: 0.85,
                name: name.includes("Body2:2") ? "drive_pulley" : "tail_pulley",
              });
            }
            // Drive Motor, Gearbox & Transmission
            else if (
              name.includes("Body1:7") ||
              name.includes("Body1:8") ||
              name.includes("Body1:9") ||
              name.includes("Body1:6")
            ) {
              mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color("#273240"),
                roughness: 0.45,
                metalness: 0.65,
                name: "motor_gearbox",
              });
            }
            // Structural Support Frame & Legs
            else {
              mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color("#3d4957"),
                roughness: 0.55,
                metalness: 0.5,
                name: "structural_frame",
              });
            }

            mesh.material = mat;
            materialsRef.current.set(name, mat);
          }
        });

        modelGroupRef.current = obj;
        scene.add(obj);

        // Splice Hologram Markers
        const markersGroup = new THREE.Group();
        markersGroupRef.current = markersGroup;

        // Splices and circles removed per user request

        scene.add(markersGroup);

        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        } else {
          setLoadProgress(Math.min(95, Math.round(xhr.loaded / 40000)));
        }
      },
      (err) => {
        console.error("Failed to load Conveyor 3D model:", err);
        setLoading(false);
      }
    );

    // Animation Loop
    let lastTime = performance.now();
    const animate = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      pulseUniformsRef.current.time = now * 0.001;

      // Gentle auto-rotation
      if (autoRotate && modelGroupRef.current) {
        modelGroupRef.current.rotation.z += 0.15 * delta;
        if (markersGroupRef.current) {
          markersGroupRef.current.rotation.y -= 0.15 * delta;
        }
      }

      // Splice ring pulsing animation
      if (markersGroupRef.current) {
        markersGroupRef.current.children.forEach((child) => {
          if (child.name.startsWith("ring_")) {
            const s = 1.0 + 0.18 * Math.sin(now * 0.004 + (child.position.z || 0));
            child.scale.set(s, s, s);
          }
        });
      }

      controls.update();
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(animate);
    };
    animFrameIdRef.current = requestAnimationFrame(animate);

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. React dynamically to Preset Scenario & Condition Changes
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lightsRef.current || materialsRef.current.size === 0) return;

    const { ambient, key, fill, anomalyPoint } = lightsRef.current;
    const isThermal = thermalMode;

    materialsRef.current.forEach((mat, name) => {
      mat.wireframe = wireframeMode;

      // ── NOMINAL BASELINE ──
      if (scenario === "NORMAL" || condition === "NORMAL") {
        if (mat.name === "belt_surface") {
          mat.color.set(isThermal ? "#0f766e" : "#181c22");
          mat.emissive.set("#052e16");
          mat.emissiveIntensity = 0.15;
          mat.roughness = 0.7;
        } else if (mat.name === "drive_pulley" || mat.name === "tail_pulley") {
          mat.color.set(isThermal ? "#0284c7" : "#8da2b5");
          mat.emissive.set("#000000");
          mat.emissiveIntensity = 0.0;
        } else if (mat.name === "motor_gearbox") {
          mat.color.set("#273240");
          mat.emissive.set("#10b981");
          mat.emissiveIntensity = 0.2;
        } else {
          mat.color.set("#3d4957");
          mat.emissive.set("#000000");
        }
      }

      // ── SPLICE FATIGUE & FRICTION (WARNING) ──
      else if (scenario === "WARNING" || condition === "WARNING") {
        if (mat.name === "belt_surface") {
          mat.color.set(isThermal ? "#b45309" : "#24180f");
          mat.emissive.set("#f59e0b");
          mat.emissiveIntensity = 0.45;
          mat.roughness = 0.85;
        } else if (mat.name === "tail_pulley") {
          // Elevated thermal on tail bearing
          mat.color.set(isThermal ? "#ea580c" : "#946d4a");
          mat.emissive.set("#f59e0b");
          mat.emissiveIntensity = 0.75;
        } else if (mat.name === "drive_pulley") {
          mat.color.set("#8da2b5");
          mat.emissive.set("#d97706");
          mat.emissiveIntensity = 0.3;
        } else if (mat.name === "motor_gearbox") {
          mat.color.set("#362719");
          mat.emissive.set("#f59e0b");
          mat.emissiveIntensity = 0.5;
        } else {
          mat.color.set("#3f3c3a");
          mat.emissive.set("#451a03");
          mat.emissiveIntensity = 0.15;
        }
      }

      // ── IMMINENT SPLICE RUPTURE (CRITICAL) ──
      else if (scenario === "CRITICAL" || condition === "CRITICAL") {
        if (mat.name === "belt_surface") {
          mat.color.set(isThermal ? "#dc2626" : "#2b1010");
          mat.emissive.set("#ef4444");
          mat.emissiveIntensity = 0.85;
          mat.roughness = 0.95;
        } else if (mat.name === "drive_pulley") {
          // Drive snub pulley thermal surge runaway (81.2°C)
          mat.color.set(isThermal ? "#b91c1c" : "#7f1d1d");
          mat.emissive.set("#dc2626");
          mat.emissiveIntensity = 1.35;
        } else if (mat.name === "tail_pulley") {
          mat.color.set("#6b21a8");
          mat.emissive.set("#ef4444");
          mat.emissiveIntensity = 0.5;
        } else if (mat.name === "motor_gearbox") {
          mat.color.set("#450a0a");
          mat.emissive.set("#ef4444");
          mat.emissiveIntensity = 0.9;
        } else {
          mat.color.set("#382323");
          mat.emissive.set("#7f1d1d");
          mat.emissiveIntensity = 0.25;
        }
      }
      mat.needsUpdate = true;
    });

    // Ambient & Directional Lighting shifts by Scenario
    if (scenario === "NORMAL" || condition === "NORMAL") {
      ambient.color.set("#1e293b");
      ambient.intensity = 1.8;
      key.color.set("#f8fafc");
      key.intensity = 2.4;
      fill.color.set("#38bdf8");
      fill.intensity = 1.2;
      anomalyPoint.intensity = 0;
    } else if (scenario === "WARNING" || condition === "WARNING") {
      ambient.color.set("#78350f");
      ambient.intensity = 2.4;
      key.color.set("#fbbf24");
      key.intensity = 2.8;
      fill.color.set("#ea580c");
      fill.intensity = 1.6;
      anomalyPoint.color.set("#f59e0b");
      anomalyPoint.position.set(0, 4, 14.1); // Splice #2 coordinate
      anomalyPoint.intensity = 2.8;
    } else {
      ambient.color.set("#7f1d1d");
      ambient.intensity = 3.2;
      key.color.set("#f87171");
      key.intensity = 3.4;
      fill.color.set("#dc2626");
      fill.intensity = 2.2;
      anomalyPoint.color.set("#ef4444");
      anomalyPoint.position.set(0, 4, 8.1); // Splice #3 coordinate
      anomalyPoint.intensity = 5.0;
    }

    // Update Splice Hologram Markers color by scenario
    if (markersGroupRef.current) {
      markersGroupRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
          const isJ2 = child.name.includes("J2");
          const isJ3 = child.name.includes("J3");

          if (scenario === "WARNING" && isJ2) {
            (mat as THREE.MeshStandardMaterial).color?.set("#f59e0b");
            if ("emissive" in mat) mat.emissive?.set("#f59e0b");
          } else if (scenario === "CRITICAL" && isJ3) {
            (mat as THREE.MeshStandardMaterial).color?.set("#ef4444");
            if ("emissive" in mat) mat.emissive?.set("#ef4444");
          } else {
            (mat as THREE.MeshStandardMaterial).color?.set("#38bdf8");
            if ("emissive" in mat) mat.emissive?.set("#38bdf8");
          }
        }
      });
    }
  }, [scenario, condition, wireframeMode, thermalMode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Camera presets
  // ─────────────────────────────────────────────────────────────────────────────
  const setCameraView = (view: "iso" | "top" | "side" | "drive") => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (view) {
      case "iso":
        cam.position.set(34, 22, 38);
        ctrl.target.set(0, 0, 0);
        break;
      case "top":
        cam.position.set(0, 52, 0.1);
        ctrl.target.set(0, 0, 0);
        break;
      case "side":
        cam.position.set(50, 4, 0);
        ctrl.target.set(0, 0, 0);
        break;
      case "drive":
        cam.position.set(22, 14, -28);
        ctrl.target.set(0, 2, -18);
        break;
    }
    ctrl.update();
  };

  const resetCamera = () => setCameraView("iso");

  // Focus camera on a selected splice joint
  const focusSplice = (spliceId: string) => {
    const loc = SPLICE_LOCATIONS.find((s) => s.id === spliceId);
    if (!loc || !cameraRef.current || !controlsRef.current) return;
    onSelectJoint?.(spliceId);
    controlsRef.current.target.set(0, 2, loc.zCoord);
    cameraRef.current.position.set(16, 12, loc.zCoord + 14);
    controlsRef.current.update();
  };

  const conditionColor =
    scenario === "CRITICAL" || condition === "CRITICAL"
      ? "text-critical border-critical/50 bg-critical-soft"
      : scenario === "WARNING" || condition === "WARNING"
        ? "text-warning border-warning/50 bg-warning-soft"
        : "text-normal border-normal/50 bg-normal-soft";

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border border-border/80 bg-[#080c12] shadow-2xl transition-all",
        isFullscreen ? "fixed inset-4 z-50 rounded-xl" : "w-full"
      )}
    >
      {/* Top HUD Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-panel/75 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-md border border-info/40 bg-info-soft text-info">
            <Box className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-extrabold uppercase tracking-[0.16em] text-foreground">
                Conveyor Digital Twin (3D CAD Assembly)
              </span>
              <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[0.5625rem] font-mono text-muted-foreground">
                Conveyor Belt Assembly.obj
              </span>
            </div>
            <p className="text-[0.625rem] text-muted-foreground">
              Real-time geometric telemetry · synchronized with active scenario simulation
            </p>
          </div>
        </div>

        {/* Live Scenario State Badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.625rem] font-bold tracking-wider uppercase",
              conditionColor
            )}
          >
            {scenario === "CRITICAL" || condition === "CRITICAL" ? (
              <>
                <AlertTriangle className="size-3 animate-pulse text-critical" />
                Rupture Hazard · 81.2°C Thermal Runaway
              </>
            ) : scenario === "WARNING" || condition === "WARNING" ? (
              <>
                <Zap className="size-3 text-warning" />
                Splice #2 Friction Heat · 58.4°C
              </>
            ) : (
              <>
                <ShieldCheck className="size-3 text-normal" />
                Nominal Baseline · 38.0°C Equilibrium
              </>
            )}
          </span>

          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen 3D Viewer"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div className="relative min-h-[360px] sm:min-h-[420px] w-full flex-1 overflow-hidden">
        <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-background/85 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative size-12">
                <div className="size-12 rounded-full border-2 border-info/30 border-t-info animate-spin" />
                <Box className="absolute inset-0 m-auto size-5 text-info animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Synthesizing 3D Digital Twin CAD
                </p>
                <p className="mt-1 text-[0.6875rem] font-mono text-muted-foreground">
                  Parsing vertices & meshes ({loadProgress}%)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Floating Top Controls Overlay */}
        <div className="pointer-events-auto absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
          <div className="flex items-center rounded-md border border-border/80 bg-background/85 p-1 backdrop-blur shadow-sm">
            <span className="px-2 text-[0.5625rem] font-bold uppercase tracking-wider text-muted-foreground">
              Camera
            </span>
            <button
              type="button"
              onClick={() => setCameraView("iso")}
              className="rounded px-2 py-1 text-[0.625rem] font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Iso
            </button>
            <button
              type="button"
              onClick={() => setCameraView("top")}
              className="rounded px-2 py-1 text-[0.625rem] font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => setCameraView("side")}
              className="rounded px-2 py-1 text-[0.625rem] font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Side
            </button>
            <button
              type="button"
              onClick={() => setCameraView("drive")}
              className="rounded px-2 py-1 text-[0.625rem] font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Drive
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border/80 bg-background/85 p-1 backdrop-blur shadow-sm">
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-2 text-[0.625rem] font-semibold tracking-wider uppercase",
                autoRotate ? "text-info bg-info/10" : "text-muted-foreground"
              )}
              onClick={() => setAutoRotate(!autoRotate)}
              title="Toggle Auto Rotation"
            >
              {autoRotate ? <Pause className="size-3 mr-1" /> : <Play className="size-3 mr-1" />}
              Rotate
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-2 text-[0.625rem] font-semibold tracking-wider uppercase",
                wireframeMode ? "text-warning bg-warning/10" : "text-muted-foreground"
              )}
              onClick={() => setWireframeMode(!wireframeMode)}
              title="Toggle Mesh Wireframe"
            >
              <Grid className="size-3 mr-1" />
              Wireframe
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-2 text-[0.625rem] font-semibold tracking-wider uppercase",
                thermalMode ? "text-critical bg-critical/10" : "text-muted-foreground"
              )}
              onClick={() => setThermalMode(!thermalMode)}
              title="Toggle Thermal Stress Heatmap"
            >
              <Flame className="size-3 mr-1" />
              Thermal
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[0.625rem] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground"
              onClick={resetCamera}
              title="Reset Viewpoint"
            >
              <RotateCcw className="size-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>


        {/* Bottom Interactive HUD Bar */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-background/90 px-3 py-2 backdrop-blur shadow-lg">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-info" />
                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
                  Belt Speed:
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {scenario === "CRITICAL" ? "0.85 m/s (Degraded)" : "2.85 m/s"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
                <Flame className="size-3.5 text-warning" />
                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
                  Drive Pulley Temp:
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {scenario === "CRITICAL"
                    ? "81.2°C (Surge!)"
                    : scenario === "WARNING"
                      ? "58.4°C (+20.4°C)"
                      : "38.0°C (Nominal)"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
                <Eye className="size-3.5 text-info" />
                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
                  Splice Integrity:
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {scenario === "CRITICAL" ? "31.0% (Rupture Imminent)" : scenario === "WARNING" ? "68.4% (Fatigued)" : "98.2% (Healthy)"}
                </span>
              </div>
            </div>

            <div className="text-[0.5625rem] font-mono text-muted-foreground">
              [Left Click: Rotate · Right Click: Pan · Scroll: Zoom]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
