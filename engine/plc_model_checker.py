"""
RelayGhost: Hardened Temporal Bounded Model Checker for IEC 61131-3 Ladder Logic.
Simulates discrete PLC scan cycles, Set/Reset latches (OTL/OTU), Timers (TON, TOF), and Counters (CTU).
Supports parallel OR branches, sequential intra-scan memory updates, persistent fault rung attribution,
and standardized replay JSON contracts.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any
import json
from collections import deque


@dataclass
class Timer:
    name: str
    preset_ms: int
    timer_type: str = "TON"  # 'TON' or 'TOF'
    accum_ms: int = 0
    en: bool = False  # Enable bit
    dn: bool = False  # Done bit


@dataclass
class Counter:
    name: str
    preset: int
    accum: int = 0
    dn: bool = False
    last_in: bool = False


@dataclass
class Rung:
    rung_id: int
    name: str
    # Parallel OR branches: power flows if ANY branch has ALL contacts closed.
    # Each branch is a list of (address, is_normally_closed).
    branches: List[List[Tuple[str, bool]]]
    output_type: str  # 'COIL' | 'OTL' | 'OTU' | 'TON' | 'TOF' | 'CTU'
    output_target: str
    preset_ms: int = 0
    preset_count: int = 0


@dataclass
class PLCState:
    cycle: int
    inputs: Dict[str, bool]
    outputs: Dict[str, bool]
    internal_bits: Dict[str, bool]
    timers: Dict[str, Timer]
    counters: Dict[str, Counter] = field(default_factory=dict)
    energized_rungs: List[int] = field(default_factory=list)
    output_drivers: Dict[str, int] = field(default_factory=dict)  # Persistently tracks which rung last latched/energized each coil
    parent: Optional["PLCState"] = None
    action_taken: str = ""

    def get_hashable_key(self) -> Tuple:
        """Hashable signature of internal memory + timers + counters + outputs (excluding raw external inputs)."""
        timer_sig = tuple((k, v.accum_ms, v.dn) for k, v in sorted(self.timers.items()))
        counter_sig = tuple((k, v.accum, v.dn) for k, v in sorted(self.counters.items()))
        return (
            tuple(sorted(self.outputs.items())),
            tuple(sorted(self.internal_bits.items())),
            timer_sig,
            counter_sig,
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

    def extract_referenced_inputs(self) -> Set[str]:
        """Dynamically identifies all %IX inputs actually referenced in rungs."""
        inputs = set()
        for r in self.rungs:
            for b in r.branches:
                for addr, _ in b:
                    if addr.startswith("%IX"):
                        inputs.add(addr)
        # Default safety fallback
        if not inputs:
            inputs = {"%IX0.4", "%IX0.5", "%IX0.0", "%IX0.2", "%IX0.3"}
        return inputs

    def evaluate_rung_power_flow(self, rung: Rung, state: PLCState, current_inputs: Dict[str, bool]) -> bool:
        """
        Evaluates whether electrical current flows to the output coil.
        Supports parallel branches (OR logic): returns True if ANY branch is complete.
        """
        for branch in rung.branches:
            branch_conducts = True
            for address, is_normally_closed in branch:
                val = False
                if address in current_inputs:
                    val = current_inputs[address]
                elif address in state.internal_bits:
                    val = state.internal_bits[address]
                elif address in state.outputs:
                    val = state.outputs[address]
                elif address.endswith(".DN"):
                    base = address[:-3]
                    if base in state.timers:
                        val = state.timers[base].dn
                    elif base in state.counters:
                        val = state.counters[base].dn
                elif address.endswith(".EN"):
                    base = address[:-3]
                    if base in state.timers:
                        val = state.timers[base].en
                else:
                    val = False

                contact_closed = (not val) if is_normally_closed else val
                if not contact_closed:
                    branch_conducts = False
                    break

            if branch_conducts:
                return True

        return False

    def execute_single_scan_cycle(self, current: PLCState, new_inputs: Dict[str, bool]) -> PLCState:
        """
        Sequential IEC 61131-3 PLC Scan Cycle Execution.
        """
        next_outputs = current.outputs.copy()
        next_bits = current.internal_bits.copy()
        next_timers = {
            k: Timer(v.name, v.preset_ms, v.timer_type, v.accum_ms, v.en, v.dn)
            for k, v in current.timers.items()
        }
        next_counters = {
            k: Counter(v.name, v.preset, v.accum, v.dn, v.last_in)
            for k, v in current.counters.items()
        }
        energized_rungs: List[int] = []
        output_drivers = current.output_drivers.copy()

        working_state = PLCState(
            cycle=current.cycle + 1,
            inputs=new_inputs,
            outputs=next_outputs,
            internal_bits=next_bits,
            timers=next_timers,
            counters=next_counters,
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
                    next_timers[t_name] = Timer(name=t_name, preset_ms=rung.preset_ms, timer_type="TON")
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

            elif rung.output_type == "TOF":  # Off-Delay Timer
                t_name = rung.output_target
                if t_name not in next_timers:
                    next_timers[t_name] = Timer(name=t_name, preset_ms=rung.preset_ms, timer_type="TOF", dn=False)
                timer = next_timers[t_name]
                timer.en = power_flow
                if timer.en:
                    timer.accum_ms = 0
                    timer.dn = True
                    output_drivers[f"{t_name}.DN"] = rung.rung_id
                else:
                    if timer.dn:
                        timer.accum_ms += self.scan_cycle_ms
                        if timer.accum_ms >= timer.preset_ms:
                            timer.dn = False
                            output_drivers.pop(f"{t_name}.DN", None)

            elif rung.output_type == "CTU":  # Up Counter
                c_name = rung.output_target
                if c_name not in next_counters:
                    next_counters[c_name] = Counter(name=c_name, preset=rung.preset_count)
                counter = next_counters[c_name]
                # Rising edge detection
                if power_flow and not counter.last_in:
                    counter.accum += 1
                    counter.dn = (counter.accum >= counter.preset)
                    if counter.dn:
                        output_drivers[f"{c_name}.DN"] = rung.rung_id
                counter.last_in = power_flow

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
                return (addr_a, addr_b, desc, sorted(list(set(fault_rungs))))
        return None

    def explore_temporal_state_space(
        self,
        initial_state: PLCState,
        candidate_input_permutations: Optional[List[Dict[str, bool]]] = None,
        nominal_sequence: Optional[List[Dict[str, bool]]] = None,
        max_depth: int = 25,
        max_states: int = 25000,
    ) -> Dict[str, Any]:
        """
        Runs BFS model checking across temporal state space with safety caps and deduplication.
        """
        if not candidate_input_permutations:
            # Build targeted input permutations based on referenced %IX addresses
            ref_inputs = list(self.extract_referenced_inputs())
            candidate_input_permutations = [
                {k: (k in ["%IX0.4", "%IX0.5", "%IX0.0", "%IX0.3"]) for k in ref_inputs},
                {k: (k in ["%IX0.4", "%IX0.0", "%IX0.2", "%IX0.3"]) for k in ref_inputs},
                {k: (k in ["%IX0.4", "%IX0.3"]) for k in ref_inputs},
                {k: False for k in ref_inputs},  # E-Stop trip
            ]

        queue = deque([initial_state])
        visited: Set[Tuple] = set()
        total_states_explored = 0

        while queue:
            curr = queue.popleft()
            total_states_explored += 1

            hazard = self.check_hazards(curr)
            if hazard:
                full_trace = self._reconstruct_trace(curr)
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

            if curr.cycle >= max_depth or total_states_explored >= max_states:
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
                {"%IX0.4": True, "%IX0.5": True, "%IX0.2": False, "%IX0.0": True, "%IX0.3": True},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": False, "%IX0.0": True, "%IX0.3": True},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": True, "%IX0.0": False, "%IX0.3": True},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": True, "%IX0.0": False, "%IX0.3": True},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": False, "%IX0.0": False, "%IX0.3": True},
                {"%IX0.4": True, "%IX0.5": False, "%IX0.2": False, "%IX0.0": False, "%IX0.3": True},
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
