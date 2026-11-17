"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ReplayFrame } from "@/lib/plcVerifier";

interface WorkcellCanvasProps {
  currentFrame?: ReplayFrame;
  isCollision?: boolean;
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

  // Servo motor hum during mechanical movement
  public playServoHum() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.15);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.24);
    } catch {}
  }

  // Heavy metallic impact & industrial alarm buzzer
  public playCollisionSound() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;

      // 1. Low metallic thud
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = "sine";
      thudOsc.frequency.setValueAtTime(260, now);
      thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      thudGain.gain.setValueAtTime(0.35, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.4);

      // 2. Alarm klaxon buzzer
      const buzzOsc = ctx.createOscillator();
      const buzzGain = ctx.createGain();
      buzzOsc.type = "sawtooth";
      buzzOsc.frequency.setValueAtTime(740, now);
      buzzOsc.frequency.setValueAtTime(580, now + 0.12);
      buzzOsc.frequency.setValueAtTime(880, now + 0.24);

      buzzGain.gain.setValueAtTime(0.18, now);
      buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      buzzOsc.connect(buzzGain);
      buzzGain.connect(ctx.destination);
      buzzOsc.start(now);
      buzzOsc.stop(now + 0.48);
    } catch {}
  }

  // Safety confirmation harmonic chime
  public playSafeChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0.001, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.09, now + i * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.5);
      });
    } catch {}
  }
}

