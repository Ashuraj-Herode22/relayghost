"use client";

import React, { useEffect, useState, useRef } from "react";
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
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [slowMo, setSlowMo] = useState<boolean>(true); // 0.25x slow-mo default for high-impact visual clarity
  const [loopCrash, setLoopCrash] = useState<boolean>(true);

  const trace = result?.trace || [];
  const maxFrames = Math.max(0, trace.length - 1);
  const currentFrame = trace[currentFrameIndex];
  const isHazard = Boolean(result && !result.safe);
  const holdTicksRef = useRef<number>(0);

  // Auto-start playback on new result
  useEffect(() => {
    if (result && trace.length > 0) {
      setIsPlaying(true);
      holdTicksRef.current = 0;
      onFrameChange(0);
    }
  }, [result]);

  // Playback timer with cinematic crash hold
  useEffect(() => {
    if (!isPlaying || maxFrames === 0) return;

    const intervalMs = slowMo ? 650 : 220; // 0.25x slow-motion vs 1.0x
    const timer = setInterval(() => {
      onFrameChange((prev) => {
        if (prev >= maxFrames) {
          if (loopCrash) {
            // On a hazard breach, hold on the collision frame for 2 extra ticks (~1.3s)
            // so the user can inspect the impact, spark burst, and alarm
            if (isHazard && holdTicksRef.current < 2) {
              holdTicksRef.current++;
              return maxFrames;
            }
            holdTicksRef.current = 0;
            return 0; // Loop back to start
          }
          setIsPlaying(false);
          return maxFrames;
        }
        holdTicksRef.current = 0;
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, maxFrames, slowMo, loopCrash, isHazard, onFrameChange]);

  if (!result || trace.length === 0) {
    return (
      <div className="p-3 rounded-2xl bg-[#0C0E14]/90 border border-white/[0.08] text-center text-xs font-mono text-slate-500">
        Replay scrubber standby. Select a scenario above to inspect temporal cycles.
      </div>
    );
  }

  const handleJumpToHazard = () => {
    setIsPlaying(false);
    onFrameChange(maxFrames);
  };

  return (
    <div className="rounded-2xl bg-[#0C0E14]/95 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-3 space-y-2.5 font-mono text-xs">
      {/* Top Scrubber Track */}
      <div className="flex items-center space-x-3">
        {/* Play/Pause Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 ${
            isPlaying
              ? "bg-white text-slate-950 hover:bg-slate-200"
              : isHazard
              ? "bg-rose-500 text-white hover:bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
              : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
          }`}
          title={isPlaying ? "Pause replay" : "Play loop"}
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
              <rect x="3" y="2" width="3.5" height="12" rx="1" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current translate-x-0.5" viewBox="0 0 16 16">
              <path d="M4 2.5v11l9-5.5-9-5.5z" />
            </svg>
          )}
        </button>

        {/* Step Backward */}
        <button
          onClick={() => {
            setIsPlaying(false);
            onFrameChange(Math.max(0, currentFrameIndex - 1));
          }}
          disabled={currentFrameIndex === 0}
          className="text-slate-400 hover:text-white disabled:opacity-30 p-1 transition shrink-0"
          title="Step back 1 cycle"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
            <path d="M12.5 3v10L5 8l7.5-5zm-8 0h-2v10h2V3z" />
          </svg>
        </button>

        {/* Step Forward */}
        <button
          onClick={() => {
            setIsPlaying(false);
            onFrameChange(Math.min(maxFrames, currentFrameIndex + 1));
          }}
          disabled={currentFrameIndex >= maxFrames}
          className="text-slate-400 hover:text-white disabled:opacity-30 p-1 transition shrink-0"
          title="Step forward 1 cycle"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
            <path d="M3.5 3v10L11 8 3.5 3zm8 0h2v10h-2V3z" />
          </svg>
        </button>

        {/* Interactive Step-Node Timeline Track */}
        <div className="flex-1 flex items-center space-x-1.5 px-2">
          {trace.map((frame, idx) => {
            const isCurrent = idx === currentFrameIndex;
            const isBreach = isHazard && idx === maxFrames;

            return (
              <button
                key={idx}
                onClick={() => {
                  setIsPlaying(false);
                  onFrameChange(idx);
                }}
                className="flex-1 group py-2 focus:outline-none flex flex-col items-center"
                title={`Cycle #${frame.cycle} (${frame.timestamp_ms}ms)`}
              >
                <div
                  className={`w-full rounded-full transition-all ${
                    isBreach
                      ? isCurrent
                        ? "h-2 bg-rose-500 shadow-[0_0_12px_#ef4444] ring-2 ring-rose-400"
                        : "h-1.5 bg-rose-500/80 shadow-[0_0_8px_#ef4444]"
                      : isCurrent
                      ? result.safe
                        ? "h-2 bg-emerald-400 shadow-[0_0_10px_#10b981] ring-2 ring-emerald-300"
                        : "h-2 bg-amber-400 shadow-[0_0_10px_#f59e0b] ring-2 ring-amber-300"
                      : idx < currentFrameIndex
                      ? "h-1.5 bg-white/30"
                      : "h-1.5 bg-white/10 group-hover:bg-white/20"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Current Time Readout */}
        <div className="text-[11px] tabular-nums text-slate-300 font-semibold whitespace-nowrap min-w-[95px] text-right shrink-0">
          C{String(currentFrame?.cycle ?? 0).padStart(2, "0")} · {currentFrame?.timestamp_ms ?? 0}ms
        </div>
      </div>

      {/* Bottom Sub-Bar: Speed, Loop & Breakpoint Jump */}
      <div className="flex flex-wrap items-center justify-between pt-1 border-t border-white/[0.05] text-[11px] gap-2">
        <div className="flex items-center space-x-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isHazard ? "bg-rose-500" : "bg-emerald-400"}`} />
          <span className="text-slate-400">
            {isHazard ? (
              <span className="text-rose-400 font-semibold">
                Hazard at Cycle #{result.collision_cycle} ({result.collision_coils.join(" + ")})
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold">
                100% Invariant Safe ({result.states_explored} states)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Loop Toggle */}
          <button
            onClick={() => setLoopCrash(!loopCrash)}
            className={`px-2 py-0.5 rounded-md transition text-[10px] ${
              loopCrash ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {loopCrash ? "🔁 Loop" : "Once"}
          </button>

          {/* Speed Toggle */}
          <button
            onClick={() => setSlowMo(!slowMo)}
            className={`px-2 py-0.5 rounded-md transition text-[10px] font-semibold ${
              slowMo
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-white/[0.06] text-slate-300 hover:text-white"
            }`}
            title="Toggle playback speed"
          >
            {slowMo ? "0.25x Slow-Mo" : "1.0x Realtime"}
          </button>

          {/* Jump to Breakpoint */}
          {isHazard && (
            <button
              onClick={handleJumpToHazard}
              className="px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 text-[10px] font-bold transition flex items-center space-x-1"
            >
              <span>⚠ Jump to Crash</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
