# Implementation Tasks: Stamping Press Temporal Interlock

- [x] 1. Hazard Isolation & Root-Cause Counterexample (Wave 1)
  - [x] 1.1 Ingest legacy PLCopen XML program `01_stamping_press_missing_interlock.xml` <!-- id: 1.1 -->
  - [x] 1.2 Run temporal bounded model checker via MCP to capture collision at Cycle #3 <!-- id: 1.2, deps: [1.1] -->
  - [x] 1.3 Isolate fault rungs: Rung 1 (Arm Latch) and Rung 5 (Press Coil) <!-- id: 1.3, deps: [1.2] -->

- [x] 2. Spec-Driven Interlock Synthesis (Wave 2)
  - [x] 2.1 Insert normally-closed contact `[ / %QX0.1 ]` into Rung 5 <!-- id: 2.1, deps: [1.3] -->
  - [x] 2.2 Insert reciprocal normally-closed contact `[ / %QX0.0 ]` into Rung 1 <!-- id: 2.2, deps: [2.1] -->

- [x] 3. Formal Mathematical Proof & Telemetry (Wave 3)
  - [x] 3.1 Trigger `relayghost-verifier` via Kiro PostFileSave hook <!-- id: 3.1, deps: [2.2] -->
  - [x] 3.2 Verify 0 reachable hazards across state space (Proven Safe) <!-- id: 3.2, deps: [3.1] -->
  - [x] 3.3 Emit full nominal animation trace for 3D SCADA replay player <!-- id: 3.3, deps: [3.2] -->
