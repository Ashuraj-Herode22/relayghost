"use client";

import React from "react";
import { VerificationResult } from "@/lib/plcVerifier";

interface EventTimelineProps {
  result: VerificationResult | null;
  currentFrameIndex: number;
  onSelectFrame: (index: number) => void;
}

export default function EventTimeline({
  result,
  currentFrameIndex,
  onSelectFrame,
}: EventTimelineProps) {
  if (!result || !result.trace.length) return null;

  const trace = result.trace;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-xs shadow-xl">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Scan Cycle Execution Event Log</span>
        </span>
        <span className="text-[10px] text-slate-500">{trace.length} Frames Recorded</span>
      </div>

      <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 text-[11px]">
        {trace.map((frame, idx) => {
          const isSelected = idx === currentFrameIndex;
          const isCrash =
            !result.safe &&
            idx === trace.length - 1 &&
            result.collision_cycle !== null;

          // Generate summary of what changed or is active
          const activeOutputs = Object.entries(frame.outputs)
            .filter(([_, val]) => Boolean(val))
            .map(([k]) => k);
          const activeInputs = Object.entries(frame.inputs)
            .filter(([_, val]) => Boolean(val))
            .map(([k]) => k);

          return (
            <div
              key={idx}
              onClick={() => onSelectFrame(idx)}
              className={`p-2 rounded border cursor-pointer transition flex items-center justify-between ${
                isCrash
                  ? "border-rose-500/80 bg-rose-950/40 text-rose-200"
                  : isSelected
                  ? "border-amber-500/80 bg-amber-950/20 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                  : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700 text-slate-400"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isCrash
                      ? "bg-rose-600 text-white animate-pulse"
                      : isSelected
                      ? "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  C{frame.cycle}
                </span>
                <span className="text-slate-400 text-[10px]">{frame.timestamp_ms}ms</span>

                <div className="flex items-center space-x-1.5 text-[10px]">
                  {isCrash ? (
                    <span className="text-rose-400 font-bold">
                      ⚠️ HAZARD: {result.collision_coils.join(" + ")} Simultaneous Breach!
                    </span>
                  ) : (
                    <>
                      {activeOutputs.length > 0 && (
                        <span className="text-emerald-400">
                          OUT: {activeOutputs.join(", ")}
                        </span>
                      )}
                      {activeInputs.length > 0 && (
                        <span className="text-cyan-400">
                          IN: {activeInputs.join(", ")}
                        </span>
                      )}
                      {activeOutputs.length === 0 && activeInputs.length === 0 && (
                        <span className="text-slate-500 italic">Quiescent idle scan</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="text-[10px]">
                {isSelected ? (
                  <span className="text-amber-400 font-bold">CURRENT</span>
                ) : (
                  <span className="text-slate-600 hover:text-slate-400">VIEW</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
