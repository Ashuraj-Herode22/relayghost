import * as THREE from "three";
import { MachineInstance } from "./stampingPress";

export function buildBottleFiller(scene: THREE.Scene): MachineInstance {
  const root = new THREE.Group();
  root.name = "machine_bottle_filler";

  // Materials
  const stainlessSteel = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 0.92,
    roughness: 0.18,
  });
  const darkSanitaryBase = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.8,
    roughness: 0.3,
  });
  const glassBottleMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706, // Amber glass
    metalness: 0.1,
    roughness: 0.15,
    transmission: 0.7,
    transparent: true,
    opacity: 0.85,
    ior: 1.52,
  });
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    metalness: 0.2,
    roughness: 0.1,
  });
  const nozzleChrome = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.98,
    roughness: 0.08,
  });
  const polycarbShield = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    transmission: 0.9,
    transparent: true,
    opacity: 0.25,
    roughness: 0.05,
  });

  // 1. Sanitary Base Table
  const tableBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 2.4), darkSanitaryBase);
  tableBase.position.set(0, 0.3, 0);
  tableBase.castShadow = true;
  tableBase.receiveShadow = true;
  root.add(tableBase);

  // Table Top Plate
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.08, 2.45), stainlessSteel);
  topPlate.position.set(0, 0.64, 0);
  root.add(topPlate);

  // Transparent Polycarbonate Splash Shield
  const shield = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.05), polycarbShield);
  shield.position.set(0, 1.55, 1.15);
  root.add(shield);

  // 2. Linear Infeed Conveyor Track (%QX0.2)
  const conveyorGroup = new THREE.Group();
  const conveyorBed = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.4), stainlessSteel);
  conveyorBed.position.set(0, 0.72, 0.7);
  conveyorGroup.add(conveyorBed);

  const guideRailL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.03), nozzleChrome);
  guideRailL.position.set(0, 0.85, 0.52);
  conveyorGroup.add(guideRailL);
  const guideRailR = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.03), nozzleChrome);
  guideRailR.position.set(0, 0.85, 0.88);
  conveyorGroup.add(guideRailR);
  root.add(conveyorGroup);

  // 3. Actuator %QX0.1: Rotary Indexing Starwheel Carousel
  const starwheelGroup = new THREE.Group();
  starwheelGroup.position.set(0, 0.78, 0);

  // Center hub & dial plate
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 32), stainlessSteel);
  starwheelGroup.add(hub);
  const dialPlate = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.05, 32), stainlessSteel);
  dialPlate.position.y = 0.05;
  starwheelGroup.add(dialPlate);

  // 6 Scalloped Bottle Pockets with Glass Bottles
  const numPockets = 6;
  const radius = 0.75;
  const bottles: THREE.Group[] = [];

  for (let i = 0; i < numPockets; i++) {
    const angle = (i * Math.PI * 2) / numPockets;
    const bGroup = new THREE.Group();
    bGroup.position.set(Math.cos(angle) * radius, 0.28, Math.sin(angle) * radius);

    // Glass Bottle Body
    const bottleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 24), glassBottleMat);
    bottleBody.castShadow = true;
    bGroup.add(bottleBody);

    // Bottle Neck
    const bottleNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, 0.18, 16), glassBottleMat);
    bottleNeck.position.y = 0.3;
    bGroup.add(bottleNeck);

    // Liquid fill inside bottle
    const liquidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 16), liquidMat);
    liquidMesh.position.y = -0.05;
    bGroup.add(liquidMesh);

    starwheelGroup.add(bGroup);
    bottles.push(bGroup);
  }
  root.add(starwheelGroup);

  // 4. Overhead Filling Column & Actuator %QX0.0 (Vertical Filling Head)
  const gantryPillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.28), stainlessSteel);
  gantryPillar.position.set(0, 1.9, -0.75);
  root.add(gantryPillar);

  const overheadBoom = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 1.6), stainlessSteel);
  overheadBoom.position.set(0, 3.1, 0);
  root.add(overheadBoom);

  // Moving Filling Head Carriage (%QX0.0)
  const fillingHeadGroup = new THREE.Group();
  const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.35), stainlessSteel);
  manifold.castShadow = true;
  fillingHeadGroup.add(manifold);

  // Dual Stainless Filling Nozzles
  const nozzle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.55, 16), nozzleChrome);
  nozzle1.position.set(-0.12, -0.32, 0);
  fillingHeadGroup.add(nozzle1);
  const nozzle2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.55, 16), nozzleChrome);
  nozzle2.position.set(0.12, -0.32, 0);
  fillingHeadGroup.add(nozzle2);

  // Flexible sanitary tubes
  const tube1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 12), nozzleChrome);
  tube1.position.set(-0.12, 0.35, 0);
  fillingHeadGroup.add(tube1);

  fillingHeadGroup.position.set(0, 2.5, 0.7); // Raised: 2.5, Lowered into bottle: 1.32
  root.add(fillingHeadGroup);

  // 5. Actuator %QX0.3: Radial Reject / Diversion Arm
  const rejectArmGroup = new THREE.Group();
  const rejectPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16), stainlessSteel);
  rejectArmGroup.add(rejectPivot);
  const rejectBlade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.04), nozzleChrome);
  rejectBlade.position.set(0.32, 0, 0);
  rejectArmGroup.add(rejectBlade);

  rejectArmGroup.position.set(1.2, 0.88, 0.7);
  rejectArmGroup.rotation.y = -Math.PI / 4; // Clear: -45 deg, Diverting: +25 deg
  root.add(rejectArmGroup);

  // 6. Actuator %QX0.4: Rotary Capping Spindle
  const capperSpindle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.45, 24), nozzleChrome);
  capperSpindle.position.set(-0.6, 2.0, 0);
  root.add(capperSpindle);

  // 7. Actuator %QX0.5: Optical Safety Beacon
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16), stainlessSteel);
  beaconBase.position.set(0, 3.3, 0);
  root.add(beaconBase);
  const beaconDomeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const beaconDome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), beaconDomeMat);
  beaconDome.position.set(0, 3.42, 0);
  root.add(beaconDome);

  scene.add(root);

  const collisionPoint = new THREE.Vector3(0, 1.25, 0.7);

  // 120 FPS kinematics interpolation state
  let currentHeadY = 2.5;
  let currentStarwheelRot = 0;
  let targetStarwheelRot = 0;
  let currentRejectRot = -Math.PI / 4;

  const updateKinematics = (
    outputs: Record<string, boolean>,
    dt: number,
    isCollision: boolean,
    isSafe: boolean
  ) => {
    // Filling Head Target
    const targetHeadY = outputs["%QX0.0"] ? (isCollision ? 1.25 : 1.35) : 2.5;

    // Starwheel indexing: advances when %QX0.1 is active
    if (outputs["%QX0.1"]) {
      targetStarwheelRot += dt * (isCollision ? 4.8 : 2.5);
    }

    // Reject Arm
    const targetReject = outputs["%QX0.3"] ? Math.PI / 6 : -Math.PI / 4;

    const lerpFactor = Math.min(1.0, dt * 14.0);
    currentHeadY = THREE.MathUtils.lerp(currentHeadY, targetHeadY, lerpFactor);
    currentStarwheelRot = THREE.MathUtils.lerp(currentStarwheelRot, targetStarwheelRot, lerpFactor);
    currentRejectRot = THREE.MathUtils.lerp(currentRejectRot, targetReject, lerpFactor);

    fillingHeadGroup.position.y = currentHeadY;
    starwheelGroup.rotation.y = currentStarwheelRot;
    rejectArmGroup.rotation.y = currentRejectRot;

    // Capper rotation when %QX0.4 active
    if (outputs["%QX0.4"]) {
      capperSpindle.rotation.y += dt * 25.0;
    }

    // Beacon state
    if (isCollision) {
      beaconDomeMat.color.setHex(0xef4444);
    } else if (isSafe) {
      beaconDomeMat.color.setHex(0x10b981);
    } else {
      beaconDomeMat.color.setHex(0xf59e0b);
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
