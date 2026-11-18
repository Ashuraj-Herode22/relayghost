"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ReplayFrame } from "@/lib/plcVerifier";
import { MachineArchetype, MACHINE_DEFINITIONS, classifyMachineArchetype } from "./workcell/types";
import { IndustrialParticleEngine } from "./workcell/ParticleSystem";
import { MachineInstance, buildStampingPress } from "./workcell/machines/stampingPress";
import { buildBottleFiller } from "./workcell/machines/bottleFiller";
import { buildConveyorDiverter } from "./workcell/machines/conveyorDiverter";
import { buildCuringOven } from "./workcell/machines/curingOven";
import { buildMotorBridge } from "./workcell/machines/motorBridge";
import { buildRobotHandover } from "./workcell/machines/robotHandover";

interface WorkcellCanvasProps {
  currentFrame?: ReplayFrame;
  isCollision?: boolean;
  isSafe?: boolean;
  collisionDescription?: string | null;
  sourceName?: string;
  machineType?: MachineArchetype;
  onMachineTypeChange?: (machine: MachineArchetype) => void;
}

/**
 * High-Fidelity WebAudio Industrial Synthesizer
 * Procedurally generates authentic audio for each machine type.
 */
class IndustrialAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  public unlock() {
    if (this.muted) return;
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {}
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (!muted) this.unlock();
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx || this.ctx.state !== "running") {
      this.unlock();
    }
    return this.ctx && this.ctx.state === "running" ? this.ctx : null;
  }

  public playServoHum(freq = 120) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.12);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  public playCollisionSound(machineType: MachineArchetype) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;

      if (machineType === "bottle_filler") {
        // High-frequency glass bottle shattering
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(2400, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (machineType === "motor_bridge") {
        // 480V Arc Flash Electrical Zap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.setValueAtTime(480, now + 0.08);
        osc.frequency.setValueAtTime(60, now + 0.18);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (machineType === "curing_oven") {
        // Volumetric thermal flash combustion whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.5);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      } else {
        // Heavy Stamping Press / Robot Crash: Massive metallic thud + klaxon
        const thudOsc = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thudOsc.type = "sine";
        thudOsc.frequency.setValueAtTime(220, now);
        thudOsc.frequency.exponentialRampToValueAtTime(32, now + 0.35);
        thudGain.gain.setValueAtTime(0.4, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        thudOsc.connect(thudGain);
        thudGain.connect(ctx.destination);
        thudOsc.start(now);
        thudOsc.stop(now + 0.42);

        // Industrial Klaxon
        const buzzOsc = ctx.createOscillator();
        const buzzGain = ctx.createGain();
        buzzOsc.type = "sawtooth";
        buzzOsc.frequency.setValueAtTime(680, now);
        buzzOsc.frequency.setValueAtTime(520, now + 0.14);
        buzzGain.gain.setValueAtTime(0.2, now);
        buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        buzzOsc.connect(buzzGain);
        buzzGain.connect(ctx.destination);
        buzzOsc.start(now);
        buzzOsc.stop(now + 0.48);
      }
    } catch {}
  }

  public playSafeChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 triad
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.001, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.07, now + i * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.45);
      });
    } catch {}
  }
}

