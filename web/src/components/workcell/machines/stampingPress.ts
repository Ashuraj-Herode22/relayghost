import * as THREE from "three";

export interface MachineInstance {
  root: THREE.Group;
  collisionPoint: THREE.Vector3;
  updateKinematics: (
    outputs: Record<string, boolean>,
    dt: number,
    isCollision: boolean,
    isSafe: boolean
  ) => void;
  dispose: () => void;
}

export function buildStampingPress(scene: THREE.Scene): MachineInstance {
  const root = new THREE.Group();
  root.name = "machine_stamping_press";

  // Materials
  const castIron = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    metalness: 0.85,
    roughness: 0.35,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.1,
  });
  const toolingSteel = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.9,
    roughness: 0.25,
  });
  const hazardAmber = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.3,
    roughness: 0.4,
  });
  const cautionYellow = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    metalness: 0.2,
    roughness: 0.5,
  });

  // 1. Massive 4-Post Heavy Frame
  const baseBolster = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.45, 2.4), castIron);
  baseBolster.position.set(0, 0.225, 0);
  baseBolster.castShadow = true;
  baseBolster.receiveShadow = true;
  root.add(baseBolster);

  // Lower Die Block with Cavity
  const lowerDie = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.4), toolingSteel);
  lowerDie.position.set(0, 0.625, 0);
  lowerDie.castShadow = true;
  root.add(lowerDie);

  // 4 Columns
  const columnGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 24);
  const colPositions = [
    [-1.5, 2.1, -0.9],
    [1.5, 2.1, -0.9],
    [-1.5, 2.1, 0.9],
    [1.5, 2.1, 0.9],
  ];
  colPositions.forEach(([x, y, z]) => {
    const col = new THREE.Mesh(columnGeo, chrome);
    col.position.set(x, y, z);
    col.castShadow = true;
    root.add(col);
  });

  // Top Crown / Hydraulic Header
  const crown = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.65, 2.4), castIron);
  crown.position.set(0, 4.3, 0);
  crown.castShadow = true;
  root.add(crown);

  // Hydraulic Cylinder
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.2, 32), castIron);
  cylinder.position.set(0, 3.65, 0);
  root.add(cylinder);

  // Piston Rod
  const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 32), chrome);
  pistonRod.position.set(0, 2.8, 0);
  root.add(pistonRod);

  // 2. Actuator %QX0.0: Moving Press Ram
  const ramGroup = new THREE.Group();
  const ramBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 1.45), castIron);
  ramBody.castShadow = true;
  ramGroup.add(ramBody);

  const upperDie = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.2), toolingSteel);
  upperDie.position.set(0, -0.4, 0);
  upperDie.castShadow = true;
  ramGroup.add(upperDie);

  // Warning stripes on ram side
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 0.05), hazardAmber);
  stripe.position.set(0, 0, 0.73);
  ramGroup.add(stripe);

  ramGroup.position.set(0, 2.9, 0); // Extended: 0.95, Retracted: 2.9
  root.add(ramGroup);

  // 3. Actuator %QX0.1: Pneumatic Feeder / Transfer Arm
  const armGroup = new THREE.Group();
  const armBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.4), castIron);
  armBase.position.set(-2.4, 0.45, 0);
  armGroup.add(armBase);

  const armPistonRail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 16), chrome);
  armPistonRail.rotation.z = Math.PI / 2;
  armPistonRail.position.set(-1.3, 0.8, 0);
  armGroup.add(armPistonRail);

  const gripperHead = new THREE.Group();
  const gripperBar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.4), cautionYellow);
  gripperHead.add(gripperBar);

  // Dual vacuum cups
  const cupGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16);
  const cupMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const cup1 = new THREE.Mesh(cupGeo, cupMat);
  cup1.position.set(-0.2, -0.1, 0);
  gripperHead.add(cup1);
  const cup2 = new THREE.Mesh(cupGeo, cupMat);
  cup2.position.set(0.2, -0.1, 0);
  gripperHead.add(cup2);

  // Metal Sheet Blank held by gripper
  const blankSheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.03, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
  );
  blankSheet.position.set(0, -0.17, 0);
  gripperHead.add(blankSheet);

  gripperHead.position.set(-1.8, 0.8, 0); // Extended inside die: 0.0, Retracted: -1.8
  armGroup.add(gripperHead);
  root.add(armGroup);

  // 4. Actuator %QX0.2: Infeed Conveyor
  const conveyorGroup = new THREE.Group();
  const conveyorBed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 0.7), castIron);
  conveyorBed.position.set(-3.2, 0.725, 0);
  conveyorGroup.add(conveyorBed);
  const beltMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.96, 0.02, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
  );
  beltMesh.position.set(-3.2, 0.81, 0);
  conveyorGroup.add(beltMesh);
  root.add(conveyorGroup);

  // 5. Actuator %QX0.3: Centering Clamps
  const clampL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.3), chrome);
  clampL.position.set(-0.85, 0.85, 0);
  root.add(clampL);
  const clampR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.3), chrome);
  clampR.position.set(0.85, 0.85, 0);
  root.add(clampR);

  // 6. Actuator %QX0.4: Hydraulic Pump & Relief Manifold
  const pumpGroup = new THREE.Group();
  const pumpCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.6, 24), castIron);
  pumpCasing.position.set(2.4, 0.5, -0.8);
  pumpGroup.add(pumpCasing);
  const pumpMotor = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6 })
  );
  pumpMotor.position.set(2.4, 0.9, -0.8);
  pumpGroup.add(pumpMotor);
  root.add(pumpGroup);

  // 7. Actuator %QX0.5: Optical Safety Light Curtain
  const laserTowerL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), hazardAmber);
  laserTowerL.position.set(-1.1, 1.4, 1.05);
  root.add(laserTowerL);
  const laserTowerR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), hazardAmber);
  laserTowerR.position.set(1.1, 1.4, 1.05);
  root.add(laserTowerR);

  const laserBeamsMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.35,
  });
  const laserBeams = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.6), laserBeamsMat);
  laserBeams.position.set(0, 1.4, 1.05);
  root.add(laserBeams);

  scene.add(root);

  const collisionPoint = new THREE.Vector3(0, 0.8, 0);

  // Kinematics state tracking for 120 FPS continuous interpolation
  let currentRamY = 2.9;
  let currentArmX = -1.8;
  let clampOffset = 0.85;

  const updateKinematics = (
    outputs: Record<string, boolean>,
    dt: number,
    isCollision: boolean,
    isSafe: boolean
  ) => {
    // Target positions
    const targetRamY = outputs["%QX0.0"] ? (isCollision ? 0.95 : 1.1) : 2.9;
    const targetArmX = outputs["%QX0.1"] ? 0.0 : -1.8;
    const targetClamp = outputs["%QX0.3"] ? 0.6 : 0.85;

    // 120 FPS mass-spring continuous lerp
    const lerpFactor = Math.min(1.0, dt * 14.0);
    currentRamY = THREE.MathUtils.lerp(currentRamY, targetRamY, lerpFactor);
    currentArmX = THREE.MathUtils.lerp(currentArmX, targetArmX, lerpFactor);
    clampOffset = THREE.MathUtils.lerp(clampOffset, targetClamp, lerpFactor);

    ramGroup.position.y = currentRamY;
    pistonRod.scale.y = Math.max(0.2, (4.3 - currentRamY) / 1.5);
    pistonRod.position.y = 4.3 - (pistonRod.scale.y * 1.5) / 2;

    gripperHead.position.x = currentArmX;

    clampL.position.x = -clampOffset;
    clampR.position.x = clampOffset;

    // Conveyor pulse
    if (outputs["%QX0.2"]) {
      beltMesh.position.x = -3.2 + ((Date.now() * 0.001) % 0.1);
    }

    // Pump vibration
    if (outputs["%QX0.4"]) {
      pumpCasing.rotation.y += dt * 18.0;
    }

    // Safety laser pulse
    if (isCollision) {
      laserBeamsMat.color.setHex(0xef4444);
      laserBeamsMat.opacity = 0.6 + Math.sin(Date.now() * 0.02) * 0.3;
    } else if (isSafe) {
      laserBeamsMat.color.setHex(0x10b981);
      laserBeamsMat.opacity = 0.25;
    } else {
      laserBeamsMat.color.setHex(0xf59e0b);
      laserBeamsMat.opacity = 0.3;
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
