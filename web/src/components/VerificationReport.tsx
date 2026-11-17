"use client";

import React, { useState } from "react";
import { VerificationResult, Rung, generatePatchedPlcopenXml } from "@/lib/plcVerifier";

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
}

export default function VerificationReport({
  result,
  rungs,
  onSynthesizePatch,
  canPatch,
  deltaInfo,
}: VerificationReportProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

  return (
    <div className="rounded-2xl bg-[#0C0E14] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-4 space-y-3.5 font-mono text-xs">
      {/* Executive Status Banner */}
      <div
        className={`p-3.5 rounded-xl border transition-all duration-300 ${
          isSafe
            ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
            : "border-rose-500/60 bg-rose-950/25 text-rose-100 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isSafe ? "bg-emerald-400 shadow-[0_0_8px_#10b981]" : "bg-rose-500 animate-ping shadow-[0_0_8px_#ef4444]"
              }`}
            />
            <span className="font-bold tracking-wider text-[13px] uppercase">
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
          <span className="text-base font-bold text-white mt-1">{result.states_explored}</span>
          <span className="text-[9px] text-slate-500">Exhaustive BFS</span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Failure Cycle</span>
          <span className={`text-base font-bold mt-1 ${isSafe ? "text-emerald-400" : "text-rose-400"}`}>
            {result.collision_cycle !== null ? `#${String(result.collision_cycle).padStart(2, "0")}` : "None (Safe)"}
          </span>
          <span className="text-[9px] text-slate-500">{isSafe ? "0 Reachable" : "Crash Frame"}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#090C12] border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Colliding Coils</span>
          <span className="text-sm font-bold text-amber-300 mt-1 truncate">
            {result.collision_coils.length > 0 ? result.collision_coils.join(" + ") : "0 Conflicts"}
          </span>
          <span className="text-[9px] text-slate-500">Universal Field Bus</span>
        </div>
      </div>

      {/* Rolls-Royce EARS Specification Invariant Block (Stripe API Style) */}
      <div className="rounded-xl bg-[#080B10] border border-white/[0.08] p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="font-semibold text-slate-300 uppercase tracking-wider">
            Rolls-Royce EARS Invariant Rule
          </span>
          <span className="text-amber-400/90 font-medium">[Mavin et al., Rolls-Royce 2009]</span>
        </div>

        <div className="text-[11px] leading-relaxed bg-[#05070B] p-2.5 rounded-lg border border-white/[0.04] text-slate-300 space-y-1">
          <div>
            <span className="text-violet-400 font-bold">WHILE </span>
            <span className="text-amber-300 font-semibold">{cB} (Primary Actuator)</span>
            <span className="text-slate-400"> is active or inside die center,</span>
          </div>
          <div>
            <span className="text-emerald-400 font-bold">THE SYSTEM SHALL </span>
            <span className="text-rose-300 font-semibold">inhibit {cA} (Secondary Stroke)</span>
            <span className="text-slate-400"> from energizing,</span>
          </div>
          <div>
            <span className="text-cyan-400 font-bold">WHERE </span>
            <span className="text-slate-400">normal execution resumes only when Arm is safely Home (%IX0.2).</span>
          </div>
        </div>
      </div>

      {/* Before / After Proof Delta (Shown after patch is synthesized) */}
      {deltaInfo && isSafe && (
        <div className="p-3 bg-gradient-to-r from-emerald-950/30 to-violet-950/30 border border-emerald-500/40 rounded-xl space-y-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
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
            <div className="text-[10px] text-violet-300 font-medium pt-0.5">
              {deltaInfo.deltaText}
            </div>
          </div>
        </div>
      )}

      {/* Primary Action Button: Synthesize EARS Interlock or Download XML */}
      <div className="pt-1 space-y-2">
        {canPatch && (
          <button
            onClick={onSynthesizePatch}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-emerald-600 to-teal-500 hover:from-violet-500 hover:via-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all active:scale-[0.99] border border-white/20 flex items-center justify-center space-x-2"
          >
            <span>⚡ Synthesize EARS Interlock & Re-Verify</span>
          </button>
        )}

        {isSafe && (
          <button
            onClick={handleDownloadXml}
            className="w-full py-2.5 px-4 rounded-xl bg-[#131722] hover:bg-[#1a2030] text-emerald-300 hover:text-emerald-200 font-bold text-xs border border-emerald-500/40 shadow-lg transition-all active:scale-[0.99] flex items-center justify-center space-x-2"
          >
            <span>{downloadSuccess ? "✓ Patched XML Downloaded!" : "📥 Download Patched PLCopen XML (.xml)"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