export default function WorkcellCanvas({
  currentFrame,
  isCollision,
  isSafe,
  collisionDescription,
  sourceName = "",
  machineType,
  onMachineTypeChange,
}: WorkcellCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Auto-detect machine from loaded PLC program metadata or explicit machineType prop
  const detectedMachine = useMemo(
    () => machineType || classifyMachineArchetype(sourceName, collisionDescription || ""),
    [machineType, sourceName, collisionDescription]
  );

  const [activeMachineType, setActiveMachineType] = useState<MachineArchetype>(detectedMachine);
  const [cameraView, setCameraView] = useState<"iso" | "macro" | "top">("iso");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showMachineMenu, setShowMachineMenu] = useState<boolean>(false);

  // Keep active machine in sync if user selects a different scenario or prop changes
  useEffect(() => {
    setActiveMachineType(detectedMachine);
  }, [detectedMachine]);

  const audioRef = useRef<IndustrialAudioSynthesizer | null>(null);
  const prevCollisionRef = useRef<boolean>(false);
  const prevOutputsRef = useRef<Record<string, boolean>>({});

  // Machine instance and particle engine references
  const machineRef = useRef<MachineInstance | null>(null);
  const particleEngineRef = useRef<IndustrialParticleEngine | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Smooth camera interpolation targets
  const cameraTargetRef = useRef({
    position: new THREE.Vector3(0, 4.4, 9.6),
    lookAt: new THREE.Vector3(0, 0.8, 0),
    isInteracting: false,
    shakeIntensity: 0,
  });

  const activeMachineMeta = MACHINE_DEFINITIONS[activeMachineType];

  // Initialize WebAudio
  useEffect(() => {
    audioRef.current = new IndustrialAudioSynthesizer();
    return () => {
      audioRef.current = null;
    };
  }, []);

  const toggleMute = () => {
    if (!audioRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    audioRef.current.setMuted(next);
  };

  // Mount Three.js Viewport
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x06070a);
    scene.fog = new THREE.FogExp2(0x06070a, 0.038);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 4.4, 9.6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountRef.current.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 + 0.02;
    controls.minDistance = 2.2;
    controls.maxDistance = 22;
    controls.target.set(0, 0.8, 0);

    controls.addEventListener("start", () => {
      cameraTargetRef.current.isInteracting = true;
    });

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(6, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-8, 6, -6);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x818cf8, 0.8);
    fillLight.position.set(0, -2, -6);
    scene.add(fillLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(30, 30, 0x334155, 0x0f172a);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Floor reflector plane
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080b11,
      roughness: 0.45,
      metalness: 0.65,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    // Particle Engine
    const particleEngine = new IndustrialParticleEngine(scene);
    particleEngineRef.current = particleEngine;

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 120 FPS Continuous Render Loop
    let lastTime = performance.now();
    let animId: number;

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Update particle physics
      particleEngine.update(dt);

      // Smooth Camera & Target Lerp
      const targets = cameraTargetRef.current;
      if (!targets.isInteracting) {
        controls.target.lerp(targets.lookAt, dt * 6.0);
        camera.position.lerp(targets.position, dt * 6.0);

        // Screen Shake decay
        if (targets.shakeIntensity > 0.001) {
          const shakeX = (Math.random() - 0.5) * targets.shakeIntensity;
          const shakeY = (Math.random() - 0.5) * targets.shakeIntensity;
          camera.position.x += shakeX;
          camera.position.y += shakeY;
          targets.shakeIntensity *= 0.88;
        }
      }
      controls.update();

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      particleEngine.dispose();
      renderer.dispose();
      if (mountRef.current) mountRef.current.replaceChildren();
    };
  }, []);

  // Dynamically Mount the Active Machine Model
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Tear down existing machine
    if (machineRef.current) {
      machineRef.current.dispose();
      machineRef.current = null;
    }

    // Build the selected machine
    let newMachine: MachineInstance;
    switch (activeMachineType) {
      case "bottle_filler":
        newMachine = buildBottleFiller(scene);
        break;
      case "conveyor_diverter":
        newMachine = buildConveyorDiverter(scene);
        break;
      case "curing_oven":
        newMachine = buildCuringOven(scene);
        break;
      case "motor_bridge":
        newMachine = buildMotorBridge(scene);
        break;
      case "robot_handover":
        newMachine = buildRobotHandover(scene);
        break;
      case "stamping_press":
      default:
        newMachine = buildStampingPress(scene);
        break;
    }

    machineRef.current = newMachine;

    // Set initial camera focus to machine center
    if (cameraTargetRef.current) {
      cameraTargetRef.current.lookAt.copy(newMachine.collisionPoint);
    }
  }, [activeMachineType]);

  // Update Kinematics, Camera Tracking, Audio, & Particle Effects
  useEffect(() => {
    const machine = machineRef.current;
    const particles = particleEngineRef.current;
    const audio = audioRef.current;
    if (!machine) return;

    const outputs = currentFrame?.outputs || {};
    const isCrash = Boolean(isCollision);
    const safe = Boolean(isSafe);

    // Update 3D machine kinematics
    machine.updateKinematics(outputs, 0.016, isCrash, safe);

    // Audio triggers on state change
    const prevOutputs = prevOutputsRef.current;
    const hasOutputsChanged = Object.keys(outputs).some((k) => outputs[k] !== prevOutputs[k]);
    if (hasOutputsChanged && !isCrash && audio) {
      audio.playServoHum();
    }
    prevOutputsRef.current = { ...outputs };

    // Collision Detection & Cinematic Impact Trigger
    if (isCrash && !prevCollisionRef.current) {
      // Trigger camera micro-shake & zoom to collision impact point
      cameraTargetRef.current.shakeIntensity = 0.18;
      cameraTargetRef.current.lookAt.copy(machine.collisionPoint);

      // Play tailored audio
      if (audio) audio.playCollisionSound(activeMachineType);

      // Emit high-energy particle burst
      if (particles) {
        if (activeMachineType === "bottle_filler") {
          particles.emitGlassShards(machine.collisionPoint, 60);
        } else if (activeMachineType === "motor_bridge") {
          particles.emitArcFlash(machine.collisionPoint, 65);
        } else if (activeMachineType === "curing_oven") {
          particles.emitThermalFlare(machine.collisionPoint, 50);
        } else {
          particles.emitSparks(machine.collisionPoint, 55, 6.0);
        }
      }
    } else if (safe && !prevCollisionRef.current && currentFrame?.cycle === 1) {
      if (audio) audio.playSafeChime();
    }

    prevCollisionRef.current = isCrash;
  }, [currentFrame, isCollision, isSafe, activeMachineType]);

  // Select Camera Preset
  const handleSelectCameraView = (view: "iso" | "macro" | "top") => {
    setCameraView(view);
    const targets = cameraTargetRef.current;
    targets.isInteracting = false;
    const focus = machineRef.current ? machineRef.current.collisionPoint : new THREE.Vector3(0, 0.8, 0);

    if (view === "iso") {
      targets.position.set(0, 4.4, 9.6);
      targets.lookAt.copy(focus);
    } else if (view === "macro") {
      // Dramatic cinematic close-up of collision zone
      targets.position.set(focus.x + 0.65, focus.y + 0.45, focus.z + 2.8);
      targets.lookAt.copy(focus);
    } else if (view === "top") {
      targets.position.set(0, 9.8, 2.4);
      targets.lookAt.set(0, 0, 0);
    }
  };

  const cycleDisplay = currentFrame
    ? `CYCLE ${String(currentFrame.cycle).padStart(2, "0")} · ${currentFrame.timestamp_ms}ms`
    : "STANDBY";

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden bg-[#06070A] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] group">
      {/* Dynamic Ambient Viewport Glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-700 ${
          isCollision ? "ambient-glow-hazard" : isSafe ? "ambient-glow-safe" : ""
        }`}
      />

      {/* Three.js Interactive Canvas Container (120 FPS Fluidity) */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtle Drag Hint */}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/[0.06] text-[10px] font-mono text-slate-400 pointer-events-none opacity-60 group-hover:opacity-100 transition flex items-center space-x-1.5">
        <span>🖱️ Drag to orbit · Scroll to zoom</span>
        <span className="text-slate-600">|</span>
        <span className="text-amber-400 font-semibold">120 FPS Kinematics</span>
      </div>

      {/* Top Floating Telemetry & Controls HUD */}
      <div className="absolute top-3.5 inset-x-3.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Left: Active Machine Badge + Replay Cycle */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* Machine Archetype Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setShowMachineMenu(!showMachineMenu)}
              className="bg-[#0C0E14]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/[0.12] text-[11px] font-mono text-white flex items-center space-x-1.5 shadow-lg hover:border-amber-500/50 transition active:scale-95"
              title="Switch 3D Industrial Machinery Digital Twin"
            >
              <span className="text-sm">{activeMachineMeta.icon}</span>
              <span className="font-bold tracking-wide truncate max-w-[150px] sm:max-w-[210px]">
                {activeMachineMeta.name}
              </span>
              <svg className="w-3 h-3 text-slate-400" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Machine Archetype Menu */}
            {showMachineMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMachineMenu(false)} />
                <div className="absolute top-full mt-2 left-0 w-80 rounded-xl bg-[#0C0E14] border border-white/[0.15] shadow-2xl p-2 z-50 text-xs font-mono space-y-1">
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Select Industrial Machinery Digital Twin
                  </div>
                  {Object.values(MACHINE_DEFINITIONS).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setActiveMachineType(m.id);
                        if (onMachineTypeChange) onMachineTypeChange(m.id);
                        setShowMachineMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center space-x-2.5 transition ${
                        activeMachineType === m.id
                          ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                          : "text-slate-300 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="text-base">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[11px] text-white truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{m.tagline}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Telemetry Cycle Badge */}
          <div className="bg-[#0C0E14]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/[0.08] text-[11px] font-mono text-slate-300 flex items-center space-x-2 shadow-lg">
            <span
              className={`w-2 h-2 rounded-full ${
                isCollision ? "bg-rose-500 animate-ping" : isSafe ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="font-semibold text-white tracking-wide">{cycleDisplay}</span>
          </div>
        </div>

        {/* Right: Audio Synthesizer + Camera Views */}
        <div className="bg-[#0C0E14]/90 backdrop-blur-md p-1 rounded-full border border-white/[0.08] text-[11px] font-mono flex items-center space-x-1 pointer-events-auto shadow-lg">
          {/* Audio Synthesizer Toggle */}
          <button
            onClick={toggleMute}
            className={`px-2.5 py-1 rounded-full transition flex items-center space-x-1 text-[11px] ${
              isMuted
                ? "bg-white/[0.04] text-slate-400 hover:text-white"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            }`}
            title="Toggle Procedural WebAudio Synthesizer (Metallic impacts, glass shatter, electrical arcs)"
          >
            <span>{isMuted ? "🔇 Muted" : "🔊 Audio"}</span>
          </button>

          <div className="w-[1px] h-3 bg-white/[0.1] mx-0.5" />

          {/* Camera Angles */}
          <button
            onClick={() => handleSelectCameraView("iso")}
            className={`px-2.5 py-1 rounded-full transition ${
              cameraView === "iso" ? "bg-white text-slate-950 font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Iso
          </button>
          <button
            onClick={() => handleSelectCameraView("macro")}
            className={`px-2.5 py-1 rounded-full transition ${
              cameraView === "macro" ? "bg-amber-400 text-slate-950 font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Die / Impact
          </button>
          <button
            onClick={() => handleSelectCameraView("top")}
            className={`px-2.5 py-1 rounded-full transition ${
              cameraView === "top" ? "bg-white text-slate-950 font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Top
          </button>
        </div>
      </div>

      {/* Cinematic Collision Breach Warning Overlay */}
      {isCollision && (
        <div className="absolute inset-0 border-2 border-rose-500/80 pointer-events-none flex items-center justify-center p-4">
          <div className="bg-rose-950/95 backdrop-blur-md border border-rose-500/90 px-5 py-2.5 rounded-xl shadow-2xl text-rose-100 font-mono text-xs font-bold tracking-wider animate-bounce flex items-center space-x-2 max-w-[90%] text-center">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="truncate">
              {collisionDescription
                ? `CRITICAL BREACH [${activeMachineMeta.collisionZoneName.toUpperCase()}]: ${collisionDescription}`
                : `CRITICAL INVARIANT BREACH INSIDE ${activeMachineMeta.collisionZoneName.toUpperCase()}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
