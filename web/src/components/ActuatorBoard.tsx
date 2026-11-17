"use client";

import React from "react";
import { ReplayFrame } from "@/lib/plcVerifier";

interface ActuatorBoardProps {
  currentFrame?: ReplayFrame;
}

const ACTUATOR_DEFS = [
  { addr: "%QX0.0", name: "Hydraulic Press Ram", icon: "🔨" },
  { addr: "%QX0.1", name: "Robotic Feeder Arm", icon: "🦾" },
  { addr: "%QX0.2", name: "Feed Conveyor", icon: "📦" },
  { addr: "%QX0.3", name: "Diverter Clamp", icon: "🗜️" },
  { addr: "%QX0.4", name: "Relief Pump / Valve", icon: "⚙️" },
  { addr: "%QX0.5", name: "Safety Strobe Beacon", icon: "🚨" },
];

const SENSOR_DEFS = [
  { addr: "%IX0.0", name: "Part Photoeye" },
  { addr: "%IX0.1", name: "Press Retract LS" },
  { addr: "%IX0.2", name: "Arm Home Sensor" },
  { addr: "%IX0.3", name: "Safety Light Curtain" },
  { addr: "%IX0.4", name: "E-Stop PB" },
  { addr: "%IX0.5", name: "Cycle Start PB" },
  { addr: "%IX0.6", name: "Gate Interlock" },
  { addr: "%IX0.7", name: "Fault Reset PB" },
];

export default function ActuatorBoard({ currentFrame }: ActuatorBoardProps) {
  const outputs = currentFrame?.outputs || {};
  const inputs = currentFrame?.inputs || {};

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3 font-mono text-xs">
      {/* Actuators (%QX) */}
      <div>
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Universal Actuators (%QX0.0 – %QX0.5)</span>
          </span>
          <span className="text-[10px] text-slate-500">Field Bus Outputs</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ACTUATOR_DEFS.map((act) => {
            const isActive = Boolean(outputs[act.addr]);
            return (
              <div
                key={act.addr}
                className={`p-2 rounded border transition-all flex flex-col justify-between ${
                  isActive
                    ? "border-amber-500/80 bg-amber-950/30 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                    : "border-slate-800 bg-slate-900/60 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold">{act.addr}</span>
                  <span>{act.icon}</span>
                </div>
                <div className="text-[10px] truncate text-slate-300 font-sans">{act.name}</div>
                <div className="mt-1 flex items-center justify-between text-[9px] font-bold">
                  <span className={isActive ? "text-amber-400" : "text-slate-600"}>
                    {isActive ? "ACTIVE" : "OFF"}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]" : "bg-slate-700"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sensors (%IX) */}
      <div>
        <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800/60">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Discrete Field Sensors (%IX0.0 – %IX0.7)</span>
          </span>
          <span className="text-[9px] text-slate-500">Scan Input Bus</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-[10px]">
          {SENSOR_DEFS.map((s) => {
            const isHigh = Boolean(inputs[s.addr]);
            return (
              <div
                key={s.addr}
                className={`px-1.5 py-1 rounded border text-center transition ${
                  isHigh
                    ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300 font-bold"
                    : "border-slate-800/80 bg-slate-900/40 text-slate-500"
                }`}
                title={`${s.addr}: ${s.name} (${isHigh ? "HIGH" : "LOW"})`}
              >
                <div>{s.addr}</div>
                <div className={`text-[8px] mt-0.5 ${isHigh ? "text-emerald-400" : "text-slate-600"}`}>
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
