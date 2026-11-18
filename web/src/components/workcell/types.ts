export type MachineArchetype =
  | "stamping_press"
  | "bottle_filler"
  | "conveyor_diverter"
  | "curing_oven"
  | "motor_bridge"
  | "robot_handover";

export interface MachineMeta {
  id: MachineArchetype;
  name: string;
  tagline: string;
  icon: string;
  collisionZoneName: string;
  actuators: {
    addr: string;
    label: string;
    type: string;
  }[];
}

export const MACHINE_DEFINITIONS: Record<MachineArchetype, MachineMeta> = {
  stamping_press: {
    id: "stamping_press",
    name: "500-Ton Hydraulic Stamping Press",
    tagline: "Heavy-tonnage die stamping & high-speed pneumatic blank feeder",
    icon: "🔨",
    collisionZoneName: "Die Tooling & Bolster Cavity",
    actuators: [
      { addr: "%QX0.0", label: "Hydraulic Press Ram", type: "Piston" },
      { addr: "%QX0.1", label: "Pneumatic Transfer Arm", type: "Slide" },
      { addr: "%QX0.2", label: "Infeed Blank Conveyor", type: "Belt" },
      { addr: "%QX0.3", label: "Blank Centering Clamps", type: "Jaws" },
      { addr: "%QX0.4", label: "Hydraulic Pressure Pump", type: "Motor" },
      { addr: "%QX0.5", label: "Safety Optical Curtain", type: "Laser" },
    ],
  },
  bottle_filler: {
    id: "bottle_filler",
    name: "Rotary Beverage Bottling & Capping Line",
    tagline: "High-speed sanitary starwheel indexer with dual filling nozzles",
    icon: "🍾",
    collisionZoneName: "Starwheel Nozzle Indexing Gate",
    actuators: [
      { addr: "%QX0.0", label: "Vertical Filling Head", type: "Piston" },
      { addr: "%QX0.1", label: "Rotary Starwheel Indexer", type: "Carousel" },
      { addr: "%QX0.2", label: "Bottle Infeed Track", type: "Conveyor" },
      { addr: "%QX0.3", label: "Reject / Diversion Arm", type: "Flipper" },
      { addr: "%QX0.4", label: "Rotary Capping Spindle", type: "Rotary" },
      { addr: "%QX0.5", label: "Sanitary Presence Beam", type: "Optical" },
    ],
  },
  conveyor_diverter: {
    id: "conveyor_diverter",
    name: "High-Speed Cross-Transfer Conveyor",
    tagline: "Dual-lane package sorting table with transverse pneumatic diverter",
    icon: "📦",
    collisionZoneName: "Cross-Transfer Divert Junction",
    actuators: [
      { addr: "%QX0.0", label: "Transverse Pusher Ram", type: "Piston" },
      { addr: "%QX0.1", label: "Infeed Metering Arm", type: "Blade" },
      { addr: "%QX0.2", label: "Main Roller Conveyor", type: "Rollers" },
      { addr: "%QX0.3", label: "High-Speed Diverter Gate", type: "Swing Gate" },
      { addr: "%QX0.4", label: "Discharge Chute Roller", type: "Drive" },
      { addr: "%QX0.5", label: "Jam Detection Curtain", type: "Laser" },
    ],
  },
  curing_oven: {
    id: "curing_oven",
    name: "Thermal Curing Autoclave Chamber",
    tagline: "High-temperature aerospace composite furnace with purge blower",
    icon: "🔥",
    collisionZoneName: "Combustion & Atmosphere Chamber",
    actuators: [
      { addr: "%QX0.0", label: "Nichrome Heating Bank", type: "Thermal Array" },
      { addr: "%QX0.1", label: "Volatile Purge Blower", type: "Centrifugal" },
      { addr: "%QX0.2", label: "Hearth Rail Carriage", type: "Rail" },
      { addr: "%QX0.3", label: "Blast Guillotine Door", type: "Gate" },
      { addr: "%QX0.4", label: "Recirculation Turbine", type: "Fan" },
      { addr: "%QX0.5", label: "Thermal Hazard Strobe", type: "Beacon" },
    ],
  },
  motor_bridge: {
    id: "motor_bridge",
    name: "480V Dual-Contactor VFD Motor Bridge",
    tagline: "3-phase reversible induction motor with electromagnetic interlocks",
    icon: "⚡",
    collisionZoneName: "Dual-Contactor 3-Phase Busbar",
    actuators: [
      { addr: "%QX0.0", label: "Forward Contactor (K1)", type: "Contactor" },
      { addr: "%QX0.1", label: "Drive Shaft (Clockwise)", type: "Spindle" },
      { addr: "%QX0.2", label: "Forced Air Cooling Fan", type: "Motor" },
      { addr: "%QX0.3", label: "Dynamic Brake Plunger", type: "Solenoid" },
      { addr: "%QX0.4", label: "Reverse Contactor (K2)", type: "Contactor" },
      { addr: "%QX0.5", label: "Arc-Fault Trip Relay", type: "Strobe" },
    ],
  },
  robot_handover: {
    id: "robot_handover",
    name: "Dual-Arm Autonomous Robotic Cell",
    tagline: "Twin articulated 6-axis robot arms sharing central fixture envelope",
    icon: "🤖",
    collisionZoneName: "Shared Clearance Fixture Envelope",
    actuators: [
      { addr: "%QX0.0", label: "Robot Alpha Tool Head", type: "Articulated" },
      { addr: "%QX0.1", label: "Robot Alpha Gripper", type: "Jaw" },
      { addr: "%QX0.2", label: "Part Rotary Index Table", type: "Turntable" },
      { addr: "%QX0.3", label: "Robot Beta Gripper", type: "Jaw" },
      { addr: "%QX0.4", label: "Robot Beta Tool Head", type: "Articulated" },
      { addr: "%QX0.5", label: "Perimeter Safety Scanner", type: "LiDAR" },
    ],
  },
};

