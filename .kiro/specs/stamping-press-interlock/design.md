# Technical Design: Stamping Press Temporal Interlock

## 1. Electrical Architecture & Ladder Logic Diff
To resolve the temporal collision detected at Scan Cycle #4 (400ms into the cycle due to `TON` timer accumulation), the legacy ladder program must be modified to insert a normally-closed (`[ / ]`) interlock into the secondary actuator rung to prevent concurrent activation while preventing deadlocks.

### Rung 3 Modification (Arm Feed Latch)
```text
LEGACY (Buggy):
|--[ %IX0.4 ]----[ %IX0.5 ]----------------------------------( OTL %QX0.1 )--|

PATCHED (Verified Safe):
|--[ %IX0.4 ]----[ %IX0.5 ]----[ / %QX0.0 ]------------------( OTL %QX0.1 )--|
                                ^^^^^^^^^^^ Synthesized EARS interlock
```

### Rung 5 Modification (Press Extend Coil)
```text
LEGACY (Buggy):
|--[ T4:1.DN ]------------------------------------------------( %QX0.0 )-----|

PATCHED (Verified Safe):
|--[ T4:1.DN ]------------------------------------------------( %QX0.0 )-----|
```
*Note: Deadlock-free synthesis locks out secondary actuator `%QX0.1` while primary ram `%QX0.0` operates, allowing workcell cycle completion.*

## 2. State-Space Verification
The temporal model checker explores all discrete scan cycles, `TON` timer states, and sensor transitions to mathematically prove that reachability of the `(%QX0.0 == True AND %QX0.1 == True)` hazard drops to exactly 0 reachable states.

## 3. SCADA Replay Integration
Verified traces are serialized into the standard RelayGhost Replay JSON contract and ingested by the Next.js 15 / Three.js 3D workcell, providing 0.25x slow-motion visual playback of the defect and the healed operation.
