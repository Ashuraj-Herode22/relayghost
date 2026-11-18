"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import LadderViewer from "@/components/LadderViewer";
import ScrubberPlayer from "@/components/ScrubberPlayer";
import PresetBar from "@/components/PresetBar";
import ActuatorBoard from "@/components/ActuatorBoard";
import VerificationReport from "@/components/VerificationReport";
import { BENCHMARKS } from "@/lib/benchmarkPresets";
import {
  parsePlcopenXml,
  executeModelChecker,
  patchLadderLogicWithInterlocks,
  Rung,
  VerificationResult,
} from "@/lib/plcVerifier";
import { classifyMachineArchetype } from "@/components/workcell/types";

// Client-only dynamic import for Three.js 3D Viewport to prevent SSR canvas hydration mismatch
const WorkcellCanvas = dynamic(() => import("@/components/WorkcellCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-2xl bg-[#06070A] border border-white/[0.08] flex items-center justify-center font-mono text-xs text-slate-500">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mr-2" />
      <span>Loading 3D Digital Twin...</span>
    </div>
  ),
});

export default function Home() {
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    "known-errors/01_stamping_press_missing_interlock.xml"
  );
  const [currentRungs, setCurrentRungs] = useState<Rung[]>(() => {
    try {
      return parsePlcopenXml(BENCHMARKS[0].xml);
    } catch {
      return [];
    }
  });
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(() => {
    try {
      const rungs = parsePlcopenXml(BENCHMARKS[0].xml);
      return executeModelChecker(rungs);
    } catch {
      return null;
    }
  });
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string>(
    "01 · Stamping Press (Known Defect)"
  );
  const [originalXml, setOriginalXml] = useState<string>(() => BENCHMARKS[0]?.xml || "");
  const [originalName, setOriginalName] = useState<string>(
    () => BENCHMARKS[0]?.name || "01 · Stamping Press (Known Defect)"
  );
  const [deltaInfo, setDeltaInfo] = useState<{
    patchDescription: string;
    deltaText: string;
    beforeCycle: number | null;
  } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load and verify a preset or XML string
  const loadAndVerify = (xml: string, label: string, isRevert: boolean = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    setDeltaInfo(null);
    try {
      const rungs = parsePlcopenXml(xml);
      setCurrentRungs(rungs);
      const result = executeModelChecker(rungs);
      setVerificationResult(result);
      setCurrentFrameIndex(0);
      setSourceName(label);
      if (!isRevert) {
        setOriginalXml(xml);
        setOriginalName(label);
      }
    } catch (err: any) {
      console.error("Verification failed:", err);
      setErrorMessage(err.message || "Failed to parse or verify IEC 61131-3 PLCopen XML.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = BENCHMARKS.find((b) => b.id === presetId);
    if (found) {
      loadAndVerify(found.xml, found.name);
    }
  };

  const handleUploadXml = (xmlContent: string, fileName: string) => {
    setSelectedPresetId("custom-upload");
    loadAndVerify(xmlContent, fileName);
    setIsUploadModalOpen(false);
  };

  const handleDownloadSample = () => {
    const sample = BENCHMARKS.find((b) => b.id.includes("mystery_gamma")) || BENCHMARKS[0];
    const blob = new Blob([sample.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_plcopen_program.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Dynamic EARS Interlock Synthesis
  const handleSynthesizePatch = () => {
    if (!currentRungs.length || !verificationResult) return;
    setIsLoading(true);
    try {
      const collisionCoils =
        verificationResult.collision_coils.length > 0
          ? verificationResult.collision_coils
          : ["%QX0.0", "%QX0.1"];
      const faultRungs = verificationResult.fault_rung_ids;
      const beforeCycle = verificationResult.collision_cycle;

      const { patchedRungs, patchDescription, deltaText } = patchLadderLogicWithInterlocks(
        currentRungs,
        collisionCoils,
        faultRungs
      );

      setCurrentRungs(patchedRungs);
      const result = executeModelChecker(patchedRungs);
      setVerificationResult(result);
      setCurrentFrameIndex(0);
      setSourceName(`${originalName || sourceName} [Synthesized EARS Safe]`);
      setDeltaInfo({
        patchDescription,
        deltaText,
        beforeCycle,
      });
    } catch (err: any) {
      console.error("Patching error:", err);
      setErrorMessage(err.message || "Failed to synthesize interlocks.");
    } finally {
      setIsLoading(false);
    }
  };

  // Revert to original unpatched defect for instant before/after demo toggling
  const handleRevertToOriginal = () => {
    if (originalXml) {
      loadAndVerify(originalXml, originalName, true);
    }
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const currentFrame = verificationResult?.trace[currentFrameIndex];
  const isCrashFrame = Boolean(
    verificationResult &&
      !verificationResult.safe &&
      currentFrameIndex === verificationResult.trace.length - 1 &&
      verificationResult.collision_cycle !== null
  );

  const machineType = classifyMachineArchetype(sourceName, verificationResult?.hazard || "");

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-[#06070A] text-slate-100 flex flex-col items-center justify-center font-mono text-xs space-y-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-violet-600 to-rose-600 p-[1px] shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center animate-pulse">
          <div className="w-full h-full bg-[#0C0E14] rounded-[11px] flex items-center justify-center">
            <span className="text-amber-400 font-bold tracking-wider">RG</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="tracking-wide">Initializing RelayGhost SCADA Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06070A] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* 1. Top Command Bar (56px fixed height, glassmorphic backdrop) */}
      <header className="h-14 border-b border-white/[0.08] bg-[#0C0E14]/85 backdrop-blur-md sticky top-0 z-50 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3">
        {/* Left: Minimalist SVG Geometric Emblem + Wordmark */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 via-violet-600 to-rose-600 p-[1px] shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center justify-center">
            <div className="w-full h-full bg-[#0C0E14] rounded-[7px] flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-violet-400"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-400"
                />
              </svg>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-mono font-bold tracking-wider text-sm text-white">
              RELAYGHOST
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/[0.06] text-slate-300 border border-white/[0.08] hidden sm:inline">
              IEC 61131-3 Temporal Verifier
            </span>
          </div>
        </div>

        {/* Center: Segmented Core Scenario Switcher (desktop) */}
        <div className="hidden xl:flex items-center">
          <PresetBar
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
          />
        </div>

        {/* Right: Actions (Upload .XML, Sample .XML, Benchmark Suite) */}
        <div className="flex items-center space-x-2 font-mono text-xs shrink-0">
          {/* Quick Sample Download */}
          <button
            onClick={handleDownloadSample}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition active:scale-95 text-[11px] hidden sm:flex items-center space-x-1"
            title="Download sample IEC 61131-3 PLCopen XML program to test custom file upload"
          >
            <span>📥 Sample .xml</span>
          </button>

          {/* Upload .XML Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-white text-slate-950 hover:bg-slate-200 font-semibold text-[11px] shadow-sm transition active:scale-95 flex items-center space-x-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 10V2M8 2L5 5M8 2L11 5M2 11V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Upload .XML</span>
          </button>

          {/* External Benchmark Suite Link */}
          <a
            href="https://github.com/Ashuraj-Herode22/relayghost/tree/main/plc-benchmarks"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-white/[0.08] transition text-[11px] hidden lg:flex items-center space-x-1"
            title="Download sample IEC 61131-3 PLCopen XML programs from plc-benchmarks/ (known-errors/ and test-for-yourself/) to test temporal model checking"
          >
            <span>Benchmarks</span>
            <span>↗</span>
          </a>
        </div>
      </header>

      {/* Sub-Bar for Tablets & Smaller Screens (< xl) */}
      <div className="xl:hidden p-2 border-b border-white/[0.08] bg-[#0C0E14] flex justify-center">
        <PresetBar
          selectedPresetId={selectedPresetId}
          onSelectPreset={handleSelectPreset}
        />
      </div>

      {/* Main Studio Workspace */}
      <main className="flex-1 p-3 lg:p-4 flex flex-col space-y-3 max-w-[1740px] w-full mx-auto">
        {/* Error Notification Banner if invalid XML is uploaded */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/80 rounded-xl text-xs font-mono text-rose-200 flex items-center justify-between shadow-xl">
            <div className="flex items-center space-x-2">
              <span className="text-base">⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-300 hover:text-white font-bold ml-4 px-2 py-0.5 rounded bg-rose-900/60"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 2. Main Split Stage (60% Left Digital Twin / 40% Right Ladder & EARS Inspector) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left Column (60% on desktop): 3D Viewport + Netflix Replay Scrubber */}
          <div className="lg:col-span-7 flex flex-col space-y-2.5">
            {/* 3D Digital Twin Viewport */}
            <div className="flex-1 min-h-[400px] lg:min-h-[460px] relative">
              <WorkcellCanvas
                currentFrame={currentFrame}
                isCollision={isCrashFrame}
                isSafe={Boolean(verificationResult?.safe)}
                collisionDescription={verificationResult?.hazard || undefined}
                sourceName={sourceName}
              />
            </div>

            {/* Bottom-Docked Replay Scrubber Player */}
            <ScrubberPlayer
              result={verificationResult}
              currentFrameIndex={currentFrameIndex}
              onFrameChange={setCurrentFrameIndex}
            />
          </div>

          {/* Right Column (40% on desktop): Live Ladder Schematic & EARS Inspector */}
          <div className="lg:col-span-5 flex flex-col space-y-2.5">
            {/* Top Card: Live Ladder Schematic Viewer */}
            <div className="h-[290px] lg:h-[320px]">
              <LadderViewer
                rungs={currentRungs}
                currentFrame={currentFrame}
                faultRungIds={verificationResult?.fault_rung_ids || []}
                isCrashFrame={isCrashFrame}
              />
            </div>

            {/* Bottom Card: Verification Diagnostic & Auto-Synthesis Panel */}
            <div className="flex-1 min-h-[280px]">
              <VerificationReport
                result={verificationResult}
                rungs={currentRungs}
                onSynthesizePatch={handleSynthesizePatch}
                canPatch={Boolean(verificationResult && !verificationResult.safe)}
                deltaInfo={deltaInfo}
                onRevertToOriginal={handleRevertToOriginal}
                machineType={machineType}
                sourceName={sourceName}
              />
            </div>
          </div>
        </div>

        {/* 3. Compact Bottom Telemetry Strip */}
        <div className="pt-0.5">
          <ActuatorBoard currentFrame={currentFrame} machineType={machineType} />
        </div>
      </main>

      {/* Upload Modal (Drag and Drop / File Input) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0C0E14] border border-white/[0.12] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-200"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const content = event.target?.result as string;
                  if (content) handleUploadXml(content, file.name);
                };
                reader.readAsText(file);
              }
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="font-bold text-sm text-white">Upload PLCopen XML Program</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-400 font-sans text-xs leading-relaxed">
              Upload an authentic IEC 61131-3 Ladder Logic XML program (`tc6_0201` schema).
              RelayGhost will parse contacts, coils, and timers with native DOMParser and execute
              exhaustive temporal bounded model checking.
            </p>

            {/* Drag & Drop Zone */}
            <div
              className={`p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition ${
                isDragging
                  ? "border-amber-400 bg-amber-500/10 text-amber-200"
                  : "border-white/[0.12] hover:border-white/[0.25] bg-[#090C12]"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-8 h-8 text-slate-400 mb-2" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-semibold text-white">Click to browse or drag & drop</span>
              <span className="text-[11px] text-slate-400 mt-1">Accepts `.xml` or `.plcopen` files</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const content = event.target?.result as string;
                    if (content) handleUploadXml(content, file.name);
                  };
                  reader.readAsText(file);
                }
              }}
              accept=".xml,.plcopen"
              className="hidden"
            />

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
              <button
                onClick={handleDownloadSample}
                className="text-amber-400 hover:text-amber-300 text-[11px] underline flex items-center space-x-1"
              >
                <span>📥 Download sample test file</span>
              </button>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
