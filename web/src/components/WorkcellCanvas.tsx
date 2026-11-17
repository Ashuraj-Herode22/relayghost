"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { ReplayFrame } from "@/lib/plcVerifier";

interface WorkcellCanvasProps {
  currentFrame?: ReplayFrame;
  isCollision?: boolean;
}

export default function WorkcellCanvas({ currentFrame, isCollision }: WorkcellCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
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

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

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
    // Frame Columns
    const colMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const colGeo = new THREE.BoxGeometry(0.4, 4.5, 0.4);

    const leftCol = new THREE.Mesh(colGeo, colMat);
    leftCol.position.set(-1.8, 1.75, 0);
    scene.add(leftCol);

    const rightCol = new THREE.Mesh(colGeo, colMat);
    rightCol.position.set(1.8, 1.75, 0);
    scene.add(rightCol);

    // Top Crown
    const crownGeo = new THREE.BoxGeometry(4.2, 0.8, 1.2);
    const crown = new THREE.Mesh(crownGeo, colMat);
    crown.position.set(0, 4.0, 0);
    scene.add(crown);

    // Bed / Die Base
    const bedGeo = new THREE.BoxGeometry(3.6, 0.6, 2.0);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, -0.2, 0);
    scene.add(bed);

    // Moving Press Ram (%QX0.0)
    const ramGeo = new THREE.BoxGeometry(2.4, 0.8, 1.4);
    const ramMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x000000,
    });
    const pressRam = new THREE.Mesh(ramGeo, ramMat);
    pressRam.position.set(0, 3.0, 0); // Up position
    scene.add(pressRam);

    // 5. Robotic Transfer Arm (%QX0.1)
    const transferArm = new THREE.Group();
    const armBaseGeo = new THREE.BoxGeometry(0.8, 0.5, 0.8);
    const armBase = new THREE.Mesh(armBaseGeo, new THREE.MeshStandardMaterial({ color: 0x2563eb }));
    armBase.position.set(-3.5, -0.1, 0);
    transferArm.add(armBase);

    const armRailGeo = new THREE.BoxGeometry(2.8, 0.15, 0.2);
    const armRail = new THREE.Mesh(armRailGeo, new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 }));
    armRail.position.set(-2.0, 0.2, 0);
    transferArm.add(armRail);

    // Gripper head
    const gripperGeo = new THREE.BoxGeometry(0.6, 0.25, 0.6);
    const gripper = new THREE.Mesh(gripperGeo, new THREE.MeshStandardMaterial({ color: 0x10b981 }));
    gripper.position.set(-0.6, 0.2, 0);
    transferArm.add(gripper);
    scene.add(transferArm);

    // 6. Infeed Conveyor (%QX0.2)
    const conveyorGeo = new THREE.BoxGeometry(1.6, 0.3, 4.0);
    const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const conveyorBelt = new THREE.Mesh(conveyorGeo, conveyorMat);
    conveyorBelt.position.set(3.2, -0.35, 0);
    scene.add(conveyorBelt);

    // 7. Clamping Fixture (%QX0.3)
    const clampJaws = new THREE.Group();
    const jawGeo = new THREE.BoxGeometry(0.2, 0.4, 0.8);
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8 });
    const jawA = new THREE.Mesh(jawGeo, jawMat);
    jawA.position.set(-0.8, 0.3, 0.5);
    const jawB = new THREE.Mesh(jawGeo, jawMat);
    jawB.position.set(-0.8, 0.3, -0.5);
    clampJaws.add(jawA);
    clampJaws.add(jawB);
    scene.add(clampJaws);

    // 8. Pump / Valve (%QX0.4)
    const pumpGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.9 });
    const pumpValve = new THREE.Mesh(pumpGeo, pumpMat);
    pumpValve.position.set(-2.2, 3.8, 0.6);
    scene.add(pumpValve);

    // 9. Red Safety Laser Curtain (%QX0.5)
    const laserGeo = new THREE.PlaneGeometry(2.6, 2.5);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const laserCurtain = new THREE.Mesh(laserGeo, laserMat);
    laserCurtain.position.set(0, 1.4, 0.85);
    scene.add(laserCurtain);

    // 10. Collision Spark Particle Burst
    const sparkCount = 150;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount * 3; i++) {
      sparkPositions[i] = (Math.random() - 0.5) * 0.2;
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffdd00,
      size: 0.08,
      transparent: true,
      opacity: 0,
    });
    const sparkParticles = new THREE.Points(sparkGeo, sparkMat);
    sparkParticles.position.set(0, 0.5, 0);
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

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

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
    // %QX0.0 Press Ram: Down at Y=0.5 when True, Up at Y=3.0 when False
    pressRam.position.y = isPressExtended ? 0.45 : 3.0;

    // %QX0.1 Transfer Arm: Extended at X=1.6 into die when True, Retracted at X=0 when False
    transferArm.position.x = isArmExtended ? 1.6 : 0.0;

    // %QX0.2 Conveyor
    conveyorBelt.scale.set(1, 1, isConveyorActive ? 1.05 : 1.0);

    // %QX0.3 Clamp Jaws: Pinched inwards when True
    clampJaws.scale.set(isClampActive ? 0.6 : 1.0, 1, isClampActive ? 0.6 : 1.0);

    // %QX0.4 Pump Solenoid: Bright violet glow when True
    (pumpValve.material as THREE.MeshStandardMaterial).emissive.setHex(isPumpActive ? 0x8b5cf6 : 0x000000);

    // %QX0.5 Safety Curtain & Beacon
    laserCurtain.visible = true;
    (laserCurtain.material as THREE.MeshBasicMaterial).opacity = isAlarmActive ? 0.65 : 0.2;
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
    <div className="relative w-full h-full min-h-[380px] rounded-lg overflow-hidden scada-border bg-[#090d16]">
      <div ref={mountRef} className="w-full h-full" />
      {/* 3D HUD Overlay */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border border-slate-700/60 text-xs font-mono text-slate-300 pointer-events-none flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>3D DIGITAL TWIN • 6 UNIVERSAL ACTUATORS</span>
      </div>
      {isCollision && (
        <div className="absolute inset-0 border-4 border-red-500/80 pointer-events-none pulse-hazard flex items-center justify-center">
          <div className="bg-red-950/90 border border-red-500 px-6 py-2 rounded shadow-2xl text-red-100 font-mono font-bold tracking-wider text-sm animate-bounce">
            ⚠️ CRITICAL COLLISION: %QX0.0 PRESS & %QX0.1 ARM IN DIE ZONE
          </div>
        </div>
      )}
    </div>
  );
}
