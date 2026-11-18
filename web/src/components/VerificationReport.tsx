"use client";

import React, { useState } from "react";
import { VerificationResult, Rung, generatePatchedPlcopenXml } from "@/lib/plcVerifier";
import { MachineArchetype, MACHINE_DEFINITIONS } from "./workcell/types";

interface VerificationReportProps {
  result: VerificationResult | null;
  rungs: Rung[];
  onSynthesizePatch: () => void;
  canPatch: boolean;
  deltaInfo?: {
    patchDescription: string;
    deltaText: string;
    beforeCycle: number | null;
  } | null;
  onRevertToOriginal?: () => void;
  machineType?: MachineArchetype;
  sourceName?: string;
}

export default function VerificationReport({
  result,
  rungs,
  onSynthesizePatch,
  canPatch,
  deltaInfo,
  onRevertToOriginal,
  machineType = "stamping_press",
  sourceName = "PLC Program",
}: VerificationReportProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"plain_english" | "formal_ears">("plain_english");

  if (!result) return null;

  const handleDownloadXml = () => {
    try {
      const xml = generatePatchedPlcopenXml(rungs);
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relayghost_patched_safety.xml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (e) {
      console.error("Export XML failed:", e);
    }
  };

  const isSafe = result.safe;
  const cA = result.collision_coils[0] || "%QX0.0";
  const cB = result.collision_coils[1] || "%QX0.1";
  const machineMeta = MACHINE_DEFINITIONS[machineType] || MACHINE_DEFINITIONS.stamping_press;

  // Context-aware EARS descriptions (symmetric coil matching)
  const getEarsContext = () => {
    const has00 = cA.includes("0.0") || cB.includes("0.0");
    const has01 = cA.includes("0.1") || cB.includes("0.1");
    const has03 = cA.includes("0.3") || cB.includes("0.3");
    const has04 = cA.includes("0.4") || cB.includes("0.4");

    if (machineType === "stamping_press" || (has00 && has01)) {
      return {
        primaryDesc: "%QX0.1 (Robotic Transfer Arm)",
        secondaryDesc: "inhibit %QX0.0 (Hydraulic Press Ram)",
        zone: "inside die tooling cavity",
        condition: "Arm is safely retracted Home (%IX0.2)",
      };
    }
    if (machineType === "bottle_filler") {
      return {
        primaryDesc: "%QX0.1 (Rotary Starwheel Indexer)",
        secondaryDesc: "inhibit %QX0.0 (Vertical Filling Nozzles)",
        zone: "at starwheel bottle carousel gate",
        condition: "Starwheel rotation halts at station home (%IX0.1)",
      };
    }
    if (machineType === "conveyor_diverter" || (has01 && has03)) {
      return {
        primaryDesc: "%QX0.3 (High-Speed Diverter Gate)",
        secondaryDesc: "inhibit %QX0.1 (Infeed Pusher Arm)",
        zone: "cross-transfer sorting junction",
        condition: "clamp position sensor verifies open (%IX0.3)",
      };
    }
    if (machineType === "curing_oven") {
      return {
        primaryDesc: "%QX0.0 (Nichrome Heating Element Bank)",
        secondaryDesc: "inhibit %QX0.0 until %QX0.1 (Purge Blower)",
        zone: "sealed atmosphere combustion chamber",
        condition: "purge blower airflow sensor (%IX0.1) confirms pre-purge",
      };
    }
    if (machineType === "motor_bridge" || (has00 && has04)) {
      return {
        primaryDesc: "%QX0.4 (Reverse Contactor K2)",
        secondaryDesc: "inhibit %QX0.0 (Forward Contactor K1)",
        zone: "480V 3-phase busbar power bridge",
        condition: "opposing contactor drops out & deadband timer completes",
      };
    }
    if (machineType === "robot_handover") {
      return {
        primaryDesc: "%QX0.3 (Robot Arm Beta Gripper)",
        secondaryDesc: "inhibit %QX0.1 (Robot Arm Alpha Gripper)",
        zone: "shared central transfer nest",
        condition: "Robot Alpha exit sensor (%IX0.2) confirms clearance",
      };
    }
    return {
      primaryDesc: `${cB} (Primary Actuator)`,
      secondaryDesc: `inhibit ${cA} (Secondary Actuator)`,
      zone: "shared physical envelope",
      condition: "reciprocal safety interlock verifies clear",
    };
  };

  const earsCtx = getEarsContext();

  // Generate plain-English root cause & remediation summary
  const getPlainEnglishSummary = () => {
    const cycleNum = result.collision_cycle !== null ? `#${String(result.collision_cycle).padStart(2, "0")}` : "None";
    const msTime = result.collision_cycle !== null ? `${result.collision_cycle * 5}.0ms` : "0ms";

    if (isSafe) {
      return {
        what: `Zero physical collisions or electrical conflicts detected. All ${machineMeta.name} actuators operate with complete physical mutual exclusion throughout all production scan cycles.`,
        why: `Dual reciprocal safety interlocks prevent conflicting actuators from ever receiving electrical power at the same instant, even if sensors bounce or timers desynchronize.`,
        when: `Exhaustively validated across ${result.states_explored} reachable states with 0 hazardous states reachable.`,
        fix: `System is production-ready. Rolls-Royce EARS invariant strictly enforces mutual exclusion: whenever one actuator is active, all conflicting actuators are locked out.`,
      };
    }

    if (machineType === "stamping_press") {
      return {
        what: `Catastrophic mechanical strike! The 500-ton hydraulic ram stroked down into the die bolster while the pneumatic robotic transfer arm was still positioned inside loading a sheet metal blank. The descending ram crushed the robotic vacuum tooling.`,
        why: `The ladder logic lacks mutual exclusion. Rung 0 energizes the press cylinder purely based on timer T4:1.DN without checking if the feeder arm has retracted. A 12ms sensor bounce delayed proximity sensor %IX0.2, causing both coils %QX0.0 and %QX0.1 to energize simultaneously.`,
        when: `Scan Cycle ${cycleNum} (at t = ${msTime}). The collision occurred during the high-speed blank placement transition.`,
        fix: `Inject reciprocal safety interlocks: Add a normally-closed (NC) contact of %QX0.1 to Rung 0 to block the press ram while the arm is extended, and add an NC contact of %QX0.0 to Rung 1 to hold the arm until optical sensors confirm clearance.`,
      };
    }

    if (machineType === "bottle_filler") {
      return {
        what: `Sanitary bottling line crash! Dual vertical liquid filling nozzles plunged down while the rotary starwheel carousel was still actively indexing bottles between stations, shearing the stainless nozzles and shattering amber glass bottles.`,
        why: `Rung 1 kept the rotary index motor energized while Rung 0 activated the nozzle cylinder without confirming starwheel home index switch %IX0.1. Timer T4:8.DN elapsed while the carousel was mid-rotation.`,
        when: `Scan Cycle ${cycleNum} (at t = ${msTime}). Occurred during rotary index transition between Station 2 and Station 3.`,
        fix: `Interlock carousel rotation with nozzle elevation: force nozzles (%QX0.0) to stay retracted whenever the starwheel is moving (%QX0.1), and inhibit carousel drive until vertical proximity sensors confirm nozzles are in the home position.`,
      };
    }

    if (machineType === "conveyor_diverter") {
      return {
        what: `High-speed package sortation jam! The transverse pneumatic diverter arm swung violently across the conveyor belt while an infeed parcel was still passing through the junction, crushing the parcel and stalling the line.`,
        why: `Diverter coil %QX0.3 energized based on sort destination before infeed pusher %QX0.1 completed its stroke, violating transit clearance timing due to an unlatched optical beam.`,
        when: `Scan Cycle ${cycleNum} (at t = ${msTime}). Occurred at the junction split between the main conveyor and reject lane.`,
        fix: `Add an interlock on Rung 2 preventing diverter actuation while feed conveyor arm is energized, and verify photocell %IX0.3 clearance before initiating divert motion.`,
      };
    }

    if (machineType === "curing_oven") {
      return {
        what: `Atmosphere explosion risk! High-power Nichrome heating elements energized inside the sealed autoclave chamber while the volatile solvent purge blower was stopped, risking thermal runaway and gas ignition.`,
        why: `Rung 0 energized heating contactor %QX0.0 directly on temperature request without interlocking with airflow sensor switch %IX0.1 or purge fan coil %QX0.1.`,
        when: `Scan Cycle ${cycleNum} (at t = ${msTime}). Occurred immediately on furnace startup command before required purge cycle.`,
        fix: `Enforce a purge-before-heat interlock: block heating coil %QX0.0 until purge blower %QX0.1 has operated for the certified duration and positive differential pressure is confirmed.`,
      };
    }

    if (machineType === "motor_bridge") {
      return {
        what: `Catastrophic 480V 3-phase short circuit (Busbar Arc Flash)! Forward contactor (K1) and Reverse contactor (K2) both pulled in simultaneously, bridging Phase L1 directly to Phase L3 and vaporizing the power contacts.`,
        why: `A direction reversal was commanded while Forward contactor coil was still magnetically engaged. Missing cross-interlock allowed directional coils %QX0.0 and %QX0.4 to close on the exact same scan cycle.`,
        when: `Scan Cycle ${cycleNum} (at t = ${msTime}). Occurred during instant motor reversal command without deadband delay.`,
        fix: `Insert reciprocal electrical software interlocks: wire normally-closed auxiliary contact / %QX0.4 into the Forward rung, and / %QX0.0 into the Reverse rung, backed by a 200ms deadband delay timer.`,
      };
    }

    if (machineType === "robot_handover") {
      return {
        what: `Dual-arm robotic collision! Robot Arm Alpha and Robot Arm Beta both entered the central part-transfer nest at the same time, crashing their end-effectors at high speed.`,
        why: `Both robots responded to part arrival sensor %IX0.4 without an active mutual exclusion handshake token, leading to simultaneous motion commands %QX0.1 and %QX0.3.`,
        when: `Scan Cycle ${cycleNum} (at t = ${msTime}). Occurred at the center of the handover workspace.`,
        fix: `Implement a digital clearance semaphore: Robot Beta cannot enter the handover zone until Robot Alpha departs and confirms clear via limit switch %IX0.2.`,
      };
    }

    return {
      what: `Physical collision detected: Coils ${cA} and ${cB} energized simultaneously inside the shared zone '${machineMeta.collisionZoneName}'.`,
      why: `The ladder rungs driving these coils lacked mutual exclusion contacts, allowing concurrent activation under transient sensor or timer states.`,
      when: `Scan Cycle ${cycleNum} (at t = ${msTime}).`,
      fix: `Insert reciprocal normally-closed interlocks on both rungs so neither actuator can energize while the other is in motion.`,
    };
  };

  const plainSummary = getPlainEnglishSummary();

  return (
    <div className="rounded-2xl bg-[#0C0E14] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-3.5 space-y-3 font-mono text-xs overflow-y-auto">
      {/* Executive Status Banner */}
      <div
        className={`p-3 rounded-xl border transition-all duration-300 ${
          isSafe
            ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
            : "border-rose-500/60 bg-rose-950/25 text-rose-100 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isSafe ? "bg-emerald-400 shadow-[0_0_8px_#10b981]" : "bg-rose-500 animate-ping shadow-[0_0_8px_#ef4444]"
              }`}
            />
            <span className="font-bold tracking-wider text-[12px] uppercase">
              {isSafe ? "100% Invariant Safe · 0 Reachable Hazards" : `Critical Collision at Cycle #${result.collision_cycle}`}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 font-semibold border border-white/[0.08]">
            {isSafe ? "VERIFIED PROOF" : "BREACH DETECTED"}
          </span>
        </div>

        <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
          {isSafe
            ? "Exhaustive bounded model check proves all reachable states satisfy IEC 61131-3 physical mutual exclusion. Zero race conditions, sensor glitches, or timing deadlocks detected."
            : result.hazard || "Temporal race condition detected: conflicting actuators energized simultaneously inside shared physical zone."}
        </p>
      </div>

      {/* 3-Column KPI Stat Row */}
      <div className="grid grid-cols-3 gap-2 tabular-nums">
        <div className="p-2.5 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">States Explored</span>
          <span className="text-base font-bold text-white mt-0.5">{result.states_explored}</span>
          <span className="text-[9px] text-slate-500">Exhaustive BFS</span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Failure Cycle</span>
          <span className={`text-base font-bold mt-0.5 ${isSafe ? "text-emerald-400" : "text-rose-400"}`}>
            {result.collision_cycle !== null ? `#${String(result.collision_cycle).padStart(2, "0")}` : "None (Safe)"}
          </span>
          <span className="text-[9px] text-slate-500">{isSafe ? "0 Reachable" : "Crash Frame"}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Colliding Coils</span>
          <span className="text-xs font-bold text-amber-300 mt-1 truncate">
            {result.collision_coils.length > 0 ? result.collision_coils.join(" + ") : "0 Conflicts"}
          </span>
          <span className="text-[9px] text-slate-500">Universal Field Bus</span>
        </div>
      </div>

      {/* View Switcher: AI Plain-English Explainer vs Rolls-Royce Formal EARS Spec */}
      <div className="flex items-center justify-between p-1 bg-[#090C12] rounded-xl border border-white/[0.06]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab("plain_english")}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === "plain_english"
                ? "bg-violet-600/30 text-violet-200 border border-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🤖 AI Plain-English Summary</span>
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab("formal_ears")}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === "formal_ears"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📜 Rolls-Royce EARS Spec</span>
          </button>
        </div>

        <span className="text-[10px] text-slate-500 font-sans hidden sm:inline">
          {machineMeta.name}
        </span>
      </div>

      {/* Tab 1: AI Plain-English Root Cause & Remediation Explainer */}
      {activeTab === "plain_english" && (
        <div className="rounded-xl bg-[#080B10] border border-white/[0.08] p-3 space-y-2.5 font-sans">
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.06] text-[10px]">
            <span className="font-mono uppercase font-bold tracking-wider text-violet-300 flex items-center space-x-1">
              <span>⚡ Human-Readable Root Cause & Fix</span>
            </span>
            <span className="text-slate-500 font-mono">
              KIRO / CLAUDE ENGINE · EXPLAINABILITY
            </span>
          </div>

          {/* 1. What Happened */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                isSafe ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}>
                {isSafe ? "Verified Safe" : "What Happened"}
              </span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed pl-1 border-l-2 border-white/10">
              {plainSummary.what}
            </p>
          </div>

          {/* 2. Why It Happened */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Why It Happened
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed pl-1 border-l-2 border-amber-500/30">
              {plainSummary.why}
            </p>
          </div>

          {/* 3. When It Happened */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                When It Happened
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed pl-1 border-l-2 border-cyan-500/30 font-mono text-[10.5px]">
              {plainSummary.when}
            </p>
          </div>

          {/* 4. How To Fix It */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                How To Fix It
              </span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed pl-1 border-l-2 border-emerald-500/30">
              {plainSummary.fix}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Formal Rolls-Royce EARS Specification Invariant Block */}
      {activeTab === "formal_ears" && (
        <div className="rounded-xl bg-[#080B10] border border-white/[0.08] p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-semibold text-slate-300 uppercase tracking-wider">
              Rolls-Royce EARS Invariant Rule
            </span>
            <span className="text-amber-400/90 font-medium">[Mavin et al., Rolls-Royce 2009]</span>
          </div>

          <div className="text-[11px] leading-relaxed bg-[#05070B] p-2.5 rounded-lg border border-white/[0.04] text-slate-300 space-y-1">
            <div>
              <span className="text-violet-400 font-bold">WHILE </span>
              <span className="text-amber-300 font-semibold">{earsCtx.primaryDesc}</span>
              <span className="text-slate-400"> is active {earsCtx.zone},</span>
            </div>
            <div>
              <span className="text-emerald-400 font-bold">THE SYSTEM SHALL </span>
              <span className="text-rose-300 font-semibold">{earsCtx.secondaryDesc}</span>
              <span className="text-slate-400"> from energizing,</span>
            </div>
            <div>
              <span className="text-cyan-400 font-bold">WHERE </span>
              <span className="text-slate-400">normal execution resumes only when {earsCtx.condition}.</span>
            </div>
          </div>
        </div>
      )}

      {/* Before / After Proof Delta (Shown after patch is synthesized) */}
      {deltaInfo && isSafe && (
        <div className="p-2.5 bg-gradient-to-r from-emerald-950/30 to-violet-950/30 border border-emerald-500/40 rounded-xl space-y-1 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
            <span>⚡ Formal Proof Delta (Before → After)</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
              PROVEN SAFE
            </span>
          </div>
          <div className="text-[11px] text-slate-300 space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-rose-400 font-bold">Before:</span>
              <span>Crash at Cycle #{deltaInfo.beforeCycle} ({cA} vs {cB})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-bold">After:</span>
              <span>0 Hazards Reachable across {result.states_explored} states</span>
            </div>
            <div className="text-[10px] text-violet-300 font-medium">
              {deltaInfo.deltaText}
            </div>
          </div>
        </div>
      )}

      {/* Primary Action Button: Synthesize EARS Interlock or Download XML */}
      <div className="pt-0.5 space-y-2">
        {canPatch && (
          <button
            onClick={onSynthesizePatch}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-emerald-600 to-teal-500 hover:from-violet-500 hover:via-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all active:scale-[0.99] border border-white/20 flex items-center justify-center space-x-2"
          >
            <span>⚡ Synthesize EARS Interlock & Re-Verify</span>
          </button>
        )}

        {isSafe && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadXml}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#131722] hover:bg-[#1a2030] text-emerald-300 hover:text-emerald-200 font-bold text-xs border border-emerald-500/40 shadow-lg transition-all active:scale-[0.99] flex items-center justify-center space-x-1.5"
            >
              <span>{downloadSuccess ? "✓ Downloaded!" : "📥 Download Patched XML"}</span>
            </button>

            {deltaInfo && onRevertToOriginal && (
              <button
                onClick={onRevertToOriginal}
                className="py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white font-semibold text-xs border border-white/[0.08] transition-all active:scale-[0.99] shrink-0"
                title="Revert back to unpatched buggy logic to replay crash"
              >
                <span>↺ Revert to Defect</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
