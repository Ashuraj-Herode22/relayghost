import * as THREE from "three";
import { MachineInstance } from "./stampingPress";

export function buildConveyorDiverter(scene: THREE.Scene): MachineInstance {
  const root = new THREE.Group();
  root.name = "machine_conveyor_diverter";

  // Materials
  const anodizedSteel = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.85,
    roughness: 0.3,
  });
  const chromeRoller = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.12,
  });
  const gateBladeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // High visibility amber
    metalness: 0.4,
    roughness: 0.3,
  });
  const boxCardboard = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.05,
    roughness: 0.85,
  });
  const pneumaticPiston = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Industrial blue
    metalness: 0.6,
    roughness: 0.3,
  });

  // 1. Conveyor Leg Stands & Side Rails
  const stand1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 1.8), anodizedSteel);
  stand1.position.set(-1.8, 0.35, 0);
  root.add(stand1);
  const stand2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 1.8), anodizedSteel);
  stand2.position.set(1.8, 0.35, 0);
  root.add(stand2);

  const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 0.06), anodizedSteel);
  sideRailL.position.set(0, 0.78, -0.9);
  root.add(sideRailL);
  const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 0.06), anodizedSteel);
  sideRailR.position.set(0, 0.78, 0.9);
  root.add(sideRailR);

  // 2. Actuator %QX0.2: Roller Bed (18 rotating steel rollers)
  const rollers: THREE.Mesh[] = [];
  const rollerGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.72, 16);
  rollerGeo.rotateX(Math.PI / 2);

  for (let i = 0; i < 18; i++) {
    const x = -1.7 + (i / 17) * 3.4;
    const r = new THREE.Mesh(rollerGeo, chromeRoller);
    r.position.set(x, 0.76, 0);
    r.castShadow = true;
    root.add(r);
    rollers.push(r);
  }

  // 3. Actuator %QX0.0: Transverse Pusher Ram (Pneumatic Cylinder + Ram Plate)
  const pusherGroup = new THREE.Group();
  const pusherCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16), pneumaticPiston);
  pusherCylinder.rotation.x = Math.PI / 2;
  pusherCylinder.position.set(0, 0.88, -1.25);
  pusherGroup.add(pusherCylinder);

  const pusherRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 16), chromeRoller);
  pusherRod.rotation.x = Math.PI / 2;
  pusherRod.position.set(0, 0.88, -0.75);
  pusherGroup.add(pusherRod);

  const pusherFace = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.05), gateBladeMat);
  pusherFace.position.set(0, 0.88, -0.65);
  pusherGroup.add(pusherFace);
  root.add(pusherGroup);

  // 4. Actuator %QX0.1: Infeed Metering Arm
  const infeedArmGroup = new THREE.Group();
  const infeedBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), anodizedSteel);
  infeedBase.position.set(-1.2, 0.9, 0.7);
  infeedArmGroup.add(infeedBase);

  const infeedBlade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 0.04), gateBladeMat);
  infeedBlade.position.set(-0.9, 0.92, 0.35);
  infeedBlade.rotation.y = -Math.PI / 4;
  infeedArmGroup.add(infeedBlade);
  root.add(infeedArmGroup);

  // 5. Actuator %QX0.3: High-Speed Diverter Gate Blade
  const gateGroup = new THREE.Group();
  const gatePost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 16), anodizedSteel);
  gateGroup.add(gatePost);

  const gateBlade = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 0.04), gateBladeMat);
  gateBlade.position.set(0.55, 0, 0);
  gateBlade.castShadow = true;
  gateGroup.add(gateBlade);

  // Rubber impact edge
  const rubberEdge = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.06, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 })
  );
  rubberEdge.position.set(0.55, -0.09, 0);
  gateGroup.add(rubberEdge);

  gateGroup.position.set(0.2, 0.92, -0.7);
  gateGroup.rotation.y = 0; // Aligned: 0, Diverting across lane: Math.PI / 3 (60 deg)
  root.add(gateGroup);

  // 6. Actuator %QX0.4: Discharge Chute Roller
  const chuteGroup = new THREE.Group();
  const chuteFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 1.2), anodizedSteel);
  chuteFrame.position.set(1.4, 0.65, 1.2);
  chuteFrame.rotation.x = Math.PI / 10;
  chuteGroup.add(chuteFrame);
  root.add(chuteGroup);

  // 7. Shipping Boxes on Conveyor
  const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.45), boxCardboard);
  box1.position.set(-0.5, 0.98, 0);
  box1.castShadow = true;
  root.add(box1);

  // 8. Actuator %QX0.5: Jam Detection Curtain
  const sensorEmitter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), gateBladeMat);
  sensorEmitter.position.set(0.3, 1.05, -0.92);
  root.add(sensorEmitter);
  const sensorReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), gateBladeMat);
  sensorReceiver.position.set(0.3, 1.05, 0.92);
  root.add(sensorReceiver);

  const laserBeamMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.4 });
  const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.84, 8), laserBeamMat);
  laserBeam.rotation.x = Math.PI / 2;
  laserBeam.position.set(0.3, 1.05, 0);
  root.add(laserBeam);

  scene.add(root);

  const collisionPoint = new THREE.Vector3(0.3, 0.95, 0.0);

  // 120 FPS kinematics interpolation state
  let currentPusherZ = -0.65;
  let currentGateRot = 0;
  let currentInfeedRot = -Math.PI / 4;
  let boxX = -0.5;

  const updateKinematics = (
    outputs: Record<string, boolean>,
    dt: number,
    isCollision: boolean,
    isSafe: boolean
  ) => {
    // Pusher target
    const targetPusherZ = outputs["%QX0.0"] ? (isCollision ? 0.0 : -0.15) : -0.65;

    // Diverter Gate target: swings 55 degrees across track
    const targetGate = outputs["%QX0.3"] ? (isCollision ? Math.PI / 3.2 : Math.PI / 3.6) : 0.0;

    // Infeed Arm target
    const targetInfeed = outputs["%QX0.1"] ? 0.0 : -Math.PI / 4;

    const lerpFactor = Math.min(1.0, dt * 14.0);
    currentPusherZ = THREE.MathUtils.lerp(currentPusherZ, targetPusherZ, lerpFactor);
    currentGateRot = THREE.MathUtils.lerp(currentGateRot, targetGate, lerpFactor);
    currentInfeedRot = THREE.MathUtils.lerp(currentInfeedRot, targetInfeed, lerpFactor);

    pusherFace.position.z = currentPusherZ;
    pusherRod.position.z = currentPusherZ - 0.1;
    gateGroup.rotation.y = currentGateRot;
    infeedArmGroup.rotation.y = currentInfeedRot;

    // Rollers continuous spin when conveyor %QX0.2 is active
    if (outputs["%QX0.2"] || !isCollision) {
      for (const r of rollers) {
        r.rotation.x += dt * 12.0;
      }
      boxX += dt * 0.4;
      if (boxX > 1.2) boxX = -1.2;
      box1.position.x = boxX;
    }

    if (isCollision) {
      laserBeamMat.color.setHex(0xef4444);
      laserBeamMat.opacity = 0.8 + Math.sin(Date.now() * 0.03) * 0.2;
    } else if (isSafe) {
      laserBeamMat.color.setHex(0x10b981);
      laserBeamMat.opacity = 0.3;
    } else {
      laserBeamMat.color.setHex(0xf59e0b);
      laserBeamMat.opacity = 0.4;
    }
  };

  const dispose = () => {
    scene.remove(root);
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  };

  return { root, collisionPoint, updateKinematics, dispose };
}
