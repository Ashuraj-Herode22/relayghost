import * as THREE from "three";
import { MachineInstance } from "./stampingPress";

export function buildRobotHandover(scene: THREE.Scene): MachineInstance {
  const root = new THREE.Group();
  root.name = "machine_robot_handover";

  // Materials
  const robotOrange = new THREE.MeshStandardMaterial({
    color: 0xea580c, // Industrial robot orange (KUKA/ABB style)
    metalness: 0.5,
    roughness: 0.35,
  });
  const robotTeal = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Industrial robot cyan/blue (Fanuc/Yaskawa style)
    metalness: 0.5,
    roughness: 0.35,
  });
  const castBase = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.4,
  });
  const chromeJoint = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.15,
  });
  const jawSteel = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.9,
    roughness: 0.25,
  });

  // 1. Shared Cell Base Floor Plate
  const cellBase = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 2.4), castBase);
  cellBase.position.set(0, 0.125, 0);
  root.add(cellBase);

  // Central Handover Fixture Tooling Nest (%QX0.2)
  const fixtureBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 24), castBase);
  fixtureBase.position.set(0, 0.55, 0);
  root.add(fixtureBase);

  const fixturePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), chromeJoint);
  fixturePlate.position.set(0, 0.89, 0);
  root.add(fixturePlate);

  // Precision part workpiece resting on nest
  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 })
  );
  workpiece.position.set(0, 0.98, 0);
  root.add(workpiece);

  // 2. Robot Alpha (Left, %QX0.0 / %QX0.1)
  const alphaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.4, 24), castBase);
  alphaBase.position.set(-1.5, 0.45, 0);
  root.add(alphaBase);

  const alphaArm = new THREE.Group();
  alphaArm.position.set(-1.5, 0.65, 0);

  const alphaLink1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), robotOrange);
  alphaLink1.position.set(0, 0.45, 0);
  alphaArm.add(alphaLink1);

  const alphaElbow = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), chromeJoint);
  alphaElbow.rotation.z = Math.PI / 2;
  alphaElbow.position.set(0, 0.9, 0);
  alphaArm.add(alphaElbow);

  const alphaForearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), robotOrange);
  alphaForearm.position.set(0.45, 1.25, 0);
  alphaForearm.rotation.z = -Math.PI / 4;
  alphaArm.add(alphaForearm);

  // Alpha Gripper (%QX0.1)
  const alphaGripperGroup = new THREE.Group();
  const alphaWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 16), chromeJoint);
  alphaWrist.rotation.z = Math.PI / 2;
  alphaGripperGroup.add(alphaWrist);

  const alphaJawL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.08), jawSteel);
  alphaJawL.position.set(0.12, 0.08, 0);
  alphaGripperGroup.add(alphaJawL);
  const alphaJawR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.08), jawSteel);
  alphaJawR.position.set(0.12, -0.08, 0);
  alphaGripperGroup.add(alphaJawR);

  alphaGripperGroup.position.set(0.9, 1.15, 0);
  alphaArm.add(alphaGripperGroup);
  root.add(alphaArm);

  // 3. Robot Beta (Right, %QX0.4 / %QX0.3)
  const betaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.4, 24), castBase);
  betaBase.position.set(1.5, 0.45, 0);
  root.add(betaBase);

  const betaArm = new THREE.Group();
  betaArm.position.set(1.5, 0.65, 0);

  const betaLink1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), robotTeal);
  betaLink1.position.set(0, 0.45, 0);
  betaArm.add(betaLink1);

  const betaElbow = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), chromeJoint);
  betaElbow.rotation.z = Math.PI / 2;
  betaElbow.position.set(0, 0.9, 0);
  betaArm.add(betaElbow);

  const betaForearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), robotTeal);
  betaForearm.position.set(-0.45, 1.25, 0);
  betaForearm.rotation.z = Math.PI / 4;
  betaArm.add(betaForearm);

  // Beta Gripper (%QX0.3)
  const betaGripperGroup = new THREE.Group();
  const betaWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 16), chromeJoint);
  betaWrist.rotation.z = Math.PI / 2;
  betaGripperGroup.add(betaWrist);

  const betaJawL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.08), jawSteel);
  betaJawL.position.set(-0.12, 0.08, 0);
  betaGripperGroup.add(betaJawL);
  const betaJawR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.08), jawSteel);
  betaJawR.position.set(-0.12, -0.08, 0);
  betaGripperGroup.add(betaJawR);

  betaGripperGroup.position.set(-0.9, 1.15, 0);
  betaArm.add(betaGripperGroup);
  root.add(betaArm);

  scene.add(root);

  const collisionPoint = new THREE.Vector3(0, 1.15, 0);

  let alphaReach = 0;
  let betaReach = 0;

  const updateKinematics = (
    outputs: Record<string, boolean>,
    dt: number,
    isCollision: boolean,
    isSafe: boolean
  ) => {
    // Robot Alpha extends forward when %QX0.1 is active
    const targetAlpha = outputs["%QX0.1"] ? (isCollision ? 0.6 : 0.4) : -0.2;
    // Robot Beta extends forward when %QX0.3 is active
    const targetBeta = outputs["%QX0.3"] ? (isCollision ? -0.6 : -0.4) : 0.2;

    const lerpFactor = Math.min(1.0, dt * 12.0);
    alphaReach = THREE.MathUtils.lerp(alphaReach, targetAlpha, lerpFactor);
    betaReach = THREE.MathUtils.lerp(betaReach, targetBeta, lerpFactor);

    alphaArm.position.x = -1.5 + alphaReach;
    betaArm.position.x = 1.5 + betaReach;

    // Table indexing when %QX0.2 is active
    if (outputs["%QX0.2"]) {
      fixturePlate.rotation.y += dt * 5.0;
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
