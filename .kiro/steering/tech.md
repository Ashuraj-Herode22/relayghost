---
inclusion: always
---
# Technical Architecture Directives

## 1. Core Architecture
- **Deterministic Formal Engine:** Python 3.x temporal bounded model checker (`engine/plc_model_checker.py`) executing discrete scan-cycle BFS exploration across all state permutations.
- **Instruction Support:** IEC 61131-3 standard contacts (NO/NC), coils, Set/Reset latches (`OTL`/`OTU`), on/off-delay timers (`TON`/`TOF`), Up-Counters (`CTU`), parallel `OR` branch paths, and intra-scan sequential memory updates.
- **Universal Actuator Mapping:** 6 standard field actuators (`%QX0.0`–`%QX0.5`) and 8 discrete sensors (`%IX0.0`–`%IX0.7`) enabling a single digital twin to animate any uploaded PLC program.
- **Pure TypeScript Engine Mirror:** `web/src/lib/plcVerifier.ts` provides a zero-dependency TypeScript implementation maintaining 100% parity with Python CLI for instantaneous (<3ms) client-side verification on Vercel.

## 2. Kiro Developer Toolchain Integration
- **Model Context Protocol (FastMCP):** Exposes `verify_plc_file` and `verify_plc_xml_string` tools over stdio (`engine/mcp_server.py`) configured in `.kiro/settings/mcp.json`.
- **Kiro Agent Hook:** `PostFileSave` hook (`.kiro/hooks/safety-gate.json`) passes saved XML file paths via STDIN JSON to `engine/verify_cli.py`, exiting code 0 for safe programs and code 1 for hazardous states.
- **Rolls-Royce EARS Steering:** `.kiro/steering/safety-invariants.md` enforces Easy Approach to Requirements Syntax for all invariant checks.

## 3. SCADA Command Center Web Interface
- **Framework:** Next.js 15.1, React 19, Tailwind CSS 3.4.
- **3D Digital Twin:** Three.js 0.170 workcell with camera view controls (Isometric, Die Zoom, Top View), dynamic particle spark burst, and laser safety curtain.
- **Live Ladder Power-Flow:** SVG diagram visualizing power rails, contact conduction states, parallel `OR` branches, and newly synthesized EARS interlocks.
- **Interactive Scrubber:** 0.25x slow-motion auto-looping crash clip player with frame-by-frame stepping and cycle timeline.
- **Dynamic Interlock Synthesizer:** Auto-patches conflicting coils with deadlock-free secondary rung interlocking and exports valid patched PLCopen XML.

## 4. Benchmark Suite
- 10 authentic benchmark files across `known-errors/` (7 timing defects failing at Cycle #4) and `test-for-yourself/` (3 verified safe baselines).
