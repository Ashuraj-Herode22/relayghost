"use client";

import React, { useEffect, useState } from "react";
import { ReplayFrame, VerificationResult } from "@/lib/plcVerifier";

interface ScrubberPlayerProps {
  result: VerificationResult | null;
  currentFrameIndex: number;
  onFrameChange: (indexOrUpdater: number | ((prev: number) => number)) => void;
}

export default function ScrubberPlayer({
  result,
  currentFrameIndex,
  onFrameChange,
}: ScrubberPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true); // Auto-play enabled by default
  const [slowMo, setSlowMo] = useState<boolean>(true); // 0.25x slow-motion for dramatic crash inspection
  const [loopCrash, setLoopCrash] = useState<boolean>(true); // Auto-loop crash clip

  const trace = result?.trace || [];
  const maxFrames = Math.max(0, trace.length - 1);
  const currentFrame = trace[currentFrameIndex];
  const isHazard = Boolean(result && !result.safe);
  const isCrashFrame = Boolean(
    isHazard && currentFrameIndex === maxFrames && result?.collision_cycle !== null
  );

  // Auto-start slow-mo loop when a new result arrives
  useEffect(() => {
    if (result && trace.length > 0) {
      setIsPlaying(true);
      onFrameChange(0);
    }
  }, [result]);

  // Playback timer loop with auto-looping crash highlight
  useEffect(() => {
    if (!isPlaying || maxFrames === 0) return;

    const intervalMs = slowMo ? 750 : 250; // 0.25x slow-motion vs 1.0x
    const timer = setInterval(() => {
      onFrameChange((prev) => {
        if (prev >= maxFrames) {
          if (loopCrash) {
            return 0; // Seamless video-like crash replay loop
          }
          setIsPlaying(false);
          return maxFrames;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, maxFrames, slowMo, loopCrash, onFrameChange]);

  if (!result || trace.length === 0) {
    return (
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-center text-xs font-mono text-slate-500">
        Load or verify a PLC program to activate the scan-cycle replay player.
      </div>
    );
  }

  const handleJumpToHazard = () => {
    setIsPlaying(false);
    onFrameChange(maxFrames);
  };

  const handleReset = () => {
    setIsPlaying(false);
    onFrameChange(0);
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    onFrameChange(Math.max(0, currentFrameIndex - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    onFrameChange(Math.min(maxFrames, currentFrameIndex + 1));
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 shadow-xl">
      {/* Top Status Banner */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          {result.safe ? (
            <span className="flex items-center text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-1 rounded">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              100% INVARIANT SAFE — {result.states_explored} STATES EXPLORED
            </span>
          ) : (
            <span className="flex items-center text-xs font-mono font-bold text-rose-400 bg-rose-950/50 border border-rose-500/60 px-2.5 py-1 rounded animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
              HAZARD AT CYCLE #{result.collision_cycle} (
              {result.collision_coils.join(" + ")})
            </span>
          )}
        </div>

        <div className="text-xs font-mono text-slate-400 flex items-center space-x-2">
          {isHazard && (
            <span className="text-[10px] bg-rose-900/40 text-rose-300 border border-rose-600/40 px-1.5 py-0.5 rounded font-bold uppercase">
              Isolated Replay Loop
            </span>
          )}
          <span>
            Cycle <span className="text-white font-bold">{currentFrame?.cycle ?? 0}</span> /{" "}
            <span>{trace[maxFrames]?.cycle ?? 0}</span> ({currentFrame?.timestamp_ms ?? 0} ms)
          </span>
        </div>
      </div>

      {/* Scrubber Range Slider */}
      <div className="space-y-1.5">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={maxFrames}
            value={currentFrameIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onFrameChange(Number(e.target.value));
            }}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all"
          />
        </div>

        {/* Timeline Frame Step Indicators */}
        <div className="flex justify-between items-center px-1">
          {trace.map((frame, idx) => {
            const isHazardEnd = isHazard && idx === maxFrames;
            const isCurrent = idx === currentFrameIndex;

            return (
              <button
                key={idx}
                onClick={() => {
                  setIsPlaying(false);
                  onFrameChange(idx);
                }}
                title={`Jump to Cycle #${frame.cycle} (${frame.timestamp_ms}ms)`}
                className={`group flex flex-col items-center transition-all ${
                  isCurrent ? "scale-125" : "opacity-70 hover:opacity-100"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isHazardEnd
                      ? "bg-rose-500 ring-2 ring-rose-400 animate-ping"
                      : isCurrent
                      ? "bg-amber-400 ring-2 ring-amber-300 shadow-[0_0_8px_#f59e0b]"
                      : "bg-slate-600 hover:bg-slate-400"
                  }`}
                />
                <span
                  className={`text-[9px] font-mono mt-1 ${
                    isCurrent ? "text-amber-400 font-bold" : "text-slate-500"
                  }`}
                >
                  C{frame.cycle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Buttons & Replay Speed */}
      <div className="flex flex-wrap items-center justify-between pt-2 gap-2">
        <div className="flex items-center space-x-1.5 font-mono text-xs">
          {/* Reset */}
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 active:scale-95 transition"
            title="Reset to Start (Cycle 0)"
          >
            ⏮ Reset
          </button>

          {/* Step Back */}
          <button
            onClick={handleStepBack}
            disabled={currentFrameIndex === 0}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded border border-slate-700 active:scale-95 transition"
            title="Step Back 1 Cycle"
          >
            ◀ Step
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-1.5 rounded font-bold transition active:scale-95 shadow ${
              isPlaying
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play Loop"}
          </button>

          {/* Step Forward */}
          <button
            onClick={handleStepForward}
            disabled={currentFrameIndex >= maxFrames}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded border border-slate-700 active:scale-95 transition"
            title="Step Forward 1 Cycle"
          >
            Step ▶
          </button>
        </div>

        {/* Speed, Auto-Loop Toggle & Jump to Hazard */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          {/* Loop toggle */}
          <button
            onClick={() => setLoopCrash(!loopCrash)}
            className={`px-2 py-1.5 rounded border transition text-[11px] ${
              loopCrash
                ? "bg-cyan-950/60 border-cyan-500/60 text-cyan-300"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
            title="Auto-repeat replay in loop"
          >
            🔁 {loopCrash ? "Loop On" : "Once"}
          </button>

          {/* Slow-mo toggle */}
          <button
            onClick={() => setSlowMo(!slowMo)}
            className={`px-2.5 py-1.5 rounded border transition text-[11px] font-semibold ${
              slowMo
                ? "bg-amber-950/60 border-amber-500/60 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle 0.25x Slow-Motion Replay"
          >
            ⚡ {slowMo ? "0.25x Slow-Mo" : "1.0x Realtime"}
          </button>

          {/* Jump to Hazard Button */}
          {isHazard && (
            <button
              onClick={handleJumpToHazard}
              className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded font-bold border border-rose-400 active:scale-95 transition shadow-[0_0_12px_rgba(244,63,94,0.4)]"
              title="Jump directly to crash cycle"
            >
              ⚠ Hazard Frame
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
