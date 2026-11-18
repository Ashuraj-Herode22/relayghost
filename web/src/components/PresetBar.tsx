"use client";

import React, { useState } from "react";
import { BENCHMARKS } from "@/lib/benchmarkPresets";

interface PresetBarProps {
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
}

const PRIMARY_STATIONS = [
  {
    id: "known-errors/01_stamping_press_missing_interlock.xml",
    label: "Stamping Press",
    icon: "🔨",
    badge: "HAZARD",
    color: "crimson",
  },
  {
    id: "test-for-yourself/mystery_gamma_bottle_filler_latch.xml",
    label: "Bottling Line",
    icon: "🍾",
    badge: "RACE",
    color: "amber",
  },
  {
    id: "known-errors/err_01_conveyor_gate_bypass.xml",
    label: "Sorting Diverter",
    icon: "📦",
    badge: "PINCH",
    color: "amber",
  },
  {
    id: "known-errors/err_03_oven_purge_timer_skip.xml",
    label: "Curing Oven",
    icon: "🔥",
    badge: "SKIP",
    color: "crimson",
  },
  {
    id: "known-errors/err_02_dual_motor_reversal_short.xml",
    label: "480V Motor Bridge",
    icon: "⚡",
    badge: "SHORT",
    color: "crimson",
  },
  {
    id: "test-for-yourself/mystery_alpha_robot_handover.xml",
    label: "Dual Robot Cell",
    icon: "🤖",
    badge: "CRASH",
    color: "crimson",
  },
];

export default function PresetBar({
  selectedPresetId,
  onSelectPreset,
}: PresetBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Check if current selection is from the extra 4 benchmarks
  const currentSuiteBenchmark = BENCHMARKS.find(
    (b) => b.id === selectedPresetId && !PRIMARY_STATIONS.some((cs) => cs.id === b.id)
  );

  return (
    <div className="flex items-center space-x-1 p-1 rounded-full bg-[#0C0E14] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-x-auto max-w-full">
      {/* 6 Primary Industrial Machine Stations */}
      {PRIMARY_STATIONS.map((sc) => {
        const isSelected = selectedPresetId.includes(sc.id.split("/").pop() || "___");
        return (
          <button
            key={sc.id}
            onClick={() => onSelectPreset(sc.id)}
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-mono transition-all duration-150 flex items-center space-x-1.5 shrink-0 ${
              isSelected
                ? sc.color === "crimson"
                  ? "bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)] font-semibold"
                  : "bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)] font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            }`}
          >
            <span>{sc.icon}</span>
            <span className="hidden md:inline">{sc.label}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSelected
                  ? sc.color === "crimson"
                    ? "bg-rose-400 shadow-[0_0_6px_#f43f5e]"
                    : "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                  : "bg-slate-600"
              }`}
            />
          </button>
        );
      })}

      {/* Dropdown for 4 Verified Baselines & Edge-Cases */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-mono transition-all flex items-center space-x-1.5 ${
            currentSuiteBenchmark
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)] font-semibold"
              : showDropdown
              ? "bg-white/[0.08] text-white border border-white/[0.15]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
          title="Browse Formal Invariant Baselines & Edge Cases"
        >
          {currentSuiteBenchmark ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
          ) : null}
          <span className="truncate max-w-[130px]">
            {currentSuiteBenchmark ? currentSuiteBenchmark.name.split(":")[0] : "Verified & Tests"}
          </span>
          <svg className="w-3 h-3 text-slate-400" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute top-full mt-2 right-0 w-84 max-h-96 overflow-y-auto rounded-xl bg-[#0C0E14] border border-white/[0.12] shadow-2xl p-2 z-50 text-xs font-mono space-y-1">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Formal Baselines & Edge-Cases
              </div>

              <div className="text-[10px] text-emerald-400 font-semibold px-2 pt-1">
                Verified Safe Invariants (0 Hazards)
              </div>
              {BENCHMARKS.filter((b) => b.expectedSafe).map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectPreset(b.id);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                    selectedPresetId === b.id
                      ? "bg-emerald-950/60 text-emerald-200 border border-emerald-500/40"
                      : "text-slate-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="truncate pr-2">{b.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                    SAFE PROOF
                  </span>
                </button>
              ))}

              <div className="text-[10px] text-amber-400 font-semibold px-2 pt-2 border-t border-white/[0.06]">
                Asynchronous Glitch Scenarios
              </div>
              {BENCHMARKS.filter((b) => !b.expectedSafe && !PRIMARY_STATIONS.some((cs) => cs.id === b.id)).map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectPreset(b.id);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                    selectedPresetId === b.id
                      ? "bg-amber-950/60 text-amber-200 border border-amber-500/40"
                      : "text-slate-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="truncate pr-2">{b.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
                    DESYNC
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
