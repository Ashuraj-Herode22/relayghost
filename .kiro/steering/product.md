---
inclusion: always
---
# Product Context: RelayGhost (Autonomous SCADA Safety Verifier)

## Purpose & Problem
Over 90% of global industrial manufacturing, automotive stamping plants, and physical assembly lines run on 1968 Ladder Logic (IEC 61131-3) programmed on PLCs. Millions of lines of legacy control logic remain undocumented, leaving factories exposed to subtle temporal race conditions that cause catastrophic physical collisions, costing an average of $22,000 per minute of downtime.

RelayGhost brings modern spec-driven development to industrial hardware:
1. Ingests authentic legacy PLCopen XML (`tc6_0201`) files.
2. Reverse-engineers undocumented rungs into formal EARS specifications.
3. Uses a temporal bounded model checker to find multi-cycle race conditions.
4. Generates verified interlock patches with an interactive 3D digital twin replay.
