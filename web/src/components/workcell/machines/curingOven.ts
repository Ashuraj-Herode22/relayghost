import * as THREE from "three";
import { MachineInstance } from "./stampingPress";

export function buildCuringOven(scene: THREE.Scene): MachineInstance {
  const root = new THREE.Group();
  root.name = "machine_curing_oven";

  // Materials
  const furnaceSteel = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.4,
  });
  const chromeTrim = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.15,
  });
  const heatingCoilMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
    metalness: 0.9,
    roughness: 0.2,
  });
  const quartzWindow = new THREE.MeshPhysicalMaterial({
    color: 0xfef08a,
    transmission: 0.85,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
  });
  const hazardOrange = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    metalness: 0.3,
    roughness: 0.35,
  });

  // 1. Heavy Insulated Furnace Chamber Base
  const ovenBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 2.8), furnaceSteel);
  ovenBase.position.set(0, 0.2, 0);
  root.add(ovenBase);

  // Oven Chamber Body (Outer Walls)
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.4, 2.4), furnaceSteel);
  chamber.position.set(0, 1.6, -0.2);
  chamber.castShadow = true;
  root.add(chamber);

  // Quartz Inspection Port on side
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.05), chromeTrim);
  windowFrame.position.set(1.42, 1.7, -0.2);
  windowFrame.rotation.y = Math.PI / 2;
  root.add(windowFrame);
  const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), quartzWindow);
  windowGlass.position.set(1.44, 1.7, -0.2);
  windowGlass.rotation.y = Math.PI / 2;
  root.add(windowGlass);

  // 2. Actuator %QX0.0: Internal Nichrome Heating Coil Array
  const heaterGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 12, 24), heatingCoilMat);
    coil.position.set(0, 1.3 + i * 0.22, -0.3);
    coil.rotation.x = Math.PI / 2;
    heaterGroup.add(coil);
  }
  root.add(heaterGroup);

  // Internal chamber point light that turns glowing orange when heater is active
  const heaterGlow = new THREE.PointLight(0xff5500, 0, 3.5);
  heaterGlow.position.set(0, 1.6, -0.2);
  root.add(heaterGlow);

  // 3. Actuator %QX0.1: Volatile Purge Blower Turbine
  const blowerGroup = new THREE.Group();
  const blowerHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 24), furnaceSteel);
  blowerHousing.rotation.z = Math.PI / 2;
  blowerHousing.position.set(0, 3.15, -0.2);
  blowerGroup.add(blowerHousing);

  const exhaustStack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 24), chromeTrim);
  exhaustStack.position.set(0, 3.65, -0.2);
  blowerGroup.add(exhaustStack);

  // Rotating Impeller Fan
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16), chromeTrim);
  fanHub.rotation.z = Math.PI / 2;
  fanHub.position.set(0, 3.15, -0.2);
  blowerGroup.add(fanHub);

  const fanBlades: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.1), hazardOrange);
    b.position.set(0, 3.15, -0.2);
    b.rotation.x = (i * Math.PI) / 2;
    blowerGroup.add(b);
    fanBlades.push(b);
  }
  root.add(blowerGroup);

  // 4. Actuator %QX0.3: Blast Guillotine Door
  const doorGroup = new THREE.Group();
  const doorGuidesL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), chromeTrim);
  doorGuidesL.position.set(-1.15, 1.7, 1.05);
  root.add(doorGuidesL);
  const doorGuidesR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), chromeTrim);
  doorGuidesR.position.set(1.15, 1.7, 1.05);
  root.add(doorGuidesR);

  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.9, 0.12), furnaceSteel);
  doorLeaf.castShadow = true;
  doorGroup.add(doorLeaf);

  // Door warning chevron
  const doorStrip = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.15, 0.04), hazardOrange);
  doorStrip.position.set(0, -0.85, 0.08);
  doorGroup.add(doorStrip);

  doorGroup.position.set(0, 3.2, 1.05); // Open: 3.2, Closed: 1.55
  root.add(doorGroup);

  // 5. Actuator %QX0.2: Motorized Hearth Rail Carriage & Composite Part
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.0), chromeTrim);
  railL.position.set(-0.65, 0.45, 0.4);
  root.add(railL);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.0), chromeTrim);
  railR.position.set(0.65, 0.45, 0.4);
  root.add(railR);

  const hearthCar = new THREE.Group();
  const carBed = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.4), chromeTrim);
  hearthCar.add(carBed);

  // Aerospace composite wing spar workpiece
  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.25, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
  );
  workpiece.position.set(0, 0.18, 0);
  hearthCar.add(workpiece);

  hearthCar.position.set(0, 0.54, 1.4); // Outside: 1.4, Inside oven: -0.2
  root.add(hearthCar);

  // 6. Actuator %QX0.5: Combustion Gas Strobe Beacon
  const strobeDomeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const strobeDome = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 16), strobeDomeMat);
  strobeDome.position.set(1.1, 3.0, 1.05);
  root.add(strobeDome);

  scene.add(root);

  const collisionPoint = new THREE.Vector3(0, 1.5, 0.4);

  // Kinematics state
  let currentDoorY = 3.2;
  let currentCarZ = 1.4;
  let heaterIntensity = 0.0;

  const updateKinematics = (
    outputs: Record<string, boolean>,
    dt: number,
    isCollision: boolean,
    isSafe: boolean
  ) => {
    // Heater %QX0.0
    const targetHeater = outputs["%QX0.0"] ? (isCollision ? 1.0 : 0.8) : 0.0;
    // Blast Door %QX0.3
    const targetDoorY = outputs["%QX0.3"] ? (isCollision ? 2.0 : 1.55) : 3.2;
    // Hearth Car %QX0.2
    const targetCarZ = outputs["%QX0.2"] ? -0.2 : 1.4;

    const lerpFactor = Math.min(1.0, dt * 14.0);
    currentDoorY = THREE.MathUtils.lerp(currentDoorY, targetDoorY, lerpFactor);
    currentCarZ = THREE.MathUtils.lerp(currentCarZ, targetCarZ, lerpFactor);
    heaterIntensity = THREE.MathUtils.lerp(heaterIntensity, targetHeater, lerpFactor);

    doorGroup.position.y = currentDoorY;
    hearthCar.position.z = currentCarZ;

    // Glowing heating coils
    if (heaterIntensity > 0.05) {
      heatingCoilMat.emissive.setHex(0xff3300);
      heatingCoilMat.emissiveIntensity = heaterIntensity * (isCollision ? 4.0 : 2.0);
      heaterGlow.intensity = heaterIntensity * (isCollision ? 5.0 : 2.5);
    } else {
      heatingCoilMat.emissive.setHex(0x000000);
      heatingCoilMat.emissiveIntensity = 0;
      heaterGlow.intensity = 0;
    }

    // Purge blower fan spinning (%QX0.1)
    if (outputs["%QX0.1"]) {
      for (const b of fanBlades) {
        b.rotation.x += dt * 30.0;
      }
    }

    // Safety Strobe
    if (isCollision) {
      strobeDomeMat.color.setHex(0xef4444);
    } else if (isSafe) {
      strobeDomeMat.color.setHex(0x10b981);
    } else {
      strobeDomeMat.color.setHex(0xf59e0b);
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
