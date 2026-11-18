"use client";

import React, { useState } from "react";
import { BENCHMARKS } from "@/lib/benchmarkPresets";

interface PresetBarProps {
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
}

const CORE_SCENARIOS = [
  {
    id: "known-errors/01_stamping_press_missing_interlock.xml",
    label: "01 · Stamping Press",
    sub: "Known Defect",
    badge: "HAZARD",
    color: "crimson",
  },
  {
    id: "test-for-yourself/02_pneumatic_estop_timer_race.xml",
    label: "02 · E-Stop Race",
    sub: "Edge-Case",
    badge: "RACE",
    color: "amber",
  },
  {
    id: "test-for-yourself/03_rolls_royce_ears_interlock_baseline.xml",
    label: "03 · Rolls-Royce Baseline",
    sub: "Verified Safe",
    badge: "SAFE",
    color: "emerald",
  },
];

export default function PresetBar({
  selectedPresetId,
  onSelectPreset,
}: PresetBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Check if current selection is from the extra 7 benchmarks
  const currentSuiteBenchmark = BENCHMARKS.find(
    (b) => b.id === selectedPresetId && !CORE_SCENARIOS.some((cs) => cs.id === b.id)
  );

  return (
    <div className="flex items-center space-x-1.5 p-1 rounded-full bg-[#0C0E14] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      {/* 3 Core Segmented Scenario Buttons */}
      {CORE_SCENARIOS.map((sc) => {
        const isSelected = selectedPresetId.includes(sc.id.split("/").pop() || "___");
        return (
          <button
            key={sc.id}
            onClick={() => onSelectPreset(sc.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-150 flex items-center space-x-1.5 shrink-0 ${
              isSelected
                ? sc.color === "crimson"
                  ? "bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)] font-semibold"
                  : sc.color === "amber"
                  ? "bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)] font-semibold"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)] font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSelected
                  ? sc.color === "crimson"
                    ? "bg-rose-400 shadow-[0_0_6px_#f43f5e]"
                    : sc.color === "amber"
                    ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                    : "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                  : "bg-slate-600"
              }`}
            />
            <span>{sc.label}</span>
          </button>
        );
      })}

      {/* Dropdown for Remaining 7 Benchmarks */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all flex items-center space-x-1.5 shrink-0 ${
            currentSuiteBenchmark
              ? "bg-violet-950/80 text-violet-300 border border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.3)] font-semibold"
              : showDropdown
              ? "bg-white/[0.08] text-white border border-white/[0.15]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
          title="Browse all 10 IEC 61131-3 benchmark programs"
        >
          {currentSuiteBenchmark ? (
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_#8b5cf6]" />
          ) : null}
          <span className="truncate max-w-[120px]">
            {currentSuiteBenchmark ? currentSuiteBenchmark.name.split(":")[0] : "Suite (10)"}
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
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-80 max-h-96 overflow-y-auto rounded-xl bg-[#0C0E14] border border-white/[0.12] shadow-2xl p-2 z-50 text-xs font-mono space-y-1">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Full IEC 61131-3 Benchmark Suite
              </div>

              <div className="text-[10px] text-rose-400 font-semibold px-2 pt-1">
                Known Errors (7 Hazards)
              </div>
              {BENCHMARKS.filter((b) => !b.expectedSafe).map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectPreset(b.id);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                    selectedPresetId === b.id
                      ? "bg-rose-950/60 text-rose-200 border border-rose-500/40"
                      : "text-slate-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="truncate pr-2">{b.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold shrink-0">
                    FAIL #4
                  </span>
                </button>
              ))}

              <div className="text-[10px] text-emerald-400 font-semibold px-2 pt-2 border-t border-white/[0.06]">
                Verified Safe Invariants (3 Baselines)
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
                    PASS 100%
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
