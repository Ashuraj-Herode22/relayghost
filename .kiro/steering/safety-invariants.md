---
inclusion: always
---
# Industrial Safety Invariants & EARS Directives

## Historical Context & Principles
In 2009, Alistair Mavin invented **EARS (Easy Approach to Requirements Syntax)** at **Rolls-Royce PLC** specifically to eradicate catastrophic errors in safety-critical jet engines and industrial systems. RelayGhost returns EARS to its industrial engineering origin.

Every PLC program analyzed or modified by Kiro must satisfy these non-negotiable physical safety invariants:

## 1. Mutual Exclusion Invariants (EARS Syntax)
- **Stamping Workcell Invariant:**
  - `WHILE Transfer Arm (%QX0.1) IS extended`
  - `THE SYSTEM SHALL keep Hydraulic Press Extend (%QX0.0) DE-ENERGIZED.`
- **Reciprocal Invariant:**
  - `WHILE Hydraulic Press (%QX0.0) IS in motion or extended`
  - `THE SYSTEM SHALL keep Transfer Arm (%QX0.1) DE-ENERGIZED.`

## 2. Clamping & Fixture Invariants
- `WHILE Transfer Arm (%QX0.1) IS transitioning through fixture zone`
- `THE SYSTEM SHALL inhibit Part Clamping Cylinder (%QX0.3).`

## 3. Emergency Stop & Optical Safety Invariants
- `WHEN Emergency Stop (%IX0.4) IS de-energized (tripped)`
- `THE SYSTEM SHALL immediately de-energize all motion coils (%QX0.0, %QX0.1, %QX0.2, %QX0.3) within 0 scan cycles.`
- `WHEN Light Curtain Optical Beam (%IX0.3) IS broken`
- `THE SYSTEM SHALL inhibit press descent and energize Safety Alarm Beacon (%QX0.5).`

## 4. Verification Mandate
Any proposed ladder rung modification must pass through the `relayghost-verifier` MCP engine with **0 reachable hazard states across >= 15 scan cycle depth** before being committed.
