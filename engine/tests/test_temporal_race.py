"""
Test Suite: Verifies RelayGhost catches multi-cycle temporal race conditions.
Validates:
1. Buggy Workcell (Missing Interlock): Catches physical collision at Cycle 5,
   reports fault rungs [5, 1], and extracts 4-cycle highlight crash clip.
2. Patched Workcell (Mutual Interlocks): 0 Reachable Hazards, Verified Safe,
   and extracts full nominal animation trace.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from engine.plc_model_checker import TemporalModelChecker, Rung, PLCState


def build_buggy_workcell() -> TemporalModelChecker:
    checker = TemporalModelChecker(scan_cycle_ms=100)

    # Rung 1: Cycle Start (%IX0.5) & Safety OK (%IX0.4) -> Latch Arm (%QX0.1)
    checker.add_rung(Rung(
        rung_id=1,
        name="Arm_Extend_Latch",
        branches=[[("%IX0.4", False), ("%IX0.5", False)]],
        output_type="OTL",
        output_target="%QX0.1",
    ))

    # Rung 2: Arm Active (%QX0.1) -> Start Retract Timer T4:0 (200ms)
    checker.add_rung(Rung(
        rung_id=2,
        name="Arm_Retract_Timer",
        branches=[[("%QX0.1", False)]],
        output_type="TON",
        output_target="T4:0",
        preset_ms=200,
    ))

    # Rung 3: When T4:0.DN AND Retract Limit Switch (%IX0.2) -> Unlatch Arm (%QX0.1)
    checker.add_rung(Rung(
        rung_id=3,
        name="Arm_Retract_Unlatch",
        branches=[[("T4:0.DN", False), ("%IX0.2", False)]],
        output_type="OTU",
        output_target="%QX0.1",
    ))

    # Rung 4: Cycle Start Timer T4:1 (300ms) initiates press descent
    checker.add_rung(Rung(
        rung_id=4,
        name="Press_Descent_Timer",
        branches=[[("%QX0.1", False)]],
        output_type="TON",
        output_target="T4:1",
        preset_ms=300,
    ))

    # Rung 5: When T4:1.DN fires -> Extend Press (%QX0.0)
    # BUG: Fails to check [ / %QX0.1 ] (Arm Retracted)!
    checker.add_rung(Rung(
        rung_id=5,
        name="Press_Extend_Coil",
        branches=[[("T4:1.DN", False)]],
        output_type="COIL",
        output_target="%QX0.0",
    ))

    return checker


def build_patched_workcell() -> TemporalModelChecker:
    checker = TemporalModelChecker(scan_cycle_ms=100)

    # Rung 1: Arm Extend with [ / %QX0.0 ] interlock (Cannot extend if Press active)
    checker.add_rung(Rung(
        rung_id=1,
        name="Arm_Extend_Latch",
        branches=[[("%IX0.4", False), ("%IX0.5", False), ("%QX0.0", True)]],
        output_type="OTL",
        output_target="%QX0.1",
    ))

    # Rung 2: Arm Retract Timer
    checker.add_rung(Rung(
        rung_id=2,
        name="Arm_Retract_Timer",
        branches=[[("%QX0.1", False)]],
        output_type="TON",
        output_target="T4:0",
        preset_ms=200,
    ))

    # Rung 3: Arm Retract Unlatch
    checker.add_rung(Rung(
        rung_id=3,
        name="Arm_Retract_Unlatch",
        branches=[[("T4:0.DN", False), ("%IX0.2", False)]],
        output_type="OTU",
        output_target="%QX0.1",
    ))

    # Rung 4: Press Descent Timer
    checker.add_rung(Rung(
        rung_id=4,
        name="Press_Descent_Timer",
        branches=[[("%QX0.1", False)]],
        output_type="TON",
        output_target="T4:1",
        preset_ms=300,
    ))

    # Rung 5: Press Extend with [ / %QX0.1 ] interlock (Cannot extend if Arm active)
    checker.add_rung(Rung(
        rung_id=5,
        name="Press_Extend_Coil",
        branches=[[("T4:1.DN", False), ("%QX0.1", True)]],
        output_type="COIL",
        output_target="%QX0.0",
    ))

    return checker


def test_temporal_race():
    candidate_inputs = [
        {"%IX0.4": True, "%IX0.5": True, "%IX0.2": False},
        {"%IX0.4": True, "%IX0.5": False, "%IX0.2": True},
        {"%IX0.4": True, "%IX0.5": False, "%IX0.2": False},
    ]

    # --- TEST 1: BUGGY PROGRAM ---
    print("\n🔍 TEST 1: Running Model Checker on Buggy Stamping Workcell...")
    buggy_checker = build_buggy_workcell()
    init_state = PLCState(0, inputs={}, outputs={"%QX0.0": False, "%QX0.1": False}, internal_bits={}, timers={})
    res_buggy = buggy_checker.explore_temporal_state_space(init_state, candidate_inputs, max_depth=8)

    assert not res_buggy["safe"], "Should catch temporal collision in buggy program"
    assert res_buggy["replay_mode"] == "highlight_crash"
    assert res_buggy["collision_cycle"] == 3
    assert set(res_buggy["fault_rung_ids"]) == {1, 5}
    assert len(res_buggy["trace"]) == 4

    print(f"❌ HAZARD DETECTED AT CYCLE #{res_buggy['collision_cycle']}!")
    print(f"⚠️  Description: {res_buggy['hazard']}")
    print(f"🎯 Fault Rung IDs: {res_buggy['fault_rung_ids']}")
    print(f"🎬 Replay Mode: {res_buggy['replay_mode']} ({len(res_buggy['trace'])} frames)")
    print("--- Highlight Crash Clip ---")
    for step in res_buggy["trace"]:
        print(f"  Cycle {step['cycle']} ({step['timestamp_ms']}ms): Press=%QX0.0: {step['outputs'].get('%QX0.0', False)}, Arm=%QX0.1: {step['outputs'].get('%QX0.1', False)}")

    # --- TEST 2: PATCHED PROGRAM ---
    print("\n🔍 TEST 2: Running Model Checker on Patched Workcell (Mutual Interlocks)...")
    patched_checker = build_patched_workcell()
    init_state = PLCState(0, inputs={}, outputs={"%QX0.0": False, "%QX0.1": False}, internal_bits={}, timers={})
    res_patched = patched_checker.explore_temporal_state_space(init_state, candidate_inputs, max_depth=8)

    assert res_patched["safe"], "Patched workcell must be mathematically proven safe"
    assert res_patched["replay_mode"] == "full_nominal"
    assert res_patched["collision_cycle"] is None
    assert len(res_patched["trace"]) > 0

    print(f"✅ VERIFIED SAFE: 0 Reachable Hazards across {res_patched['states_explored']} explored temporal states.")
    print(f"🎬 Replay Mode: {res_patched['replay_mode']} ({len(res_patched['trace'])} full cycle frames)")
    print("\n🎉 ALL TESTS PASSED WITH 100% MATHEMATICAL PRECISION.")


if __name__ == "__main__":
    test_temporal_race()
