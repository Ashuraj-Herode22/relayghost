# Technical Design: Stamping Press Temporal Interlock

## 1. Electrical Architecture & Ladder Logic Diff
To resolve the temporal collision detected at Scan Cycle #3, the legacy ladder program must be modified to insert mutually exclusive normally-closed (`[ / ]`) contacts in series with both actuators.

### Rung 1 Modification (Arm Feed Latch)
```text
LEGACY (Buggy):
|--[ %IX0.4 ]----[ %IX0.5 ]----------------------------------( OTL %QX0.1 )--|

PATCHED (Verified Safe):
|--[ %IX0.4 ]----[ %IX0.5 ]----[ / %QX0.0 ]------------------( OTL %QX0.1 )--|
                                ^^^^^^^^^^^ Added interlock
```

### Rung 5 Modification (Press Extend Coil)
```text
LEGACY (Buggy):
|--[ T4:1.DN ]------------------------------------------------( %QX0.0 )-----|

PATCHED (Verified Safe):
|--[ T4:1.DN ]----[ / %QX0.1 ]--------------------------------( %QX0.0 )-----|
                  ^^^^^^^^^^^ Added interlock
```

## 2. State-Space Verification
The temporal model checker will explore all permutations of operator input and sensor glitch to prove reachability of the `(%QX0.0 == True AND %QX0.1 == True)` hazard state drops to 0 across all scan cycles.
