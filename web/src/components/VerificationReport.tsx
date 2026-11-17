"use client";

import React from "react";
import { VerificationResult, Rung } from "@/lib/plcVerifier";

interface VerificationReportProps {
  result: VerificationResult | null;
  rungs: Rung[];
  onSynthesizePatch: () => void;
  canPatch: boolean;
}

export default function VerificationReport({
  result,
  rungs,
  onSynthesizePatch,
  canPatch,
}: VerificationReportProps) {
  if (!result) return null;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4 font-mono text-xs shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Temporal Formal Verification Diagnostic
          </h3>
        </div>
        <span className="text-[10px] text-slate-400">
          Rolls-Royce EARS (2009) Engine
        </span>
      </div>

      {/* Primary Status Banner */}
      <div
        className={`p-3.5 rounded-md border flex flex-col space-y-1.5 ${
          result.safe
            ? "border-emerald-500/60 bg-emerald-950/20 text-emerald-200"
            : "border-rose-500/70 bg-rose-950/30 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold flex items-center space-x-2">
            <span>{result.safe ? "✅ 100% INVARIANT SAFE" : "⚠️ HAZARD DETECTED"}</span>
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
            {result.states_explored} States Checked
          </span>
        </div>

        {result.safe ? (
          <p className="text-[11px] text-emerald-300/90 leading-relaxed">
            All temporal execution paths satisfy IEC 61131-3 physical exclusion invariants across full
            scan space. No race conditions, race timer skips, or mechanical interference found.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-[11px] text-rose-300 leading-relaxed font-semibold">
              {result.hazard}
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
              <span className="bg-rose-900/40 border border-rose-600/50 px-2 py-0.5 rounded text-rose-200">
                Breach Cycle: #{result.collision_cycle}
              </span>
              <span className="bg-rose-900/40 border border-rose-600/50 px-2 py-0.5 rounded text-rose-200">
                Conflicting Coils: {result.collision_coils.join(" + ")}
              </span>
              <span className="bg-rose-900/40 border border-rose-600/50 px-2 py-0.5 rounded text-rose-200">
                Fault Rungs: {result.fault_rung_ids.map((id) => `#${id}`).join(", ")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rolls-Royce EARS Specification Invariant */}
      <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-md space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-bold text-slate-300 uppercase tracking-wide">
            Rolls-Royce EARS Specification Invariant
          </span>
          <span className="text-[10px] text-amber-400 font-semibold">
            [Mavin et al., Rolls-Royce 2009]
          </span>
        </div>
        <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] text-amber-200/90 font-mono italic leading-relaxed">
          &quot;When <span className="font-bold text-amber-300">%QX0.0 (Press)</span> is energized, the
          system shall ensure <span className="font-bold text-amber-300">%QX0.1 (Robot Feeder)</span> is
          de-energized, and while workpiece transfer is active, the press stroke shall be inhibited.&quot;
        </div>
      </div>

      {/* Auto-Synthesizer Interlock Action */}
      {canPatch && (
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-md space-y-2">
          <div className="text-[11px] font-bold text-emerald-300 flex items-center justify-between">
            <span>Autonomous Interlock Synthesis</span>
            <span className="text-[10px] text-emerald-400">Kiro Spec-Engine Ready</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            RelayGhost can inject normally closed cross-interlocks into Rungs{" "}
            {result.fault_rung_ids.map((id) => `#${id}`).join(" & ")} and re-verify formally:
          </p>
          <button
            onClick={onSynthesizePatch}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs border border-emerald-400 active:scale-98 transition shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center justify-center space-x-2"
          >
            <span>⚡ Apply EARS Mutual Exclusion Interlocks & Re-Verify</span>
          </button>
        </div>
      )}
    </div>
  );
}
