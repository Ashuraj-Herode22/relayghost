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
            scan space. No race conditions, timer skips, or mechanical interference found.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-[11px] text-rose-300 leading-relaxed font-semibold">
              {result.hazard}
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
              <span className="bg-rose-900/40 border border-rose-600/50 px-2 py-0.5 rounded text-rose-200 font-bold">
                Breach Cycle: #{result.collision_cycle}
              </span>
              <span className="bg-rose-900/40 border border-rose-600/50 px-2 py-0.5 rounded text-rose-200 font-bold">
                Conflicting Coils: {result.collision_coils.join(" + ")}
              </span>
              <span className="bg-rose-900/40 border border-rose-600/50 px-2 py-0.5 rounded text-rose-200 font-bold">
                Fault Rungs: {result.fault_rung_ids.map((id) => `#${id}`).join(", ")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Before / After Proof Delta (Shown after patch is synthesized) */}
      {deltaInfo && result.safe && (
        <div className="p-3 bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-500/50 rounded-md space-y-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
            <span>⚡ Before/After Formal Proof Delta</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40">
              VERIFIED
            </span>
          </div>
          <div className="text-[11px] text-slate-300 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-rose-400 font-bold">Before:</span>
              <span>Crash at Cycle #{deltaInfo.beforeCycle} ({result.collision_coils.join(" + ") || "Hazard State"})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-bold">After:</span>
              <span>0 Hazards Reachable across {result.states_explored} Discrete States</span>
            </div>
            <div className="text-[10px] text-cyan-300 font-semibold pt-0.5">
              {deltaInfo.deltaText}
            </div>
          </div>
        </div>
      )}

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
          &quot;When <span className="font-bold text-amber-300">{result.collision_coils[0] || "%QX0.0"}</span> is energized, the
          system shall ensure <span className="font-bold text-amber-300">{result.collision_coils[1] || "%QX0.1"}</span> is
          de-energized, and while workpiece transfer is active, conflicting stroke operations shall be inhibited.&quot;
        </div>
      </div>

      {/* Action Strip: Patching & Download Patched XML */}
      <div className="space-y-2">
        {canPatch && (
          <button
            onClick={onSynthesizePatch}
            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded font-bold text-xs border border-emerald-400 active:scale-98 transition shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center space-x-2 animate-pulse"
          >
            <span>⚡ Synthesize Dynamic EARS Interlock (Deadlock-Free)</span>
          </button>
        )}

        {result.safe && (
          <button
            onClick={handleDownloadXml}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-xs border border-slate-700 active:scale-98 transition flex items-center justify-center space-x-2"
          >
            <span>{downloadSuccess ? "✅ Downloaded!" : "📥 Download Patched PLCopen XML (.xml)"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
