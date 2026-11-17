"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ReplayFrame } from "@/lib/plcVerifier";

interface WorkcellCanvasProps {
  currentFrame?: ReplayFrame;
  isCollision?: boolean;
  isSafe?: boolean;
}

/**
 * Zero-dependency WebAudio Industrial Synthesizer
 * Lazily initialized to honor browser autoplay policies without console warnings.
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

  public playServoHum() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(155, now + 0.15);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.24);
    } catch {}
  }

  public playCollisionSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;

      // Heavy metallic thud
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = "sine";
      thudOsc.frequency.setValueAtTime(240, now);
      thudOsc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

      thudGain.gain.setValueAtTime(0.35, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.4);

      // Industrial Klaxon Alarm
      const buzzOsc = ctx.createOscillator();
      const buzzGain = ctx.createGain();
      buzzOsc.type = "sawtooth";
      buzzOsc.frequency.setValueAtTime(720, now);
      buzzOsc.frequency.setValueAtTime(560, now + 0.12);
      buzzOsc.frequency.setValueAtTime(860, now + 0.24);

      buzzGain.gain.setValueAtTime(0.18, now);
      buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      buzzOsc.connect(buzzGain);
      buzzGain.connect(ctx.destination);
      buzzOsc.start(now);
      buzzOsc.stop(now + 0.48);
    } catch {}
  }

  public playSafeChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 harmonic triad
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.09);

        gain.gain.setValueAtTime(0.001, now + i * 0.09);
        gain.gain.linearRampToValueAtTime(0.08, now + i * 0.09 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.5);
      });
    } catch {}
  }
}

export default function WorkcellCanvas({ currentFrame, isCollision, isSafe }: WorkcellCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraView, setCameraView] = useState<"iso" | "die" | "top">("iso");
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<IndustrialAudioSynthesizer | null>(null);
  const prevCollisionRef = useRef<boolean>(false);
  const prevOutputsRef = useRef<Record<string, boolean>>({});

  // Dynamic kinematic target state for smooth Three.MathUtils.lerp physics interpolation
  const kinematicsTargetRef = useRef<{
    pressY: number;
    armX: number;
    conveyorScale: number;
    clampZ: number;
    laserOpacity: number;
    beaconIntensity: number;
    cameraPos: THREE.Vector3;
    cameraLook: THREE.Vector3;
    isShaking: boolean;
  }>({
    pressY: 3.1,
    armX: 0.0,
    conveyorScale: 1.0,
    clampZ: 2.2,
    laserOpacity: 0.15,
    beaconIntensity: 0,
    cameraPos: new THREE.Vector3(0, 4.4, 9.6),
    cameraLook: new THREE.Vector3(0, 0.8, 0),
    isShaking: false,
  });

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    pressRam: THREE.Mesh;
    transferArm: THREE.Group;
    conveyorBelt: THREE.Mesh;
    clampJaws: THREE.Group;
    pumpValve: THREE.Mesh;
    laserCurtain: THREE.Mesh;
    beaconLight: THREE.PointLight;
    rimLight: THREE.DirectionalLight;
    sparkParticles: THREE.Points;
  } | null>(null);

  // Lazy browser autoplay unlock
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new IndustrialAudioSynthesizer();
    }

    const unlockListener = () => {
      audioRef.current?.unlock();
      window.removeEventListener("pointerdown", unlockListener);
      window.removeEventListener("keydown", unlockListener);
    };

    window.addEventListener("pointerdown", unlockListener, { once: true });
    window.addEventListener("keydown", unlockListener, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockListener);
      window.removeEventListener("keydown", unlockListener);
    };
  }, []);

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.setMuted(nextMuted);
    if (!nextMuted) {
      audioRef.current.playSafeChime();
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;
    mountRef.current.replaceChildren();

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 420;

    // 1. Scene, Camera, Renderer with Studio Exponential Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06070a);
    scene.fog = new THREE.FogExp2(0x06070a, 0.038);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    camera.position.set(0, 4.4, 9.6);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // 2. Studio 3-Point Lighting Setup
    const ambientLight = new THREE.HemisphereLight(0x334155, 0x06070a, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xe2e8f0, 2.6);
    keyLight.position.set(6, 11, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Warm Amber Rim Light for Crisp Spectral Silhouette
    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.8);
    rimLight.position.set(-6, 5, -5);
    scene.add(rimLight);

    // Dynamic Breach Beacon Light
    const beaconLight = new THREE.PointLight(0xff0044, 0, 16);
    beaconLight.position.set(0, 4.2, 0);
    scene.add(beaconLight);

    // 3. Precision Brushed Gunmetal PBR Materials
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      metalness: 0.85,
      roughness: 0.25,
    });

    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x161c26,
      metalness: 0.9,
      roughness: 0.35,
    });

    // 4. Industrial Floor with Subtle Precision Grid
    const floorGeo = new THREE.PlaneGeometry(34, 34);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090c13,
      roughness: 0.85,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(34, 34, 0x1e2738, 0x0f141f);
    grid.position.y = -0.49;
    scene.add(grid);

    // 5. Heavy Hydraulic Stamping Press (%QX0.0)
    const colGeo = new THREE.BoxGeometry(0.42, 4.6, 0.42);
    const leftCol = new THREE.Mesh(colGeo, gunmetalMat);
    leftCol.position.set(-1.85, 1.8, 0);
    leftCol.castShadow = true;
    scene.add(leftCol);

    const rightCol = new THREE.Mesh(colGeo, gunmetalMat);
    rightCol.position.set(1.85, 1.8, 0);
    rightCol.castShadow = true;
    scene.add(rightCol);

    const crownGeo = new THREE.BoxGeometry(4.3, 0.85, 1.25);
    const crown = new THREE.Mesh(crownGeo, darkSteelMat);
    crown.position.set(0, 4.1, 0);
    scene.add(crown);

    const bolsterGeo = new THREE.BoxGeometry(3.7, 0.45, 1.25);
    const bolster = new THREE.Mesh(bolsterGeo, darkSteelMat);
    bolster.position.set(0, -0.28, 0);
    bolster.receiveShadow = true;
    scene.add(bolster);

    // Hazard Striping on Bolster Die Bed Edge
    const stripeGeo = new THREE.BoxGeometry(3.7, 0.06, 0.04);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const hazardStripe = new THREE.Mesh(stripeGeo, stripeMat);
    hazardStripe.position.set(0, -0.05, 0.63);
    scene.add(hazardStripe);

    // Moving Press Ram Head (%QX0.0)
    const ramGeo = new THREE.BoxGeometry(2.9, 0.72, 0.95);
    const ramMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.65,
      roughness: 0.28,
      emissive: 0x000000,
    });
    const pressRam = new THREE.Mesh(ramGeo, ramMat);
    pressRam.position.set(0, 3.1, 0);
    pressRam.castShadow = true;
    scene.add(pressRam);

    // 6. Robotic Transfer Arm (%QX0.1)
    const transferArm = new THREE.Group();
    const armBaseGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.65, 20);
    const armBase = new THREE.Mesh(armBaseGeo, darkSteelMat);
    armBase.position.set(-2.85, -0.18, 0);
    transferArm.add(armBase);

    const armBoomGeo = new THREE.BoxGeometry(2.5, 0.22, 0.22);
    const armBoomMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.3 });
    const armBoom = new THREE.Mesh(armBoomGeo, armBoomMat);
    armBoom.position.set(-1.55, 0.52, 0);
    armBoom.castShadow = true;
    transferArm.add(armBoom);

    const gripperGeo = new THREE.BoxGeometry(0.32, 0.42, 0.32);
    const gripperMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 });
    const gripper = new THREE.Mesh(gripperGeo, gripperMat);
    gripper.position.set(-0.3, 0.52, 0);
    transferArm.add(gripper);

    scene.add(transferArm);

    // 7. Feed Conveyor Belt (%QX0.2)
    const conveyorGeo = new THREE.BoxGeometry(1.25, 0.22, 4.2);
    const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x18202f, roughness: 0.9 });
    const conveyorBelt = new THREE.Mesh(conveyorGeo, conveyorMat);
    conveyorBelt.position.set(0, -0.12, 2.3);
    conveyorBelt.receiveShadow = true;
    scene.add(conveyorBelt);

    // 8. Diverter Clamp (%QX0.3)
    const clampJaws = new THREE.Group();
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.7, roughness: 0.3 });
    const jaw1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.45), jawMat);
    jaw1.position.set(-0.72, 0.12, 2.3);
    const jaw2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.45), jawMat);
    jaw2.position.set(0.72, 0.12, 2.3);
    clampJaws.add(jaw1);
    clampJaws.add(jaw2);
    scene.add(clampJaws);

    // 9. Solenoid Relief Valve (%QX0.4)
    const valveGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.55, 16);
    const valveMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.85, roughness: 0.25 });
    const pumpValve = new THREE.Mesh(valveGeo, valveMat);
    pumpValve.position.set(2.45, 0.12, 0);
    scene.add(pumpValve);

    // 10. Safety Light Curtain (%QX0.5 / %IX0.3)
    const curtainGeo = new THREE.PlaneGeometry(3.7, 2.6);
    const curtainMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const laserCurtain = new THREE.Mesh(curtainGeo, curtainMat);
    laserCurtain.position.set(0, 1.25, 0.72);
    scene.add(laserCurtain);

    // 11. Volumetric Collision Spark Particles
    const sparkCount = 140;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount * 3; i += 3) {
      sparkPositions[i] = (Math.random() - 0.5) * 1.6;
      sparkPositions[i + 1] = 0.5 + (Math.random() - 0.5) * 0.9;
      sparkPositions[i + 2] = (Math.random() - 0.5) * 1.3;
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xff3b30,
      size: 0.14,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const sparkParticles = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkParticles);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      pressRam,
      transferArm,
      conveyorBelt,
      clampJaws,
      pumpValve,
      laserCurtain,
      beaconLight,
      rimLight,
      sparkParticles,
    };

    // Smooth Physics Animation Loop with THREE.MathUtils.lerp
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const targets = kinematicsTargetRef.current;
      if (sceneRef.current) {
        // Damped interpolation for physical mass sensation
        pressRam.position.y = THREE.MathUtils.lerp(pressRam.position.y, targets.pressY, 0.22);
        transferArm.position.x = THREE.MathUtils.lerp(transferArm.position.x, targets.armX, 0.22);
        conveyorBelt.scale.z = THREE.MathUtils.lerp(conveyorBelt.scale.z, targets.conveyorScale, 0.2);
        clampJaws.position.z = THREE.MathUtils.lerp(clampJaws.position.z, targets.clampZ, 0.2);
        beaconLight.intensity = THREE.MathUtils.lerp(beaconLight.intensity, targets.beaconIntensity, 0.25);

        // Smooth camera transitions between Isometric / Die Zoom / Top View
        camera.position.lerp(targets.cameraPos, 0.09);

        // Subtle Camera Micro-Shake on Breach Impact Frame
        if (targets.isShaking) {
          camera.position.x += (Math.random() - 0.5) * 0.04;
          camera.position.y += (Math.random() - 0.5) * 0.04;
        }

        renderer.render(scene, camera);
      }
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || 600;
      const h = mountRef.current.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mountRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mountRef.current) mountRef.current.replaceChildren();
    };
  }, []);

  // Update Camera View Presets
  useEffect(() => {
    const targets = kinematicsTargetRef.current;
    if (cameraView === "iso") {
      targets.cameraPos = new THREE.Vector3(0, 4.4, 9.6);
      targets.cameraLook = new THREE.Vector3(0, 0.8, 0);
    } else if (cameraView === "die") {
      targets.cameraPos = new THREE.Vector3(0.55, 1.45, 3.6);
      targets.cameraLook = new THREE.Vector3(0.15, 0.75, 0);
    } else if (cameraView === "top") {
      targets.cameraPos = new THREE.Vector3(0, 10.2, 0.1);
      targets.cameraLook = new THREE.Vector3(0, 0, 0);
    }
  }, [cameraView]);

  // Update Kinematics Targets and Audio based on active ReplayFrame
  useEffect(() => {
    if (!sceneRef.current) return;
    const { pressRam, laserCurtain, sparkParticles, rimLight } = sceneRef.current;
    const targets = kinematicsTargetRef.current;

    const outputs = currentFrame?.outputs || {};
    const isPressDown = !!outputs["%QX0.0"];
    const isArmIn = !!outputs["%QX0.1"];
    const isConveyorOn = !!outputs["%QX0.2"];
    const isClampShut = !!outputs["%QX0.3"];
    const isPumpOpen = !!outputs["%QX0.4"];
    const isAlarm = !!outputs["%QX0.5"] || isCollision;

    // Set kinematic targets for lerp animation
    targets.pressY = isPressDown ? 0.45 : 3.1;
    targets.armX = isArmIn ? 1.62 : 0.0;
    targets.conveyorScale = isConveyorOn ? 1.05 : 1.0;
    targets.clampZ = isClampShut ? 2.05 : 2.3;
    targets.beaconIntensity = isAlarm ? 4.5 : 0;
    targets.isShaking = Boolean(isCollision);

    // Audio cues
    if (audioRef.current) {
      if (isCollision && !prevCollisionRef.current) {
        audioRef.current.playCollisionSound();
      } else {
        const moved =
          isPressDown !== !!prevOutputsRef.current["%QX0.0"] ||
          isArmIn !== !!prevOutputsRef.current["%QX0.1"] ||
          isConveyorOn !== !!prevOutputsRef.current["%QX0.2"] ||
          isClampShut !== !!prevOutputsRef.current["%QX0.3"];
        if (moved) {
          audioRef.current.playServoHum();
        }
      }
    }
    prevCollisionRef.current = Boolean(isCollision);
    prevOutputsRef.current = { ...outputs };

    // Visual Breach Glow vs Emerald Safe Halo
    if (isCollision) {
      (pressRam.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0044);
      (sparkParticles.material as THREE.PointsMaterial).opacity = 1.0;
      sparkParticles.rotation.y += 0.3;
      rimLight.color.setHex(0xef4444);
    } else if (isSafe) {
      (pressRam.material as THREE.MeshStandardMaterial).emissive.setHex(0x064e3b);
      (sparkParticles.material as THREE.PointsMaterial).opacity = 0.0;
      rimLight.color.setHex(0x10b981);
    } else {
      (pressRam.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      (sparkParticles.material as THREE.PointsMaterial).opacity = 0.0;
      rimLight.color.setHex(0xf59e0b);
    }

    (laserCurtain.material as THREE.MeshBasicMaterial).opacity = isAlarm ? 0.45 : 0.15;
  }, [currentFrame, isCollision, isSafe]);

  const cycleDisplay = currentFrame ? `CYCLE ${String(currentFrame.cycle).padStart(2, "0")} · ${currentFrame.timestamp_ms}ms` : "STANDBY";

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden bg-[#06070A] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      {/* Dynamic Radial Ambient Viewport Glow */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-700 ${
        isCollision ? "ambient-glow-hazard" : isSafe ? "ambient-glow-safe" : ""
      }`} />

      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top Floating HUD Bar: Left Telemetry Pill + Right Viewport Controls */}
      <div className="absolute top-3.5 inset-x-3.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Left Telemetry Status Pill */}
        <div className="bg-[#0C0E14]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/[0.08] text-[11px] font-mono text-slate-300 flex items-center space-x-2 pointer-events-auto shadow-lg">
          <span className={`w-2 h-2 rounded-full ${
            isCollision ? "bg-rose-500 animate-ping" : isSafe ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
          }`} />
          <span className="font-semibold text-white tracking-wide">{cycleDisplay}</span>
          <span className="text-slate-500">|</span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">6 UNIVERSAL ACTUATORS</span>
        </div>

        {/* Right Unified Controls: Audio Synthesizer + Camera Views */}
        <div className="bg-[#0C0E14]/85 backdrop-blur-md p-1 rounded-full border border-white/[0.08] text-[11px] font-mono flex items-center space-x-1 pointer-events-auto shadow-lg">
          {/* Audio Synthesizer Toggle */}
          <button
            onClick={toggleMute}
            className={`px-2.5 py-1 rounded-full transition flex items-center space-x-1 text-[11px] ${
              isMuted
                ? "bg-white/[0.04] text-slate-400 hover:text-white"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            }`}
            title="Toggle Industrial WebAudio Synthesizer (Servo hum + breach thud)"
          >
            <span>{isMuted ? "🔇 Muted" : "🔊 Audio"}</span>
          </button>

          <div className="w-[1px] h-3 bg-white/[0.1] mx-0.5" />

          {/* Camera Angles */}
          <button
            onClick={() => setCameraView("iso")}
            className={`px-2.5 py-1 rounded-full transition ${
              cameraView === "iso" ? "bg-white text-slate-950 font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Iso
          </button>
          <button
            onClick={() => setCameraView("die")}
            className={`px-2.5 py-1 rounded-full transition ${
              cameraView === "die" ? "bg-amber-400 text-slate-950 font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Die Zoom
          </button>
          <button
            onClick={() => setCameraView("top")}
            className={`px-2.5 py-1 rounded-full transition ${
              cameraView === "top" ? "bg-white text-slate-950 font-bold shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Top
          </button>
        </div>
      </div>

      {/* Cinematic Collision Breach Warning */}
      {isCollision && (
        <div className="absolute inset-0 border-2 border-rose-500/70 pointer-events-none flex items-center justify-center p-4">
          <div className="bg-rose-950/90 backdrop-blur-md border border-rose-500/80 px-5 py-2.5 rounded-xl shadow-2xl text-rose-100 font-mono text-xs font-bold tracking-wider animate-bounce flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span>CRITICAL INVARIANT BREACH: %QX0.0 PRESS & %QX0.1 ARM COLLISION</span>
          </div>
        </div>
      )}
    </div>
  );
}
