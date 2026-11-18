"use client";

import React from "react";
import { Rung, ReplayFrame } from "@/lib/plcVerifier";
import { MachineArchetype, MACHINE_DEFINITIONS } from "./workcell/types";

interface LadderViewerProps {
  rungs: Rung[];
  currentFrame?: ReplayFrame;
  faultRungIds: number[];
  isCrashFrame: boolean;
  machineType?: MachineArchetype;
}

// Machine-specific descriptive tags for contacts and coils
function getTagDescription(address: string, machineType: MachineArchetype = "stamping_press"): string {
  const meta = MACHINE_DEFINITIONS[machineType] || MACHINE_DEFINITIONS.stamping_press;
  
  // Actuator coils (%QX)
  if (address.startsWith("%QX")) {
    const act = meta.actuators.find((a) => a.addr === address);
    if (act) return act.label;
  }

  // Common inputs (%IX)
  const inputMap: Record<MachineArchetype, Record<string, string>> = {
    stamping_press: {
      "%IX0.0": "Part In Nest Prox",
      "%IX0.1": "Ram TDC Limit",
      "%IX0.2": "Arm Retract Switch",
      "%IX0.3": "Optical Curtain",
      "%IX0.4": "Two-Hand Run PB1",
      "%IX0.5": "Two-Hand Run PB2",
    },
    bottle_filler: {
      "%IX0.0": "Bottle Infeed PE",
      "%IX0.1": "Starwheel Cam Pulse",
      "%IX0.2": "Station Home Prox",
      "%IX0.3": "Sanitary Capper PE",
      "%IX0.4": "Master Run Switch",
      "%IX0.5": "Fill Station Ready",
    },
    conveyor_diverter: {
      "%IX0.0": "Infeed Photocell",
      "%IX0.1": "Pusher Home Limit",
      "%IX0.2": "Pusher Stroke Prox",
      "%IX0.3": "Divert Confirm PE",
      "%IX0.4": "Conveyor Belt Run",
      "%IX0.5": "Barcode Sort Trigger",
    },
    curing_oven: {
      "%IX0.0": "Chamber Door Limit",
      "%IX0.1": "Blower Differential DP",
      "%IX0.2": "Purge Complete Switch",
      "%IX0.3": "Chamber Temp Ready",
      "%IX0.4": "Master Heat Interlock",
      "%IX0.5": "Temp Controller Demand",
    },
    motor_bridge: {
      "%IX0.0": "Thermal Overload OK",
      "%IX0.1": "Forward Aux Contact",
      "%IX0.2": "Neutral Stop Prox",
      "%IX0.3": "Arc Fault Sensor",
      "%IX0.4": "Forward Start PB",
      "%IX0.5": "Reverse Start PB",
    },
    robot_handover: {
      "%IX0.0": "Perimeter Curtain",
      "%IX0.1": "Robot Alpha Grip OK",
      "%IX0.2": "Alpha Departure Prox",
      "%IX0.3": "Nest Part Clamped",
      "%IX0.4": "Nest Staged Switch",
      "%IX0.5": "Robot Beta Request",
    },
  };

  const map = inputMap[machineType] || inputMap.stamping_press;
  if (map[address]) return map[address];

  if (address.endsWith(".DN")) {
    return `${address.replace(".DN", "")} Done`;
  }

  return address;
}