export default function WorkcellCanvas({ currentFrame, isCollision }: WorkcellCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraView, setCameraView] = useState<"iso" | "die" | "top">("iso");
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<IndustrialAudioSynthesizer | null>(null);
  const prevCollisionRef = useRef<boolean>(false);
  const prevOutputsRef = useRef<Record<string, boolean>>({});

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

    // React 19 StrictMode: Clear any previous canvases before appending
    mountRef.current.replaceChildren();

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 400;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 9.5);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // 2. Lighting (Moody Industrial Dark SCADA)
    const ambientLight = new THREE.AmbientLight(0x2a364f, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x93c5fd, 2.5);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x3b82f6, 1.5, 20);
    fillLight.position.set(-6, 4, 3);
    scene.add(fillLight);

    const beaconLight = new THREE.PointLight(0xff0044, 0, 15);
    beaconLight.position.set(0, 4.2, 0);
    scene.add(beaconLight);

    // 3. Industrial Floor Grid
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(30, 30, 0x1e293b, 0x0f172a);
    grid.position.y = -0.49;
    scene.add(grid);

    // 4. Stamping Press (%QX0.0)
    const colMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const colGeo = new THREE.BoxGeometry(0.4, 4.5, 0.4);

    const leftCol = new THREE.Mesh(colGeo, colMat);
    leftCol.position.set(-1.8, 1.75, 0);
    scene.add(leftCol);

    const rightCol = new THREE.Mesh(colGeo, colMat);
    rightCol.position.set(1.8, 1.75, 0);
    scene.add(rightCol);

    const crownGeo = new THREE.BoxGeometry(4.2, 0.8, 1.2);
    const crown = new THREE.Mesh(crownGeo, colMat);
    crown.position.set(0, 4.0, 0);
    scene.add(crown);

    const bolsterGeo = new THREE.BoxGeometry(3.6, 0.4, 1.2);
    const bolster = new THREE.Mesh(bolsterGeo, colMat);
    bolster.position.set(0, -0.3, 0);
    scene.add(bolster);

    // Moving Press Ram Head (%QX0.0)
    const ramGeo = new THREE.BoxGeometry(2.8, 0.7, 0.9);
    const ramMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x000000,
    });
    const pressRam = new THREE.Mesh(ramGeo, ramMat);
    pressRam.position.set(0, 3.0, 0);
    scene.add(pressRam);

    // 5. Robotic Transfer Arm (%QX0.1)
    const transferArm = new THREE.Group();
    const armBaseMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
    const armBaseGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.6, 16);
    const armBase = new THREE.Mesh(armBaseGeo, armBaseMat);
    armBase.position.set(-2.8, -0.2, 0);
    transferArm.add(armBase);

    const armBoomMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.5 });
    const armBoomGeo = new THREE.BoxGeometry(2.4, 0.2, 0.2);
    const armBoom = new THREE.Mesh(armBoomGeo, armBoomMat);
    armBoom.position.set(-1.5, 0.5, 0);
    transferArm.add(armBoom);

    const gripperMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const gripperGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
    const gripper = new THREE.Mesh(gripperGeo, gripperMat);
    gripper.position.set(-0.3, 0.5, 0);
    transferArm.add(gripper);

    scene.add(transferArm);

    // 6. Conveyor Belt (%QX0.2)
    const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const conveyorGeo = new THREE.BoxGeometry(1.2, 0.2, 4.0);
    const conveyorBelt = new THREE.Mesh(conveyorGeo, conveyorMat);
    conveyorBelt.position.set(0, -0.1, 2.2);
    scene.add(conveyorBelt);

    // 7. Diverter Clamp (%QX0.3)
    const clampJaws = new THREE.Group();
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    const jaw1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.4), jawMat);
    jaw1.position.set(-0.7, 0.1, 2.2);
    const jaw2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.4), jawMat);
    jaw2.position.set(0.7, 0.1, 2.2);
    clampJaws.add(jaw1);
    clampJaws.add(jaw2);
    scene.add(clampJaws);

    // 8. Auxiliary Solenoid Valve (%QX0.4)
    const valveGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12);
    const valveMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.8 });
    const pumpValve = new THREE.Mesh(valveGeo, valveMat);
    pumpValve.position.set(2.4, 0.1, 0);
    scene.add(pumpValve);

    // 9. Safety Light Curtain (%QX0.5 / %IX0.3)
    const curtainGeo = new THREE.PlaneGeometry(3.6, 2.5);
    const curtainMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const laserCurtain = new THREE.Mesh(curtainGeo, curtainMat);
    laserCurtain.position.set(0, 1.2, 0.7);
    scene.add(laserCurtain);

    // 10. Collision Spark Particles
    const sparkCount = 120;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount * 3; i += 3) {
      sparkPositions[i] = (Math.random() - 0.5) * 1.5;
      sparkPositions[i + 1] = 0.5 + (Math.random() - 0.5) * 0.8;
      sparkPositions[i + 2] = (Math.random() - 0.5) * 1.2;
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xff3b30,
      size: 0.12,
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
      sparkParticles,
    };

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Dynamic ResizeObserver
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || 600;
      const h = mountRef.current.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(mountRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.replaceChildren();
      }
    };
  }, []);

  // Update Camera View Angle
  useEffect(() => {
    if (!sceneRef.current) return;
    const { camera } = sceneRef.current;
    if (cameraView === "iso") {
      camera.position.set(0, 4.5, 9.5);
      camera.lookAt(0, 0.8, 0);
    } else if (cameraView === "die") {
      camera.position.set(0.6, 1.4, 3.8);
      camera.lookAt(0.2, 0.8, 0);
    } else if (cameraView === "top") {
      camera.position.set(0, 10.0, 0.1);
      camera.lookAt(0, 0, 0);
    }
  }, [cameraView]);

  // Update 3D Kinematics and WebAudio Triggers based on active ReplayFrame
  useEffect(() => {
    if (!sceneRef.current) return;
    const { pressRam, transferArm, conveyorBelt, clampJaws, pumpValve, laserCurtain, beaconLight, sparkParticles } = sceneRef.current;

    const outputs = currentFrame?.outputs || {};
    const isPressExtended = !!outputs["%QX0.0"];
    const isArmExtended = !!outputs["%QX0.1"];
    const isConveyorActive = !!outputs["%QX0.2"];
    const isClampActive = !!outputs["%QX0.3"];
    const isPumpActive = !!outputs["%QX0.4"];
    const isAlarmActive = !!outputs["%QX0.5"] || isCollision;

    // Kinematic Positions:
    pressRam.position.y = isPressExtended ? 0.45 : 3.0;
    transferArm.position.x = isArmExtended ? 1.6 : 0.0;
    conveyorBelt.scale.set(1, 1, isConveyorActive ? 1.05 : 1.0);
    clampJaws.scale.set(isClampActive ? 0.6 : 1.0, 1, isClampActive ? 0.6 : 1.0);
    (pumpValve.material as THREE.MeshStandardMaterial).emissive.setHex(isPumpActive ? 0x8b5cf6 : 0x000000);
    (laserCurtain.material as THREE.MeshBasicMaterial).opacity = isAlarmActive ? 0.65 : 0.15;
    beaconLight.intensity = isAlarmActive ? 3.5 : 0;

    // WebAudio Triggers
    if (audioRef.current) {
      // 1. Collision sound on impact frame
      if (isCollision && !prevCollisionRef.current) {
        audioRef.current.playCollisionSound();
      }
      // 2. Servo movement hum when ram or arm changes state
      const ramChanged = isPressExtended !== !!prevOutputsRef.current["%QX0.0"];
      const armChanged = isArmExtended !== !!prevOutputsRef.current["%QX0.1"];
      if ((ramChanged || armChanged) && !isCollision) {
        audioRef.current.playServoHum();
      }
    }
    prevCollisionRef.current = !!isCollision;
    prevOutputsRef.current = outputs;

    // Collision Detection Spark & Ram Glow
    if (isCollision || (isPressExtended && isArmExtended)) {
      (pressRam.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0022);
      (sparkParticles.material as THREE.PointsMaterial).opacity = 1.0;
      sparkParticles.rotation.y += 0.2;
    } else {
      (pressRam.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      (sparkParticles.material as THREE.PointsMaterial).opacity = 0.0;
    }
  }, [currentFrame, isCollision]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-lg overflow-hidden border border-slate-800 bg-[#090d16]">
      <div ref={mountRef} className="w-full h-full" />

      {/* Unified Compact HUD Bar (Non-overlapping across all viewports) */}
      <div className="absolute top-2.5 inset-x-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Left Status Pill */}
        <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded border border-slate-700/60 text-[11px] font-mono text-slate-300 flex items-center space-x-2 pointer-events-auto shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">3D DIGITAL TWIN • 6 ACTUATORS</span>
          <span className="sm:hidden">3D TWIN</span>
        </div>

        {/* Right Controls Pill: Audio + Camera Presets */}
        <div className="bg-black/80 backdrop-blur-md p-1 rounded border border-slate-700/60 text-[11px] font-mono flex items-center gap-1 pointer-events-auto shadow-md">
          {/* Audio Mute/Unmute Synthesizer Toggle */}
          <button
            onClick={toggleMute}
            className={`px-2 py-0.5 rounded border transition flex items-center space-x-1 ${
              isMuted
                ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                : "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
            }`}
            title="Toggle Industrial Audio Effects (WebAudio Synthesizer)"
          >
            <span>{isMuted ? "🔇 Audio" : "🔊 Audio"}</span>
          </button>

          <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />

          {/* Camera Views */}
          <button
            onClick={() => setCameraView("iso")}
            className={`px-2 py-0.5 rounded transition ${
              cameraView === "iso" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
            title="Isometric Global View"
          >
            Iso
          </button>
          <button
            onClick={() => setCameraView("die")}
            className={`px-2 py-0.5 rounded transition ${
              cameraView === "die" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
            title="Zoom Into Die Collision Zone"
          >
            Die Zoom
          </button>
          <button
            onClick={() => setCameraView("top")}
            className={`px-2 py-0.5 rounded transition ${
              cameraView === "top" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
            title="Top-Down Schematic View"
          >
            Top
          </button>
        </div>
      </div>

      {/* Collision Breach Banner */}
      {isCollision && (
        <div className="absolute inset-0 border-4 border-rose-500/80 pointer-events-none flex items-center justify-center">
          <div className="bg-rose-950/90 border border-rose-500 px-6 py-2.5 rounded shadow-2xl text-rose-100 font-mono font-bold tracking-wider text-sm animate-bounce">
            ⚠️ CRITICAL COLLISION: %QX0.0 PRESS & %QX0.1 ARM IN DIE ZONE
          </div>
        </div>
      )}
    </div>
  );
}
