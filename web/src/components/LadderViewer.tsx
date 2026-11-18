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
      <div className="h-full flex items-center justify-center p-8 text-slate-500 font-mono text-xs rounded-2xl bg-[#0C0E14] border border-white/[0.08]">
        No PLC Ladder Logic loaded. Select a scenario above to inspect live rungs.
      </div>
    );
  }

  const energizedRungs = new Set(currentFrame?.energized_rungs || []);
  const outputs = currentFrame?.outputs || {};
  const inputs = currentFrame?.inputs || {};

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#0C0E14] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden">
      {/* CAD Schematic Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.08] bg-[#0A0D14]/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h3 className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Live Power-Flow Schematic
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">({rungs.length} Rungs)</span>
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
              {/* Rung Header Bar */}
              <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/[0.05] text-[11px]">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
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
                  <span className="text-slate-300 font-medium text-[11px] truncate max-w-[200px]">
                    {rung.name || `Control Rung ${rung.rung_id}`}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
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

              {/* Electrical Ladder Power Rails & Contacts (overflow-x-auto for zero clipping) */}
              <div className="overflow-x-auto py-1">
                <div className="flex items-center justify-between min-w-[360px] relative">
                  {/* L1 Power Rail (Left 24V DC) */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[8px] text-slate-500 mb-0.5 font-bold">L1</span>
                    <div
                      className={`w-1 rounded-full transition-colors ${
                        isEnergized ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "bg-slate-700"
                      }`}
                      style={{ height: `${Math.max(46, rung.branches.length * 40)}px` }}
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

                          return (
                            <div key={cIdx} className="flex items-center space-x-1 shrink-0">
                              <div
                                className={`px-1.5 py-0.5 rounded-lg border flex flex-col items-center min-w-[62px] transition-all ${
                                  isSynthesizedGuard
                                    ? "border-violet-500/70 bg-violet-950/40 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                                    : contactClosed
                                    ? "border-amber-500/60 bg-amber-950/30 text-amber-200 shadow-[0_0_6px_rgba(245,158,11,0.2)]"
                                    : "border-white/[0.06] bg-[#0C0F17] text-slate-400"
                                }`}
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
                                <span className="text-[9px] truncate max-w-[75px] text-slate-200 font-mono font-semibold">
                                  {address}
                                </span>
                                <span
                                  className={`text-[7px] font-bold uppercase ${
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
                      className={`px-2 py-1 rounded-lg border flex flex-col items-center min-w-[80px] transition-all ${
                        isFault
                          ? "border-rose-500 bg-rose-950/60 text-rose-200 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                          : isCoilActive || isEnergized
                          ? "border-amber-500/70 bg-amber-950/40 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
                          : "border-white/[0.06] bg-[#0C0F17] text-slate-400"
                      }`}
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
                      <span
                        className={`text-[8px] uppercase font-bold ${
                          isCoilActive || isEnergized ? "text-amber-400" : "text-slate-500"
                        }`}
                      >
                        {isCoilActive || isEnergized ? "ACTIVE" : "OFF"}
                      </span>
                    </div>

                    {/* Wire to Right Rail */}
                    <div
                      className={`h-[2px] w-2 transition-colors ${
                        isEnergized ? "bg-amber-400 animate-wire-flow" : "bg-slate-700"
                      }`}
                    />

                    {/* L2 Power Rail (Right Neutral) */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[8px] text-slate-500 mb-0.5 font-bold">L2</span>
                      <div
                        className={`w-1 rounded-full transition-colors ${
                          isEnergized ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "bg-slate-700"
                        }`}
                        style={{ height: `${Math.max(46, rung.branches.length * 40)}px` }}
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
