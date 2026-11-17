# 🛡️ RelayGhost: Autonomous Industrial SCADA Safety Verifier

> **Bringing Kiro's Spec-Driven Development (EARS) Home to its Industrial Birthplace.**  
> *A Temporal Bounded Model Checker and Digital Twin Verification Engine for 1968 Ladder Logic (IEC 61131-3).*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Standard: IEC 61131-3](https://img.shields.io/badge/Standard-IEC_61131--3-blue.svg)](https://plcopen.org/)
[![Toolchain: Kiro AI](https://img.shields.io/badge/Built_With-Kiro_Toolchain-orange.svg)](https://kiro.dev/)
[![Protocol: Model Context Protocol](https://img.shields.io/badge/Protocol-FastMCP-purple.svg)](https://modelcontextprotocol.io/)

---

## 📖 The Rolls-Royce EARS Origin Story

In 2009, **Alistair Mavin** invented **EARS (Easy Approach to Requirements Syntax)** at **Rolls-Royce PLC** specifically to eradicate catastrophic errors in safety-critical jet engines and industrial control systems.

Today, AWS and Kiro have built their entire agentic architecture on EARS. With **RelayGhost**, we bring Kiro's EARS specification engine home to where it was born: protecting the physical factory machinery that powers the real world.

Over 90% of global industrial manufacturing, automotive stamping plants, and automated warehouses run on **1968 Ladder Logic**. Millions of lines of legacy control logic remain undocumented, leaving plants exposed to subtle temporal race conditions that cause catastrophic physical collisions, costing an average of **$22,000 per minute of downtime** (Siemens Industrial Survey).

**RelayGhost** bridges 1960s electrical relay logic with cutting-edge 2026 AI verification.

---

## 🚀 Key Features

* **⚡ Temporal Bounded Model Checker:** Simulates multi-cycle discrete PLC scans with Set/Reset latches (`OTL`/`OTU`) and On-Delay timers (`TON`).
* **🔍 Breadth-First State-Space Exploration:** Traces temporal execution paths to expose subtle race conditions (e.g., E-Stop resets occurring before a pneumatic venting timer expires).
* **📐 Authentic IEC 61131-3 PLCopen XML (`tc6_0201`) Parser:** Resolves connection graphs between `<leftPowerRail>`, `<contact>`, `<block typeName="TON">`, and `<coil>` into parallel OR-branches.
* **🎯 Universal Actuator & Sensor Normalization:** Maps industrial tags across 6 universal actuators (`%QX0.0`–`%QX0.5`) and 8 sensors (`%IX0.0`–`%IX0.7`).
* **🤖 Deep Kiro Integration:**
  * **MCP Server (`engine/mcp_server.py`):** Exposes `verify_plc_file` and `verify_plc_xml_string` tools over stdio.
  * **Automated Safety Hook (`.kiro/hooks/safety-gate.json`):** Strict Kiro v1 hook running on `PostFileSave`.
  * **Persistent Context Steering (`.kiro/steering/safety-invariants.md`):** Non-negotiable physical safety rules written in EARS.
  * **Spec-Driven Remediation (`.kiro/specs/stamping-press-interlock/`):** 3-Wave execution resolving race conditions.

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph PLC_Files["Industrial PLC Files"]
        A["PLCopen XML tc6_0201<br/>or JSON Rungs"]
    end

    subgraph Deterministic_Engine["Deterministic Engine (Python)"]
        B["PLCopen XML Graph Parser<br/>(plc_parser.py)"] --> C["Temporal Model Checker<br/>(plc_model_checker.py)"]
        C --> D["BFS State-Space Explorer<br/>(TON, OTL, OTU)"]
    end

    subgraph Kiro_Toolchain["Kiro Developer Toolchain"]
        E[".kiro/settings/mcp.json<br/>(relayghost-verifier)"]
        F[".kiro/hooks/safety-gate.json<br/>(PostFileSave)"]
        G[".kiro/specs/stamping-press-interlock/<br/>(EARS Requirements & Waves)"]
    end

    subgraph Output["Standardized Replay Contract"]
        H["Crash Highlight Clip<br/>(Last 4 Cycles Before Impact)"]
        I["Full Nominal Run<br/>(Verified Safe Proof)"]
    end

    PLC_Files --> Deterministic_Engine
    Deterministic_Engine <--> Kiro_Toolchain
    Deterministic_Engine --> Output
```

---

## ⚙️ Universal Actuator & Sensor Mapping

To ensure any PLCopen XML file animates seamlessly in a 3D digital twin, RelayGhost maps addresses to 6 standardized physical actuators:

| Universal Address | Physical Actuator / Solenoid | Description |
| :---: | :--- | :--- |
| **`%QX0.0`** | **Hydraulic Stamping Press** | Main vertical forming / stamping cylinder |
| **`%QX0.1`** | **Robotic Transfer Arm** | Horizontal in-die feeder mechanism |
| **`%QX0.2`** | **Infeed Conveyor Belt** | Material transit drive motor |
| **`%QX0.3`** | **Part Clamping Cylinder** | Pneumatic fixture lock |
| **`%QX0.4`** | **Lubricant Valve / Motor** | Hydraulic pump & relief manifold |
| **`%QX0.5`** | **Safety Alarm Beacon** | High-intensity optical/acoustic warning |

---

## 📊 Benchmark Verification Suite (10 Real PLC Programs)

The verification engine was executed across 10 authentic IEC 61131-3 PLCopen XML programs, achieving **100% mathematical fidelity**:

| Benchmark File Path | Expected Result | Actual Result | Verification Status |
| :--- | :---: | :---: | :---: |
| `plc-benchmarks/known-errors/01_stamping_press_missing_interlock.xml` | **Hazard** | **Hazard (Cycle #4, Fault Rungs: [5, 3])** | ✅ Passed |
| `plc-benchmarks/known-errors/err_01_conveyor_gate_bypass.xml` | **Hazard** | **Hazard (Cycle #1, Fault Rungs: [2, 1])** | ✅ Passed |
| `plc-benchmarks/known-errors/err_02_dual_motor_reversal_short.xml` | **Hazard** | **Hazard (Cycle #1, Fault Rungs: [1, 2])** | ✅ Passed |
| `plc-benchmarks/known-errors/err_03_oven_purge_timer_skip.xml` | **Hazard** | **Hazard (Cycle #1, Fault Rungs: [2, 1])** | ✅ Passed |
| `plc-benchmarks/test-for-yourself/02_pneumatic_estop_timer_race.xml` | **Hazard** | **Hazard (Cycle #3, Fault Rungs: [3, 2])** | ✅ Passed |
| `plc-benchmarks/test-for-yourself/03_rolls_royce_ears_interlock_baseline.xml` | **Safe** | **Verified Safe (0 Hazards, Full Nominal Run)** | ✅ Passed |
| `plc-benchmarks/test-for-yourself/mystery_alpha_robot_handover.xml` | **Hazard** | **Hazard (Cycle #1, Fault Rungs: [2, 1])** | ✅ Passed |
| `plc-benchmarks/test-for-yourself/mystery_beta_beremiz_traffic_interlock.xml` | **Safe** | **Verified Safe (0 Hazards, Full Nominal Run)** | ✅ Passed |
| `plc-benchmarks/test-for-yourself/mystery_gamma_bottle_filler_latch.xml` | **Hazard** | **Hazard (Cycle #1, Fault Rungs: [2, 1])** | ✅ Passed |
| `plc-benchmarks/test-for-yourself/mystery_delta_sequential_motor_startup.xml` | **Safe** | **Verified Safe (0 Hazards, Full Nominal Run)** | ✅ Passed |

---

## ⚡ Quick Start

### 1. Run Verification in Terminal
```bash
# Clone the repository
git clone https://github.com/Ashuraj-Herode22/relayghost.git
cd relayghost

# Run the test suite
python3 -m engine.tests.test_temporal_race

# Audit any benchmark file
python3 engine/verify_cli.py plc-benchmarks/known-errors/01_stamping_press_missing_interlock.xml
```

### 2. Output Example
```text
=======================================================
🛡️  RELAYGHOST FORMAL VERIFICATION AUDIT REPORT
📄 Target File: 01_stamping_press_missing_interlock.xml
⚙️  Rungs Parsed: 5 | States Explored: 7
=======================================================
❌ STATUS: CRITICAL HAZARD REACHABLE (Scan Cycle #4)
⚠️  Hazard Description: CRITICAL COLLISION: Hydraulic Press (%QX0.0) closed while Transfer Arm (%QX0.1) was extended inside die zone!
💥 Colliding Actuators: ['%QX0.0', '%QX0.1']
🎯 Fault Rung IDs: [5, 3]
🎬 Replay Mode: highlight_crash (4 frames)
```

---

## 🏆 Hackathon Eligibility

- **Event:** Kiroween 2026 ($100,000 Pool)
- **Primary Track:** **Resurrection** (Reviving 1968 Modicon Ladder Logic via modern agentic AI)
- **Bonus Track:** **Best Startup Project** (Targeting the $22,000/minute industrial downtime crisis)
- **Toolchain:** Fully spec-driven with Kiro IDE, FastMCP, and automated Kiro Agent Hooks.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](file:///Users/ashurajherode/.gemini/antigravity/scratch/relayghost/LICENSE) file for details.
