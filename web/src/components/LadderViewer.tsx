"use client";

import React from "react";
import { Rung, ReplayFrame } from "@/lib/plcVerifier";

interface LadderViewerProps {
  rungs: Rung[];
  currentFrame?: ReplayFrame;
  faultRungIds: number[];
  isCrashFrame: boolean;
}

export default function LadderViewer({
  rungs,
  currentFrame,
  faultRungIds,
  isCrashFrame,
}: LadderViewerProps) {
  if (!rungs || rungs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-slate-500 font-mono text-sm border border-slate-800 rounded-lg bg-slate-950/60">
        No PLC Ladder Logic loaded. Select a benchmark or upload PLCopen XML.
      </div>
    );
  }

  const energizedRungs = new Set(currentFrame?.energized_rungs || []);
  const outputs = currentFrame?.outputs || {};
  const inputs = currentFrame?.inputs || {};

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
            IEC 61131-3 Live Power-Flow Ladder Diagram
          </h3>
        </div>
        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
            Conduction
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-cyan-400 mr-1.5" />
            EARS Interlock
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
            Hazard Fault
          </span>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs select-none">
        {rungs.map((rung) => {
          const isFault = isCrashFrame && faultRungIds.includes(rung.rung_id);
          const isEnergized = energizedRungs.has(rung.rung_id);
          const isCoilActive = Boolean(outputs[rung.output_target]);

          return (
            <div
              key={rung.rung_id}
              className={`relative rounded-md border transition-all duration-200 ${
                isFault
                  ? "border-rose-500/80 bg-rose-950/30 shadow-[0_0_20px_rgba(244,63,94,0.25)] animate-pulse"
                  : rung.isNewInterlock
                  ? "border-cyan-500/60 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                  : isEnergized
                  ? "border-emerald-500/40 bg-emerald-950/10 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                  : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700"
              } p-3.5`}
            >
              {/* Rung metadata bar */}
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/60 text-[11px]">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold ${
                      isFault
                        ? "bg-rose-500 text-white"
                        : rung.isNewInterlock
                        ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/60"
                        : isEnergized
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    RUNG #{rung.rung_id}
                  </span>
                  <span className="text-slate-300 font-medium">
                    {rung.name || `Control Rung ${rung.rung_id}`}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {rung.isNewInterlock && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-bold tracking-wider uppercase animate-pulse">
                      ✨ Synthesized EARS Interlock
                    </span>
                  )}
                  {isFault && (
                    <span className="px-2 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-bold tracking-wider uppercase animate-bounce">
                      ⚠ Hazard Trigger Rung
                    </span>
                  )}
                </div>
              </div>

              {/* Rung Schematic */}
              <div className="flex items-center justify-between relative py-2">
                {/* Left Power Rail (L1) */}
                <div
                  className={`w-1.5 rounded-full transition-colors ${
                    isEnergized ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-700"
                  }`}
                  style={{ height: `${Math.max(64, rung.branches.length * 48)}px` }}
                  title="Power Rail L1"
                />

                {/* Contacts & Branches (Render ALL parallel branches) */}
                <div className="flex-1 flex flex-col justify-center space-y-2 px-3">
                  {rung.branches.map((branch, bIdx) => (
                    <div key={bIdx} className="flex items-center space-x-2">
                      {/* Parallel branch label if multiple */}
                      {rung.branches.length > 1 && (
                        <span className="text-[9px] text-slate-500 font-bold w-7">
                          OR#{bIdx + 1}
                        </span>
                      )}

                      {/* Branch line lead */}
                      <div
                        className={`h-0.5 w-3 transition-colors ${
                          isEnergized ? "bg-emerald-400" : "bg-slate-700"
                        }`}
                      />

                      {/* Contacts in series */}
                      {branch.map(([address, isNC], cIdx) => {
                        // Check if contact evaluates to closed/conductive
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

                        return (
                          <div key={cIdx} className="flex items-center space-x-2">
                            <div
                              className={`px-2 py-1 rounded border flex flex-col items-center min-w-[70px] transition-all ${
                                isSynthesizedGuard
                                  ? "border-cyan-400 bg-cyan-950/50 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                                  : contactClosed
                                  ? "border-emerald-500/70 bg-emerald-950/30 text-emerald-300"
                                  : "border-slate-800 bg-slate-900/80 text-slate-400"
                              }`}
                            >
                              <div className="flex items-center space-x-1">
                                <span className="text-[10px] font-bold">
                                  {isNC ? "[ / ]" : "[   ]"}
                                </span>
                                {isSynthesizedGuard && (
                                  <span className="text-[8px] bg-cyan-500 text-slate-950 px-1 rounded font-bold">
                                    EARS
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] truncate max-w-[85px] text-slate-200 font-mono font-semibold">
                                {address}
                              </span>
                              <span
                                className={`text-[8px] font-semibold uppercase ${
                                  contactClosed ? "text-emerald-400" : "text-slate-500"
                                }`}
                              >
                                {contactClosed ? "CLOSED" : "OPEN"}
                              </span>
                            </div>
                            {/* Intermediate wire */}
                            {cIdx < branch.length - 1 && (
                              <div
                                className={`h-0.5 w-3 transition-colors ${
                                  contactClosed ? "bg-emerald-400" : "bg-slate-700"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* Line connecting to coil */}
                      <div
                        className={`h-0.5 flex-1 transition-colors ${
                          isEnergized ? "bg-emerald-400" : "bg-slate-700"
                        }`}
                      />
                    </div>
                  ))}
                </div>

                {/* Coil / Output Element */}
                <div className="flex items-center space-x-2 pl-2">
                  <div
                    className={`px-3 py-1.5 rounded-md border flex flex-col items-center min-w-[90px] transition-all ${
                      isFault
                        ? "border-rose-500 bg-rose-950/60 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                        : isCoilActive || isEnergized
                        ? "border-emerald-500 bg-emerald-950/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                        : "border-slate-800 bg-slate-900 text-slate-400"
                    }`}
                  >
                    <span className="text-xs font-bold">
                      {rung.output_type === "TON"
                        ? `[TON ${rung.preset_ms}ms]`
                        : rung.output_type === "TOF"
                        ? `[TOF ${rung.preset_ms}ms]`
                        : rung.output_type === "CTU"
                        ? `[CTU PV:${rung.preset_count || 5}]`
                        : rung.output_type === "OTL"
                        ? "( L )"
                        : rung.output_type === "OTU"
                        ? "( U )"
                        : "(   )"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-200 mt-0.5">
                      {rung.output_target}
                    </span>
                    <span
                      className={`text-[8px] uppercase font-semibold ${
                        isCoilActive || isEnergized ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {isCoilActive || isEnergized ? "ENERGIZED" : "DE-ENERGIZED"}
                    </span>
                  </div>

                  {/* Wire to Right Rail */}
                  <div
                    className={`h-0.5 w-3 transition-colors ${
                      isEnergized ? "bg-emerald-400" : "bg-slate-700"
                    }`}
                  />

                  {/* Right Power Rail (L2 / Neutral) */}
                  <div
                    className={`w-1.5 rounded-full transition-colors ${
                      isEnergized ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-700"
                    }`}
                    style={{ height: `${Math.max(64, rung.branches.length * 48)}px` }}
                    title="Power Rail L2"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
