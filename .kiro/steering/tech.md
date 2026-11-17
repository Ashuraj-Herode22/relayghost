---
inclusion: always
---
# Technical Architecture Directives

## Core Architecture
- **Deterministic Engine:** Python 3.x temporal bounded model checker simulating discrete PLC scan cycles, latches (`OTL`/`OTU`), and on-delay timers (`TON`).
- **MCP Integration:** Model Context Protocol tool exposed via `engine/mcp_server.py`.
- **SCADA UI:** Next.js 15, React, Tailwind CSS, Three.js 3D workcell (6 universal actuators), live SVG power-flow ladder viewer, and 0.25x slow-mo timeline scrubber.
- **Safety Standard:** IEC 61131-3 PLCopen XML standard compliance.

## Code Standards
- Zero external runtime dependency for the verification engine.
- Every tool response must adhere to the standardized Replay JSON contract.
- All Kiro specs must follow EARS formatting.
