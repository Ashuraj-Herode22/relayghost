import * as THREE from "three";
import { MachineInstance } from "./stampingPress";

export function buildMotorBridge(scene: THREE.Scene): MachineInstance {
  const root = new THREE.Group();
  root.name = "machine_motor_bridge";

  // Materials
  const enclosureGray = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.75,
    roughness: 0.45,
  });
  const copperBusbar = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    metalness: 0.95,
    roughness: 0.2,
  });
  const contactSilver = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.98,
    roughness: 0.1,
  });
  const motorBlue = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    metalness: 0.8,
    roughness: 0.35,
  });
  const contactorBody = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.7,
  });
  const indicatorAmber = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.2,
  });

  // 1. Heavy Equipment Base Skid
  const skid = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 2.4), enclosureGray);
  skid.position.set(0, 0.15, 0);
  root.add(skid);

  // 2. High-Voltage Control Cabinet (Open Front to view contactors)
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.8), enclosureGray);
  cabinet.position.set(-0.6, 1.5, -0.6);
  root.add(cabinet);

  // 3-Phase Copper Busbars (L1, L2, L3)
  for (let i = 0; i < 3; i++) {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.03), copperBusbar);
    bus.position.set(-0.6, 2.2 - i * 0.18, -0.22);
    root.add(bus);
  }

  // 3. Actuator %QX0.0: Forward Contactor K1 (Left)
  const contactorK1 = new THREE.Group();
  const k1Housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.45), contactorBody);
  contactorK1.add(k1Housing);

  // Moving Plunger Armature
  const k1Plunger = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.2), contactSilver);
  k1Plunger.position.set(0, 0, 0.18);
  contactorK1.add(k1Plunger);

  // Nameplate K1
  const k1Plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.02), indicatorAmber);
  k1Plate.position.set(0, 0.25, 0.24);
  contactorK1.add(k1Plate);

  contactorK1.position.set(-1.0, 1.5, -0.2);
  root.add(contactorK1);

  // 4. Actuator %QX0.4: Reverse Contactor K2 (Right)
  const contactorK2 = new THREE.Group();
  const k2Housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.45), contactorBody);
  contactorK2.add(k2Housing);

  // Moving Plunger Armature
  const k2Plunger = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.2), contactSilver);
  k2Plunger.position.set(0, 0, 0.18);
  contactorK2.add(k2Plunger);

  // Nameplate K2
  const k2Plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.02), indicatorAmber);
  k2Plate.position.set(0, 0.25, 0.24);
  contactorK2.add(k2Plate);

  contactorK2.position.set(-0.2, 1.5, -0.2);
  root.add(contactorK2);

  // 5. Heavy 50 HP 3-Phase AC Induction Motor with Cooling Fins
  const motorGroup = new THREE.Group();
  const motorStator = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.3, 32), motorBlue);
  motorStator.rotation.z = Math.PI / 2;
  motorStator.position.set(1.1, 0.78, 0.2);
  motorStator.castShadow = true;
  motorGroup.add(motorStator);

  // Stator Cooling Ribs
  for (let i = 0; i < 8; i++) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.04, 32), motorBlue);
    rib.rotation.z = Math.PI / 2;
    rib.position.set(0.6 + i * 0.14, 0.78, 0.2);
    motorGroup.add(rib);
  }

  // Motor Terminal Conduit Box
  const terminalBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), enclosureGray);
  terminalBox.position.set(1.1, 1.3, 0.2);
  motorGroup.add(terminalBox);

  // Actuator %QX0.1: Motor Drive Shaft & Coupling
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 24), contactSilver);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(1.9, 0.78, 0.2);
  motorGroup.add(shaft);

  // Flexible Torque Coupling
  const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 24), copperBusbar);
  coupling.rotation.z = Math.PI / 2;
  coupling.position.set(2.0, 0.78, 0.2);
  motorGroup.add(coupling);
  root.add(motorGroup);

  // 6. Actuator %QX0.3: Hydraulic Brake & Pressure Relief Valve
  const reliefManifold = new THREE.Group();
  const valveBlock = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), contactSilver);
  valveBlock.position.set(1.1, 0.5, 0.9);
  reliefManifold.add(valveBlock);

  const pressureGauge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 24), contactSilver);
  pressureGauge.position.set(1.1, 0.85, 0.9);
  reliefManifold.add(pressureGauge);
  root.add(reliefManifold);

  // 7. Arc-Flash Point Light (Explodes in blue/white on collision)
  const arcLight = new THREE.PointLight(0x60a5fa, 0, 8.0);
  arcLight.position.set(-0.6, 1.55, 0.1);
  root.add(arcLight);

  scene.add(root);

  const collisionPoint = new THREE.Vector3(-0.6, 1.55, 0.1);

  let k1PlungerZ = 0.18;
  let k2PlungerZ = 0.18;
  let shaftRotation = 0;

  const updateKinematics = (
    outputs: Record<string, boolean>,
    dt: number,
    isCollision: boolean,
    isSafe: boolean
  ) => {
    // Plungers pull in (Z moves back into coil) when contactors energize
    const targetK1 = outputs["%QX0.0"] ? 0.05 : 0.18;
    const targetK2 = outputs["%QX0.4"] ? 0.05 : 0.18;

    const lerpFactor = Math.min(1.0, dt * 25.0);
    k1PlungerZ = THREE.MathUtils.lerp(k1PlungerZ, targetK1, lerpFactor);
    k2PlungerZ = THREE.MathUtils.lerp(k2PlungerZ, targetK2, lerpFactor);

    k1Plunger.position.z = k1PlungerZ;
    k2Plunger.position.z = k2PlungerZ;

    // Motor Shaft Spinning (%QX0.1 Forward / %QX0.4 Reverse)
    if (outputs["%QX0.1"]) {
      shaftRotation += dt * 35.0;
    } else if (outputs["%QX0.4"]) {
      shaftRotation -= dt * 35.0;
    }
    shaft.rotation.x = shaftRotation;
    coupling.rotation.x = shaftRotation;

    // Arc flash lighting
    if (isCollision) {
      arcLight.intensity = 8.0 + Math.random() * 6.0;
      arcLight.color.setHex(Math.random() > 0.5 ? 0x93c5fd : 0xdbeafe);
    } else {
      arcLight.intensity = 0;
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
