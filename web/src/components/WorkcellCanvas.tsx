"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ReplayFrame } from "@/lib/plcVerifier";

interface WorkcellCanvasProps {
  currentFrame?: ReplayFrame;
  isCollision?: boolean;
}

export default function WorkcellCanvas({ currentFrame, isCollision }: WorkcellCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraView, setCameraView] = useState<"iso" | "die" | "top">("iso");

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
    pressRam.position.set(0, 3.0, 0); // Extended at 0.45, Retracted at 3.0
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

  // Update 3D Kinematics based on active ReplayFrame
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
    // %QX0.0 Press Ram: Down at Y=0.45 when True, Up at Y=3.0 when False
    pressRam.position.y = isPressExtended ? 0.45 : 3.0;

    // %QX0.1 Transfer Arm: Extended at X=1.6 into die when True, Retracted at X=0 when False
    transferArm.position.x = isArmExtended ? 1.6 : 0.0;

    // %QX0.2 Conveyor
    conveyorBelt.scale.set(1, 1, isConveyorActive ? 1.05 : 1.0);

    // %QX0.3 Clamp Jaws
    clampJaws.scale.set(isClampActive ? 0.6 : 1.0, 1, isClampActive ? 0.6 : 1.0);

    // %QX0.4 Pump Solenoid
    (pumpValve.material as THREE.MeshStandardMaterial).emissive.setHex(isPumpActive ? 0x8b5cf6 : 0x000000);

    // %QX0.5 Safety Curtain & Beacon
    (laserCurtain.material as THREE.MeshBasicMaterial).opacity = isAlarmActive ? 0.65 : 0.15;
    beaconLight.intensity = isAlarmActive ? 3.5 : 0;

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

      {/* 3D HUD Overlay Left */}
      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded border border-slate-700/60 text-xs font-mono text-slate-300 pointer-events-none flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>3D DIGITAL TWIN • 6 UNIVERSAL ACTUATORS</span>
      </div>

      {/* 3D Camera Controls Right */}
      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md p-1 rounded border border-slate-700/60 text-[11px] font-mono flex items-center space-x-1 z-10">
        <button
          onClick={() => setCameraView("iso")}
          className={`px-2 py-0.5 rounded transition ${
            cameraView === "iso" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
          }`}
          title="Isometric Global View"
        >
          Isometric
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
          Top View
        </button>
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