// Descriptive human-readable titles for rungs
function getRungTitle(rung: Rung, machineType: MachineArchetype = "stamping_press"): string {
  const meta = MACHINE_DEFINITIONS[machineType] || MACHINE_DEFINITIONS.stamping_press;
  const target = rung.output_target;

  if (rung.isNewInterlock) {
    return `EARS Interlock Guard · Reciprocal Invariant Active`;
  }

  if (machineType === "stamping_press") {
    if (target === "%QX0.1" && rung.output_type === "OTL") return "Blank Feeder Arm Forward Stroke";
    if (target === "T4:0") return "Feeder Arm Vacuum Placement Dwell Timer";
    if (target === "%QX0.1" && rung.output_type === "OTU") return "Feeder Arm Retract Reset on Prox Confirmation";
    if (target === "T4:1") return "Hydraulic Ram Descent Initiation Delay Timer";
    if (target === "%QX0.0") return "500-Ton Hydraulic Ram Descent Stroke [CRITICAL DEFECT]";
    if (target === "%QX0.2") return "Infeed Blank Metering Conveyor Drive";
    if (target === "%QX0.4") return "High-Pressure Hydraulic Pump Enable";
  }

  if (machineType === "bottle_filler") {
    if (target === "%QX0.1" && rung.output_type === "OTL") return "Infeed PE & Rotary Starwheel Carousel Index Drive";
    if (target === "T4:8") return "Starwheel Station Index Dwell Timer (300ms)";
    if (target === "%QX0.1" && rung.output_type === "OTU") return "Starwheel Index Motor Lock at Station Home";
    if (target === "%QX0.0") return "Dual Vertical Filling Nozzle Plunge [LATCH DEFECT]";
    if (target === "%QX0.2") return "Infeed Track Bottle Metering Conveyor Motor";
    if (target === "%QX0.5") return "High-Speed Rotary Capping Spindle Drive";
  }

  if (machineType === "conveyor_diverter") {
    if (target === "%QX0.2") return "Main Roller Conveyor Infeed Belt Motor";
    if (target === "%QX0.1" && rung.output_type === "OTL") return "Barcode Destination Sort & Pusher Ram Extend";
    if (target === "T4:4") return "Transverse Pusher Travel Dwell Timer (300ms)";
    if (target === "%QX0.1" && rung.output_type === "OTU") return "Pusher Ram Retract on Stroke Limit Sensor";
    if (target === "%QX0.3") return "High-Speed Transverse Diverter Gate Blade [PINCH DEFECT]";
    if (target === "%QX0.4" || target === "%QX0.5") return "Discharge Sort Chute Drive Motor";
  }

  if (machineType === "curing_oven") {
    if (target === "%QX0.1" && rung.output_type === "OTL") return "Chamber Door Limit & Volatile Purge Blower";
    if (target === "T4:6") return "NFPA 86 Certified 30s Safety Pre-Purge Timer";
    if (target === "%QX0.1" && rung.output_type === "OTU") return "Pre-Purge Cycle Verified on Differential Pressure";
    if (target === "%QX0.0") return "480V Nichrome Heating Element Bank [PURGE SKIP DEFECT]";
    if (target === "%QX0.2") return "Motorized Hearth Rail Carriage Drive";
    if (target === "%QX0.4" || target === "%QX0.5") return "Thermal Atmosphere Exhaust Strobe Beacon";
  }

  if (machineType === "motor_bridge") {
    if (target === "%QX0.0" && rung.output_type === "OTL") return "Forward PB & Forward Contactor K1 Pull-In";
    if (target === "T4:5") return "Reverse Command Deadband Delay Timer (300ms)";
    if (target === "%QX0.0" && rung.output_type === "OTU") return "Forward Contactor K1 Drop-Out on Neutral Prox";
    if (target === "%QX0.4") return "Reverse Contactor K2 Pull-In [480V SHORT-CIRCUIT DEFECT]";
    if (target === "%QX0.2") return "Forced-Air Stator Cooling Blower Fan";
  }

  if (machineType === "robot_handover") {
    if (target === "%QX0.1" && rung.output_type === "OTL") return "Nest Part Detect & Robot Alpha Tool Head Enter Command";
    if (target === "T4:7") return "Handover Nest Part Grip Dwell Timer (300ms)";
    if (target === "%QX0.1" && rung.output_type === "OTU") return "Robot Alpha Exit & Departure Handshake Confirmation";
    if (target === "%QX0.3") return "Robot Beta Tool Head Enter Command [COLLISION DEFECT]";
    if (target === "%QX0.2") return "Central Fixture Nest Rotary Turntable Indexer";
    if (target === "%QX0.5") return "Perimeter Safety Optical Scanner Beacon";
  }

  const act = meta.actuators.find((a) => a.addr === target);
  if (act) return `Control Loop: ${act.label} (${target})`;

  return rung.name || `Control Rung #${rung.rung_id}`;
}