/**
 * Intelligent classifier that determines the exact industrial machine archetype
 * from preset ID, file name, rung names, and XML variables.
 */
export function classifyMachineArchetype(identifier: string, xmlContent?: string): MachineArchetype {
  const text = (identifier + " " + (xmlContent || "")).toLowerCase();

  if (
    text.includes("bottle") ||
    text.includes("filler") ||
    text.includes("beverage") ||
    text.includes("starwheel") ||
    text.includes("bottling") ||
    text.includes("mystery_gamma") ||
    text.includes("rotary_latch")
  ) {
    return "bottle_filler";
  }
  if (
    text.includes("oven") ||
    text.includes("purge") ||
    text.includes("thermal") ||
    text.includes("autoclave") ||
    text.includes("furnace") ||
    text.includes("nichrome") ||
    text.includes("curing") ||
    text.includes("err_03")
  ) {
    return "curing_oven";
  }
  if (
    text.includes("motor") ||
    text.includes("reversal") ||
    text.includes("contactor") ||
    text.includes("vfd") ||
    text.includes("short_circuit") ||
    text.includes("bridge") ||
    text.includes("err_02") ||
    text.includes("480v") ||
    text.includes("busbar") ||
    text.includes("sequential_motor") ||
    text.includes("cascade")
  ) {
    return "motor_bridge";
  }
  if (
    text.includes("robot") ||
    text.includes("handover") ||
    text.includes("dual_arm") ||
    text.includes("alpha") ||
    text.includes("beta") ||
    text.includes("mystery_alpha")
  ) {
    return "robot_handover";
  }
  if (
    text.includes("diverter") ||
    text.includes("conveyor") ||
    text.includes("gate") ||
    text.includes("traffic") ||
    text.includes("sort") ||
    text.includes("err_01") ||
    text.includes("railway") ||
    text.includes("beremiz") ||
    text.includes("roller") ||
    text.includes("pusher")
  ) {
    return "conveyor_diverter";
  }

  // Default to Heavy Hydraulic Stamping Press
  return "stamping_press";
}
