"use client";

import React from "react";
import { ReplayFrame } from "@/lib/plcVerifier";

interface ActuatorBoardProps {
  currentFrame?: ReplayFrame;
}

const ACTUATOR_DEFS = [
  { addr: "%QX0.0", name: "Press Ram", icon: "🔨" },
  { addr: "%QX0.1", name: "Transfer Arm", icon: "🦾" },
  { addr: "%QX0.2", name: "Conveyor", icon: "📦" },
  { addr: "%QX0.3", name: "Clamp", icon: "🗜️" },
  { addr: "%QX0.4", name: "Relief Valve", icon: "⚙️" },
  { addr: "%QX0.5", name: "Beacon", icon: "🚨" },
];

const SENSOR_DEFS = [
  { addr: "%IX0.0", name: "Part PE" },
  { addr: "%IX0.1", name: "Ram LS" },
  { addr: "%IX0.2", name: "Arm Home" },
  { addr: "%IX0.3", name: "Curtain" },
  { addr: "%IX0.4", name: "E-Stop" },
  { addr: "%IX0.5", name: "Start PB" },
  { addr: "%IX0.6", name: "Gate" },
  { addr: "%IX0.7", name: "Reset" },
];

export default function ActuatorBoard({ currentFrame }: ActuatorBoardProps) {
  const outputs = currentFrame?.outputs || {};
  const inputs = currentFrame?.inputs || {};

  return (
    <div className="rounded-2xl bg-[#0C0E14] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] px-4 py-2.5 font-mono text-xs flex flex-wrap items-center justify-between gap-4">
      {/* Left: 6 Universal Actuators */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Actuators (%QX):</span>
        </div>

        <div className="flex items-center space-x-1.5">
          {ACTUATOR_DEFS.map((act) => {
            const isActive = Boolean(outputs[act.addr]);
            return (
              <div
                key={act.addr}
                className={`px-2 py-1 rounded-lg border transition-all duration-150 flex items-center space-x-1.5 ${
                  isActive
                    ? "border-amber-500/70 bg-amber-950/40 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
                    : "border-white/[0.06] bg-[#090C12] text-slate-400"
                }`}
                title={`${act.addr}: ${act.name} (${isActive ? "ACTIVE" : "OFF"})`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]" : "bg-slate-700"
                  }`}
                />
                <span className="font-bold text-[11px]">{act.addr}</span>
                <span className="text-[10px] text-slate-300 hidden md:inline">{act.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center Divider on large screens */}
      <div className="hidden xl:block w-[1px] h-5 bg-white/[0.08]" />

      {/* Right: 8 Discrete Sensors */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Sensors (%IX):</span>
        </div>

        <div className="flex items-center space-x-1">
          {SENSOR_DEFS.map((s) => {
            const isHigh = Boolean(inputs[s.addr]);
            return (
              <div
                key={s.addr}
                className={`px-1.5 py-1 rounded-md border text-center transition-all ${
                  isHigh
                    ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200 font-bold shadow-[0_0_6px_rgba(16,185,129,0.2)]"
                    : "border-white/[0.04] bg-[#090C12] text-slate-500"
                }`}
                title={`${s.addr}: ${s.name} (${isHigh ? "1 / HIGH" : "0 / LOW"})`}
              >
                <div className="text-[9px]">{s.addr.replace("%IX0.", "I.")}</div>
                <div className={`text-[8px] font-bold ${isHigh ? "text-emerald-400" : "text-slate-600"}`}>
                  {isHigh ? "1" : "0"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