export default function LadderViewer({
  rungs,
  currentFrame,
  faultRungIds,
  isCrashFrame,
  machineType = "stamping_press",
}: LadderViewerProps) {
  if (!rungs || rungs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-slate-500 font-mono text-xs rounded-2xl bg-[#0C0E14] border border-white/[0.08]">
        No PLC Ladder Logic loaded. Select a station above to inspect live rungs.
      </div>
    );
  }

  const energizedRungs = new Set(currentFrame?.energized_rungs || []);
  const outputs = currentFrame?.outputs || {};
  const inputs = currentFrame?.inputs || {};
  const machineMeta = MACHINE_DEFINITIONS[machineType] || MACHINE_DEFINITIONS.stamping_press;

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#0C0E14] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden">
      {/* CAD Schematic Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.08] bg-[#0A0D14]/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h3 className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Live Power-Flow Schematic
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            ({rungs.length} Rungs · {machineMeta.name.split(" ")[0]})
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Power Flow</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <span>EARS Guard</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Fault Trigger</span>
          </span>
        </div>
      </div>

      {/* Rung Schematic Canvas */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs select-none">
        {rungs.map((rung) => {
          const isFault = isCrashFrame && faultRungIds.includes(rung.rung_id);
          const isEnergized = energizedRungs.has(rung.rung_id);
          const isCoilActive = Boolean(outputs[rung.output_target]);
          const rungTitle = getRungTitle(rung, machineType);

          return (
            <div
              key={rung.rung_id}
              className={`relative rounded-xl border transition-all duration-150 p-2.5 ${
                isFault
                  ? "border-rose-500/80 bg-rose-950/20 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                  : rung.isNewInterlock
                  ? "border-violet-500/50 bg-violet-950/20 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : isEnergized
                  ? "border-amber-500/40 bg-amber-950/15 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                  : "border-white/[0.06] bg-[#090C12] hover:border-white/[0.12]"
              }`}
            >
              {/* Rung Header Bar with Human-Readable Description */}
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/[0.05] text-[11px]">
                <div className="flex items-center space-x-2 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                      isFault
                        ? "bg-rose-500 text-white"
                        : rung.isNewInterlock
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                        : isEnergized
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-white/[0.06] text-slate-400"
                    }`}
                  >
                    RUNG #{rung.rung_id}
                  </span>
                  <span className="text-slate-200 font-medium text-[11px] truncate" title={rungTitle}>
                    {rungTitle}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                  {rung.isNewInterlock && (
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/50 text-violet-300 text-[9px] font-bold tracking-wider uppercase flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                      <span>EARS INTERLOCK</span>
                    </span>
                  )}
                  {isFault && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500 text-rose-300 text-[9px] font-bold tracking-wider uppercase animate-bounce flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>HAZARD ACTIVE</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Electrical Ladder Power Rails & Contacts */}
              <div className="overflow-x-auto py-1">
                <div className="flex items-center justify-between min-w-[380px] relative">
                  {/* L1 Power Rail (Left 24V DC) */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[8px] text-slate-500 mb-0.5 font-bold">L1</span>
                    <div
                      className={`w-1 rounded-full transition-colors ${
                        isEnergized ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "bg-slate-700"
                      }`}
                      style={{ height: `${Math.max(50, rung.branches.length * 44)}px` }}
                    />
                  </div>

                  {/* Branches & Contacts */}
                  <div className="flex-1 flex flex-col justify-center space-y-1.5 px-2">
                    {rung.branches.map((branch, bIdx) => (
                      <div key={bIdx} className="flex items-center space-x-1">
                        {/* Parallel branch badge */}
                        {rung.branches.length > 1 && (
                          <span className="text-[8px] text-slate-500 font-bold w-5 shrink-0">
                            OR{bIdx + 1}
                          </span>
                        )}

                        {/* Power Lead Wire */}
                        <div
                          className={`h-[2px] w-2 transition-colors shrink-0 ${
                            isEnergized ? "bg-amber-400 animate-wire-flow" : "bg-slate-700"
                          }`}
                        />

                        {/* Contacts in series */}
                        {branch.map(([address, isNC], cIdx) => {
                          const rawVal =
                            address.startsWith("%IX")
                              ? Boolean(inputs[address])
                              : address.startsWith("%QX")
                              ? Boolean(outputs[address])
                              : address.endsWith(".DN")
                              ? Boolean(
                                  currentFrame?.timers[address.replace(".DN", "")]?.dn ||
                                  currentFrame?.counters[address.replace(".DN", "")]?.dn
                                )
                              : false;
                          const contactClosed = isNC ? !rawVal : rawVal;
                          const isSynthesizedGuard = rung.isNewInterlock && isNC;
                          const tagDesc = getTagDescription(address, machineType);

                          return (
                            <div key={cIdx} className="flex items-center space-x-1 shrink-0">
                              <div
                                className={`px-2 py-1 rounded-lg border flex flex-col items-center min-w-[70px] transition-all ${
                                  isSynthesizedGuard
                                    ? "border-violet-500/70 bg-violet-950/40 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                                    : contactClosed
                                    ? "border-amber-500/60 bg-amber-950/30 text-amber-200 shadow-[0_0_6px_rgba(245,158,11,0.2)]"
                                    : "border-white/[0.06] bg-[#0C0F17] text-slate-400"
                                }`}
                                title={`${address}: ${tagDesc}`}
                              >
                                <div className="flex items-center space-x-0.5">
                                  <span className="text-[9px] font-bold">
                                    {isNC ? "[ / ]" : "[   ]"}
                                  </span>
                                  {isSynthesizedGuard && (
                                    <span className="text-[7px] bg-violet-500 text-white px-1 rounded font-bold">
                                      EARS
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] truncate max-w-[85px] text-slate-200 font-mono font-semibold">
                                  {address}
                                </span>
                                <span className="text-[7.5px] truncate max-w-[85px] text-slate-400 font-sans">
                                  {tagDesc}
                                </span>
                                <span
                                  className={`text-[7px] font-bold uppercase mt-0.5 ${
                                    contactClosed ? "text-amber-400" : "text-slate-500"
                                  }`}
                                >
                                  {contactClosed ? "CLOSED" : "OPEN"}
                                </span>
                              </div>

                              {/* Intermediate Wire */}
                              {cIdx < branch.length - 1 && (
                                <div
                                  className={`h-[2px] w-2 transition-colors shrink-0 ${
                                    contactClosed ? "bg-amber-400 animate-wire-flow" : "bg-slate-700"
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}

                        {/* Line to coil */}
                        <div
                          className={`h-[2px] flex-1 transition-colors min-w-[12px] ${
                            isEnergized ? "bg-amber-400 animate-wire-flow" : "bg-slate-700"
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Coil / Block Terminal */}
                  <div className="flex items-center space-x-1.5 pl-1 shrink-0">
                    <div
                      className={`px-2.5 py-1.5 rounded-lg border flex flex-col items-center min-w-[90px] transition-all ${
                        isFault
                          ? "border-rose-500 bg-rose-950/60 text-rose-200 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                          : isCoilActive || isEnergized
                          ? "border-amber-500/70 bg-amber-950/40 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
                          : "border-white/[0.06] bg-[#0C0F17] text-slate-400"
                      }`}
                      title={`${rung.output_target}: ${getTagDescription(rung.output_target, machineType)}`}
                    >
                      <span className="text-[10px] font-bold">
                        {rung.output_type === "TON"
                          ? `TON ${rung.preset_ms}ms`
                          : rung.output_type === "TOF"
                          ? `TOF ${rung.preset_ms}ms`
                          : rung.output_type === "CTU"
                          ? `CTU PV:${rung.preset_count || 5}`
                          : rung.output_type === "OTL"
                          ? "( L )"
                          : rung.output_type === "OTU"
                          ? "( U )"
                          : "(   )"}
                      </span>
                      <span className="text-[10px] font-bold text-white mt-0.5">
                        {rung.output_target}
                      </span>
                      <span className="text-[8px] text-slate-400 font-sans truncate max-w-[95px]">
                        {getTagDescription(rung.output_target, machineType)}
                      </span>
                      <span
                        className={`text-[8px] uppercase font-bold mt-0.5 ${
                          isCoilActive || isEnergized ? "text-amber-400" : "text-slate-500"
                        }`}
                      >
                        {isCoilActive || isEnergized ? "ACTIVE" : "OFF"}
                      </span>
                    </div>

                    {/* L2 Power Rail (Right Neutral) */}
                    <div className="flex flex-col items-center shrink-0 pl-1">
                      <span className="text-[8px] text-slate-500 mb-0.5 font-bold">L2</span>
                      <div
                        className={`w-1 rounded-full transition-colors ${
                          isEnergized ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "bg-slate-700"
                        }`}
                        style={{ height: `${Math.max(50, rung.branches.length * 44)}px` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}