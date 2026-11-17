"use client";

import React, { useState, useEffect } from "react";
import WorkcellCanvas from "@/components/WorkcellCanvas";
import LadderViewer from "@/components/LadderViewer";
import ScrubberPlayer from "@/components/ScrubberPlayer";
import PresetBar from "@/components/PresetBar";
import ActuatorBoard from "@/components/ActuatorBoard";
import VerificationReport from "@/components/VerificationReport";
import EventTimeline from "@/components/EventTimeline";
import { BENCHMARKS } from "@/lib/benchmarkPresets";
import {
  parsePlcopenXml,
  executeModelChecker,
  patchLadderLogicWithInterlocks,
  Rung,
  VerificationResult,
} from "@/lib/plcVerifier";

export default function Home() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    "known-errors/01_stamping_press_missing_interlock.xml"
  );
  const [currentRungs, setCurrentRungs] = useState<Rung[]>([]);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sourceName, setSourceName] = useState<string>(
    "Preset 1: Stamping Press Missing Interlock"
  );

  // Load and verify a preset or XML string
  const loadAndVerify = (xml: string, label: string) => {
    setIsLoading(true);
    try {
      const rungs = parsePlcopenXml(xml);
      setCurrentRungs(rungs);
      const result = executeModelChecker(rungs);
      setVerificationResult(result);
      // Auto-seek to crash frame if hazard, or frame 0 if safe
      const initialFrame = !result.safe && result.trace.length > 0 ? result.trace.length - 1 : 0;
      setCurrentFrameIndex(initialFrame);
      setSourceName(label);
    } catch (err: any) {
      console.error("Verification failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const defaultPreset = BENCHMARKS.find((b) => b.id === selectedPresetId) || BENCHMARKS[0];
    if (defaultPreset) {
      loadAndVerify(defaultPreset.xml, defaultPreset.name);
    }
  }, []);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = BENCHMARKS.find((b) => b.id === presetId);
    if (found) {
      loadAndVerify(found.xml, found.name);
    }
  };

  const handleUploadXml = (xmlContent: string, fileName: string) => {
    setSelectedPresetId("custom-upload");
    loadAndVerify(xmlContent, `Uploaded File: ${fileName}`);
  };

  const handleSynthesizePatch = () => {
    if (!currentRungs.length) return;
    setIsLoading(true);
    try {
      const patched = patchLadderLogicWithInterlocks(currentRungs);
      setCurrentRungs(patched);
      const result = executeModelChecker(patched);
      setVerificationResult(result);
      setCurrentFrameIndex(0);
      setSourceName(`${sourceName} [Patched with EARS Interlocks]`);
    } catch (err) {
      console.error("Patching error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentFrame = verificationResult?.trace[currentFrameIndex];
  const isCrashFrame = Boolean(
    verificationResult &&
      !verificationResult.safe &&
      currentFrameIndex === (verificationResult.trace.length - 1) &&
      verificationResult.collision_cycle !== null
  );

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header & SCADA Navigation */}
      <header className="border-b border-slate-800 bg-[#0a0f1d]/90 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            RG
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-mono text-base font-bold tracking-wider text-slate-100">
                RELAYGHOST
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                SCADA v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Temporal Bounded Model Checker for 1968 IEC 61131-3 Ladder Logic
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="hidden md:flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Spec Engine: Rolls-Royce EARS (2009)</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Kiro Hook: PostFileSave Active</span>
          </div>
          <a
            href="https://github.com/Ashuraj-Herode22/relayghost"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center space-x-1.5 active:scale-95"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-4 lg:p-6 space-y-4 max-w-[1680px] w-full mx-auto">
        {/* Preset & Benchmark Control Strip */}
        <PresetBar
          selectedPresetId={selectedPresetId}
          onSelectPreset={handleSelectPreset}
          onUploadXml={handleUploadXml}
          onSynthesizePatch={handleSynthesizePatch}
          canPatch={Boolean(verificationResult && !verificationResult.safe)}
          isLoading={isLoading}
        />

        {/* Current Target Indicator */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border border-slate-800/80 rounded text-xs font-mono text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase">Target:</span>
            <span className="font-semibold text-amber-300">{sourceName}</span>
          </div>
          <div className="text-slate-400">
            Parsed: <span className="text-white font-bold">{currentRungs.length}</span> Rungs |
            Format: <span className="text-cyan-400 font-bold">PLCopen XML tc6_0201</span>
          </div>
        </div>

        {/* 2-Column SCADA Command Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column (58%): 3D Workcell + Telemetry + Scrubber */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* 3D Digital Twin Workcell Canvas */}
            <div className="h-[430px] w-full">
              <WorkcellCanvas currentFrame={currentFrame} isCollision={isCrashFrame} />
            </div>

            {/* Field Actuators (%QX) & Discrete Sensors (%IX) Board */}
            <ActuatorBoard currentFrame={currentFrame} />

            {/* Replay Scrubber Player */}
            <ScrubberPlayer
              result={verificationResult}
              currentFrameIndex={currentFrameIndex}
              onFrameChange={setCurrentFrameIndex}
            />
          </div>

          {/* Right Column (42%): Ladder Diagram + Verification Diagnostic Report */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Live Power-Flow Ladder Diagram */}
            <div className="h-[450px]">
              <LadderViewer
                rungs={currentRungs}
                currentFrame={currentFrame}
                faultRungIds={verificationResult?.fault_rung_ids || []}
                isCrashFrame={isCrashFrame}
              />
            </div>

            {/* Formal Verification Diagnostic Report */}
            <VerificationReport
              result={verificationResult}
              rungs={currentRungs}
              onSynthesizePatch={handleSynthesizePatch}
              canPatch={Boolean(verificationResult && !verificationResult.safe)}
            />
          </div>
        </div>

        {/* Diagnostics & Event Timeline Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6">
            <EventTimeline
              result={verificationResult}
              currentFrameIndex={currentFrameIndex}
              onSelectFrame={(idx) => setCurrentFrameIndex(idx)}
            />
          </div>

          {/* Rolls-Royce EARS & Architecture Card */}
          <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <span>Polymathic Foundation: Rolls-Royce PLC to Kiro 2026</span>
              </span>
              <span className="text-[10px] text-slate-500">Spec-Driven Development Origin</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              In 2009, Alistair Mavin invented <strong className="text-slate-200">EARS (Easy Approach to Requirements Syntax)</strong> at Rolls-Royce PLC to prevent catastrophic failure modes in aerospace jet engine controllers. 17 years later, Kiro adopted EARS for AI-assisted software specs. RelayGhost brings EARS back to its industrial heritage: formally verifying IEC 61131-3 Ladder Logic against temporal timing anomalies and race conditions.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-[10px]">
              <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                <span className="text-amber-400 font-bold block">1968 Ladder Logic</span>
                Scan cycles, TON/TOF timers, latches & interlocks.
              </div>
              <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                <span className="text-cyan-400 font-bold block">Bounded Model Checking</span>
                Exhaustive BFS exploration across all state permutations.
              </div>
              <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                <span className="text-emerald-400 font-bold block">Agent Hook Gate</span>
                Blocks unsafe commits in Kiro via automated exit code 1.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 mt-8 text-center text-xs font-mono text-slate-500">
        RelayGhost • Kiroween 2026 Hackathon • Built with Next.js 15, Three.js & FastMCP • MIT License
      </footer>
    </div>
  );
}
