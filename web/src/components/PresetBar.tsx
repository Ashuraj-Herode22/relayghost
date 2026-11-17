"use client";

import React, { useRef } from "react";
import { BENCHMARKS, BenchmarkInfo } from "@/lib/benchmarkPresets";

interface PresetBarProps {
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  onUploadXml: (xmlContent: string, fileName: string) => void;
  onSynthesizePatch: () => void;
  canPatch: boolean;
  isLoading: boolean;
}

export default function PresetBar({
  selectedPresetId,
  onSelectPreset,
  onUploadXml,
  onSynthesizePatch,
  canPatch,
  isLoading,
}: PresetBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onUploadXml(content, file.name);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  const handleDownloadSample = () => {
    // Provide Mystery Gamma as an instant sample file to test custom uploading
    const sample = BENCHMARKS.find((b) => b.id.includes("mystery_gamma")) || BENCHMARKS[0];
    const blob = new Blob([sample.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_mystery_gamma_plc.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Preset Hero Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mr-1">
            Hero Presets:
          </span>

          <button
            onClick={() => onSelectPreset("known-errors/01_stamping_press_missing_interlock.xml")}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition ${
              selectedPresetId.includes("01_stamping_press")
                ? "bg-rose-950/70 border-rose-500/80 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                : "bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300"
            }`}
          >
            🔥 Preset 1: Stamping Press Crash
          </button>

          <button
            onClick={() => onSelectPreset("test-for-yourself/02_pneumatic_estop_timer_race.xml")}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition ${
              selectedPresetId.includes("02_pneumatic_estop")
                ? "bg-amber-950/70 border-amber-500/80 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300"
            }`}
          >
            ⚡ Preset 2: E-Stop Timer Race
          </button>

          <button
            onClick={() => onSelectPreset("test-for-yourself/03_rolls_royce_ears_interlock_baseline.xml")}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition ${
              selectedPresetId.includes("03_rolls_royce_ears")
                ? "bg-emerald-950/70 border-emerald-500/80 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                : "bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300"
            }`}
          >
            🛡️ Preset 3: Rolls-Royce EARS (Safe)
          </button>
        </div>

        {/* Synthesize Patch Button */}
        {canPatch && (
          <button
            onClick={onSynthesizePatch}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold border border-emerald-400 active:scale-95 transition shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse flex items-center space-x-1.5"
          >
            <span>⚡ Synthesize Dynamic EARS Interlock</span>
          </button>
        )}
      </div>

      {/* Second Row: Benchmark Suite Selector + Custom File Upload + Quick Download */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
        {/* Dropdown of all 10 benchmarks */}
        <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
          <span className="text-slate-400 text-[11px] uppercase tracking-wider">
            All 10 Benchmarks:
          </span>
          <select
            value={selectedPresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500 transition w-full max-w-md font-mono"
          >
            <optgroup label="Known Error Benchmarks (Hazards)">
              {BENCHMARKS.filter((b) => b.category === "known-errors").map((b) => (
                <option key={b.id} value={b.id}>
                  ⚠️ {b.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Test-For-Yourself Suite">
              {BENCHMARKS.filter((b) => b.category === "test-for-yourself").map((b) => (
                <option key={b.id} value={b.id}>
                  {b.expectedSafe ? "🛡️" : "⚡"} {b.name}
                </option>
              ))}
            </optgroup>
          </select>

          <a
            href="https://github.com/Ashuraj-Herode22/relayghost/tree/main/plc-benchmarks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 underline flex items-center space-x-1 ml-2 whitespace-nowrap"
            title="Benchmark Suite: Download sample IEC 61131-3 PLCopen XML programs from plc-benchmarks/ (known-errors/ and test-for-yourself/) to test temporal model checking"
          >
            <span>📂 Benchmark Suite</span>
            <span>↗</span>
          </a>
        </div>

        {/* Upload Custom XML & Download Sample */}
        <div className="flex items-center space-x-2">
          {/* Quick sample downloader to test upload */}
          <button
            onClick={handleDownloadSample}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded flex items-center space-x-1 transition active:scale-95 text-[11px]"
            title="Download sample IEC 61131-3 PLCopen XML program to test custom verification pipeline"
          >
            <span>📥 Sample .xml</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xml,.plcopen"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded flex items-center space-x-1.5 transition active:scale-95"
          >
            <span>📁 Upload PLCopen XML</span>
          </button>

          {isLoading && (
            <span className="text-amber-400 font-semibold animate-pulse flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Verifying...</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
