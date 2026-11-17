"""
RelayGhost: Temporal Bounded Model Checker for IEC 61131-3 Ladder Logic.
Simulates discrete PLC scan cycles, Set/Reset latches (OTL/OTU), and TON timers.
Supports parallel OR branches, sequential intra-scan memory updates, active/fault rungs tracking,
and outputs standardized replay JSON for the 3D SCADA player.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any
import json
from collections import deque


@dataclass
class Timer:
    name: str
    preset_ms: int
    accum_ms: int = 0
    en: bool = False  # Enable bit
    dn: bool = False  # Done bit


@dataclass
class Rung:
    rung_id: int
    name: str
    # Parallel OR branches: power flows if ANY branch has ALL contacts closed.
    # Each branch is a list of (address, is_normally_closed).
    branches: List[List[Tuple[str, bool]]]
    output_type: str  # 'COIL' | 'OTL' | 'OTU' | 'TON'
    output_target: str
    preset_ms: int = 0


@dataclass
class PLCState:
    cycle: int
    inputs: Dict[str, bool]
    outputs: Dict[str, bool]
    internal_bits: Dict[str, bool]
    timers: Dict[str, Timer]
    energized_rungs: List[int] = field(default_factory=list)
    output_drivers: Dict[str, int] = field(default_factory=dict)  # maps coil -> rung_id that turned it on
    parent: Optional["PLCState"] = None
    action_taken: str = ""

    def get_hashable_key(self) -> Tuple:
        """Hashable signature of internal memory + timers + outputs (excluding ephemeral external inputs)."""
        timer_sig = tuple((k, v.accum_ms, v.dn) for k, v in sorted(self.timers.items()))
        return (
            tuple(sorted(self.outputs.items())),
            tuple(sorted(self.internal_bits.items())),
            timer_sig,
        )


class TemporalModelChecker:
    def __init__(self, scan_cycle_ms: int = 100):
        self.scan_cycle_ms = scan_cycle_ms
        self.rungs: List[Rung] = []
        self.hazard_conditions: List[Tuple[str, str, str]] = []  # (AddressA, AddressB, Description)
        self.load_universal_safety_invariants()

    def load_universal_safety_invariants(self):
        """Pre-loads universal industrial physical safety invariants across the 6 standard actuators."""
        # 1. Hydraulic Press (%QX0.0) cannot move while Transfer Arm (%QX0.1) is in die zone
        self.hazard_conditions.append((
            "%QX0.0", "%QX0.1",
            "CRITICAL COLLISION: Hydraulic Press (%QX0.0) closed while Transfer Arm (%QX0.1) was extended inside die zone!"
        ))
        # 2. Clamping Cylinder (%QX0.3) cannot engage while Transfer Arm (%QX0.1) is moving through fixture
        self.hazard_conditions.append((
            "%QX0.3", "%QX0.1",
            "MECHANICAL SHEAR: Clamp (%QX0.3) engaged while Transfer Arm (%QX0.1) was transferring workpiece!"
        ))
        # 3. Dual direction / valve overpressure conflict
        self.hazard_conditions.append((
            "%QX0.0", "%QX0.4",
            "HYDRAULIC DEADLOCK: Hydraulic Press Extend (%QX0.0) and Relief Valve Solenoid (%QX0.4) energized in opposing flow!"
        ))

    def add_rung(self, rung: Rung):
        self.rungs.append(rung)

    def add_hazard_invariant(self, addr_a: str, addr_b: str, description: str):
        self.hazard_conditions.append((addr_a, addr_b, description))

    def evaluate_rung_power_flow(self, rung: Rung, state: PLCState, current_inputs: Dict[str, bool]) -> bool:
        """
        Evaluates whether electrical current flows to the output coil.
        Supports parallel branches (OR logic): returns True if ANY branch is complete.
        """
        for branch in rung.branches:
            branch_conducts = True
            for address, is_normally_closed in branch:
                # 1. Check current scan-cycle inputs first (Real PLC execution order)
                if address in current_inputs:
                    val = current_inputs[address]
                elif address in state.internal_bits:
                    val = state.internal_bits[address]
                elif address in state.outputs:
                    val = state.outputs[address]
                elif address.endswith(".DN"):
                    timer_name = address[:-3]
                    val = state.timers[timer_name].dn if timer_name in state.timers else False
                elif address.endswith(".EN"):
                    timer_name = address[:-3]
                    val = state.timers[timer_name].en if timer_name in state.timers else False
                else:
                    val = False

                # [ / ] (Normally Closed) inverts signal; [ ] (Normally Open) passes signal directly
                contact_closed = (not val) if is_normally_closed else val
                if not contact_closed:
                    branch_conducts = False
                    break  # This series branch is broken

            if branch_conducts:
                return True  # At least one parallel branch delivers current

        return False

    def execute_single_scan_cycle(self, current: PLCState, new_inputs: Dict[str, bool]) -> PLCState:
        """
        Standard IEC 61131-3 Sequential PLC Scan Cycle:
        1. Read Phase: Ingest new physical inputs.
        2. Sequential Rung Execution: Rungs evaluate top-to-bottom with working state updates.
        3. Output drivers tracking: Records which rung energized which coil.
        """
        next_outputs = current.outputs.copy()
        next_bits = current.internal_bits.copy()
        next_timers = {
            k: Timer(v.name, v.preset_ms, v.accum_ms, v.en, v.dn)
            for k, v in current.timers.items()
        }
        energized_rungs: List[int] = []
        output_drivers = current.output_drivers.copy()

        # Working state for intra-scan sequential updates
        working_state = PLCState(
            cycle=current.cycle + 1,
            inputs=new_inputs,
            outputs=next_outputs,
            internal_bits=next_bits,
            timers=next_timers,
            energized_rungs=energized_rungs,
            output_drivers=output_drivers,
            parent=current,
        )

        for rung in self.rungs:
            power_flow = self.evaluate_rung_power_flow(rung, working_state, new_inputs)
            if power_flow:
                energized_rungs.append(rung.rung_id)

            if rung.output_type == "COIL":
                if rung.output_target.startswith("%QX"):
                    next_outputs[rung.output_target] = power_flow
                    if power_flow:
                        output_drivers[rung.output_target] = rung.rung_id
                    elif output_drivers.get(rung.output_target) == rung.rung_id:
                        output_drivers.pop(rung.output_target, None)
                else:
                    next_bits[rung.output_target] = power_flow
                    if power_flow:
                        output_drivers[rung.output_target] = rung.rung_id
                    elif output_drivers.get(rung.output_target) == rung.rung_id:
                        output_drivers.pop(rung.output_target, None)

            elif rung.output_type == "OTL":  # Latch (Set)
                if power_flow:
                    if rung.output_target.startswith("%QX"):
                        next_outputs[rung.output_target] = True
                    else:
                        next_bits[rung.output_target] = True
                    output_drivers[rung.output_target] = rung.rung_id

            elif rung.output_type == "OTU":  # Unlatch (Reset)
                if power_flow:
                    if rung.output_target.startswith("%QX"):
                        next_outputs[rung.output_target] = False
                    else:
                        next_bits[rung.output_target] = False
                    output_drivers.pop(rung.output_target, None)

            elif rung.output_type == "TON":  # On-Delay Timer
                t_name = rung.output_target
                if t_name not in next_timers:
                    next_timers[t_name] = Timer(name=t_name, preset_ms=rung.preset_ms)
                timer = next_timers[t_name]
                timer.en = power_flow
                if timer.en:
                    timer.accum_ms = min(timer.preset_ms, timer.accum_ms + self.scan_cycle_ms)
                    timer.dn = (timer.accum_ms >= timer.preset_ms)
                    output_drivers[f"{t_name}.DN"] = rung.rung_id
                else:
                    timer.accum_ms = 0
                    timer.dn = False
                    output_drivers.pop(f"{t_name}.DN", None)

        working_state.parent = current
        return working_state

    def check_hazards(self, state: PLCState) -> Optional[Tuple[str, str, str, List[int]]]:
        """Checks if current state violates any physical invariant, and returns fault rung IDs."""
        for addr_a, addr_b, desc in self.hazard_conditions:
            val_a = state.outputs.get(addr_a, False) or state.internal_bits.get(addr_a, False)
            val_b = state.outputs.get(addr_b, False) or state.internal_bits.get(addr_b, False)
            if val_a and val_b:
                fault_rungs = []
                if addr_a in state.output_drivers:
                    fault_rungs.append(state.output_drivers[addr_a])
                if addr_b in state.output_drivers:
                    fault_rungs.append(state.output_drivers[addr_b])
                return (addr_a, addr_b, desc, fault_rungs)
        return None

    def explore_temporal_state_space(
        self,
        initial_state: PLCState,
        candidate_input_permutations: List[Dict[str, bool]],
        nominal_sequence: Optional[List[Dict[str, bool]]] = None,
        max_depth: int = 25,
    ) -> Dict[str, Any]:
        """
        Runs Breadth-First Search over temporal execution paths.
        Guarantees:
        - If safe == False: returns 'replay_mode': 'highlight_crash' with trace[-4:]
        - If safe == True: returns 'replay_mode': 'full_nominal' with full cycle trace
        """
        queue = deque([initial_state])
        visited: Set[Tuple] = set()
        total_states_explored = 0

        while queue:
            curr = queue.popleft()
            total_states_explored += 1

            hazard = self.check_hazards(curr)
            if hazard:
                full_trace = self._reconstruct_trace(curr)
                # Zoom into failure: last 4 cycles leading to impact
                highlight_clip = full_trace[-4:] if len(full_trace) >= 4 else full_trace
                return {
                    "safe": False,
                    "hazard": hazard[2],
                    "collision_coils": [hazard[0], hazard[1]],
                    "fault_rung_ids": hazard[3],
                    "collision_cycle": curr.cycle,
                    "states_explored": total_states_explored,
                    "replay_mode": "highlight_crash",
                    "trace": highlight_clip,
                    "full_trace_length": len(full_trace),
                }

            if curr.cycle >= max_depth:
                continue

            for next_inputs in candidate_input_permutations:
                next_state = self.execute_single_scan_cycle(curr, next_inputs)
                sig = next_state.get_hashable_key()
                if sig not in visited:
                    visited.add(sig)
                    queue.append(next_state)

        # File is VERIFIED SAFE: Execute nominal happy-path to generate full video trace
        nominal_trace = self._generate_nominal_run(initial_state, nominal_sequence)
        return {
            "safe": True,
            "hazard": None,
            "collision_coils": [],
            "fault_rung_ids": [],
            "collision_cycle": None,
            "states_explored": total_states_explored,
            "replay_mode": "full_nominal",
            "trace": nominal_trace,
            "full_trace_length": len(nominal_trace),
        }

    def _generate_nominal_run(
        self,
        initial_state: PLCState,
        nominal_sequence: Optional[List[Dict[str, bool]]] = None,
    ) -> List[Dict[str, Any]]:
        """Simulates full happy-path operational cycle so safe files have full animation."""
        if not nominal_sequence:
            nominal_sequence = [
                {"%IX0.4": True, "%IX0.5": True, "%IX0.2": False},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": False},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": True},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": True},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": False},
            ]

        curr = initial_state
        for inputs in nominal_sequence:
            curr = self.execute_single_scan_cycle(curr, inputs)

        return self._reconstruct_trace(curr)

    def _reconstruct_trace(self, state: PLCState) -> List[Dict[str, Any]]:
        trace = []
        curr = state
        while curr is not None:
            trace.append({
                "cycle": curr.cycle,
                "timestamp_ms": curr.cycle * self.scan_cycle_ms,
                "inputs": curr.inputs,
                "outputs": curr.outputs,
                "energized_rungs": curr.energized_rungs,
                "timers": {k: {"accum_ms": v.accum_ms, "dn": v.dn} for k, v in curr.timers.items()},
            })
            curr = curr.parent
        return list(reversed(trace))
