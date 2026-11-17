"""
RelayGhost: IEC 61131-3 PLCopen XML and JSON Graph Resolver.
Parses authentic graphical Ladder Diagrams (tc6_0201) with localId/refLocalId wiring,
resolves parallel OR branches via graph search, and normalizes tags to universal I/O addresses.
"""

import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple, Any, Optional, Set
import re
import json

from engine.plc_model_checker import Rung, TemporalModelChecker, PLCState


# Universal Tag Mapping Dictionary
TAG_TO_UNIVERSAL_MAP: Dict[str, str] = {
    # Outputs (%QX0.0 - %QX0.5)
    "PRESS_EXTEND": "%QX0.0",
    "HYDRAULIC_PRESS": "%QX0.0",
    "STAMP_CYLINDER": "%QX0.0",
    "PRESS_DOWN": "%QX0.0",
    "%QX0.0": "%QX0.0",

    "ARM_EXTEND": "%QX0.1",
    "TRANSFER_ARM": "%QX0.1",
    "FEED_ROBOT": "%QX0.1",
    "ROBOT_HANDOVER": "%QX0.1",
    "%QX0.1": "%QX0.1",

    "CONVEYOR_RUN": "%QX0.2",
    "INFEED_CONVEYOR": "%QX0.2",
    "AGV_MOTOR": "%QX0.2",
    "%QX0.2": "%QX0.2",

    "PART_CLAMP": "%QX0.3",
    "FIXTURE_LOCK": "%QX0.3",
    "DIVERTER_GATE": "%QX0.3",
    "%QX0.3": "%QX0.3",

    "DRIVE_MOTOR": "%QX0.4",
    "PUMP_VALVE": "%QX0.4",
    "IGNITION_COIL": "%QX0.4",
    "MOTOR_FWD": "%QX0.4",
    "%QX0.4": "%QX0.4",

    "SAFETY_BEACON": "%QX0.5",
    "ALARM_HORN": "%QX0.5",
    "FAULT_LIGHT": "%QX0.5",
    "%QX0.5": "%QX0.5",

    # Inputs (%IX0.0 - %IX0.7)
    "PART_IN_POSITION": "%IX0.0",
    "PART_DETECTED": "%IX0.0",
    "PE_SENSOR_1": "%IX0.0",
    "%IX0.0": "%IX0.0",

    "PRESS_RETRACTED_LS": "%IX0.1",
    "PRESS_UP_LIMIT": "%IX0.1",
    "%IX0.1": "%IX0.1",

    "ARM_RETRACTED_LS": "%IX0.2",
    "ARM_HOME_SW": "%IX0.2",
    "%IX0.2": "%IX0.2",

    "LIGHT_CURTAIN": "%IX0.3",
    "OPTICAL_SAFETY": "%IX0.3",
    "SAFETY_MAT": "%IX0.3",
    "%IX0.3": "%IX0.3",

    "EMERGENCY_STOP": "%IX0.4",
    "ESTOP_HEALTHY": "%IX0.4",
    "SAFETY_OK": "%IX0.4",
    "%IX0.4": "%IX0.4",

    "CYCLE_START_PB": "%IX0.5",
    "START_BUTTON": "%IX0.5",
    "%IX0.5": "%IX0.5",

    "GATE_CLOSED_SW": "%IX0.6",
    "INTERLOCK_GATE": "%IX0.6",
    "%IX0.6": "%IX0.6",

    "FAULT_RESET_PB": "%IX0.7",
    "SYSTEM_RESET": "%IX0.7",
    "%IX0.7": "%IX0.7",
}


def normalize_address(tag: str) -> str:
    """Normalizes industrial tag names to standard IEC 61131-3 addresses."""
    tag_clean = tag.strip().upper()
    if tag_clean in TAG_TO_UNIVERSAL_MAP:
        return TAG_TO_UNIVERSAL_MAP[tag_clean]
    # Handle timer done bits like T4:1.DN or TON_1.DN
    if tag_clean.endswith(".DN") or tag_clean.endswith(".EN"):
        base = tag_clean[:-3]
        suffix = tag_clean[-3:]
        norm_base = TAG_TO_UNIVERSAL_MAP.get(base, base)
        return f"{norm_base}{suffix}"
    return tag_clean


class PLCopenXMLParser:
    """
    Parses authentic IEC 61131-3 PLCopen XML (tc6_0201) and constructs executable Rung objects.
    Resolves localId/refLocalId connection graphs into parallel OR branches of serial contacts.
    """

    def parse_xml_string(self, xml_content: str) -> Tuple[List[Rung], Dict[str, Any]]:
        root = ET.fromstring(xml_content)
        # Handle namespaces (e.g., http://www.plcopen.org/xml/tc6_0201)
        ns = {"plc": root.tag.split("}")[0].strip("{")} if "}" in root.tag else {}

        rungs: List[Rung] = []
        metadata: Dict[str, Any] = {
            "pous": [],
            "tag_names": {},
            "raw_element_count": 0,
        }

        # Look for body LD elements
        ld_bodies = root.findall(".//plc:body/plc:LD", ns) if ns else root.findall(".//body/LD")
        if not ld_bodies:
            # Fallback for simplified XML schemas
            return self._parse_fallback_schema(root, metadata)

        rung_counter = 1
        for ld in ld_bodies:
            nodes: Dict[str, ET.Element] = {}
            incoming_edges: Dict[str, List[str]] = {}

            # Map all elements by localId
            for elem in ld:
                local_id = elem.attrib.get("localId")
                if local_id:
                    nodes[local_id] = elem
                    metadata["raw_element_count"] += 1
                    # Extract connections
                    conns = elem.findall(".//plc:connectionPointIn/plc:connection", ns) if ns else elem.findall(".//connectionPointIn/connection")
                    for conn in conns:
                        ref_id = conn.attrib.get("refLocalId")
                        if ref_id:
                            incoming_edges.setdefault(local_id, []).append(ref_id)

            # Find all target endpoints: coils and TON blocks
            coils = ld.findall(".//plc:coil", ns) if ns else ld.findall(".//coil")
            blocks = ld.findall(".//plc:block", ns) if ns else ld.findall(".//block")

            # 1. Parse TON Timer Blocks
            for block in blocks:
                type_name = block.attrib.get("typeName", "").upper()
                if "TON" in type_name or "TIMER" in type_name:
                    block_id = block.attrib.get("localId")
                    inst_name = block.attrib.get("instanceName", f"T_{rung_counter}")

                    # Extract PT (Preset Time)
                    pt_ms = 300
                    pt_elem = block.find(".//plc:variable[@formalParameter='PT']/plc:expression", ns) if ns else block.find(".//variable[@formalParameter='PT']/expression")
                    if pt_elem is not None and pt_elem.text:
                        pt_text = pt_elem.text.upper()
                        match = re.search(r"T#(\d+)(MS|S)", pt_text)
                        if match:
                            val = int(match.group(1))
                            unit = match.group(2)
                            pt_ms = val * 1000 if unit == "S" else val

                    # Trace paths from power rail to block input
                    branches = self._trace_branches(block_id, nodes, incoming_edges, ns)
                    rungs.append(Rung(
                        rung_id=rung_counter,
                        name=f"Rung_{rung_counter}_{inst_name}_TON",
                        branches=branches if branches else [[("%IX0.4", False)]],
                        output_type="TON",
                        output_target=inst_name,
                        preset_ms=pt_ms,
                    ))
                    rung_counter += 1

            # 2. Parse Coils
            for coil in coils:
                coil_id = coil.attrib.get("localId")
                var_elem = coil.find("plc:variable", ns) if ns else coil.find("variable")
                raw_tag = var_elem.text.strip() if var_elem is not None and var_elem.text else f"OUT_{rung_counter}"
                target_address = normalize_address(raw_tag)
                metadata["tag_names"][target_address] = raw_tag

                # Check storage modifier (OTL / OTU / standard COIL)
                storage = coil.attrib.get("storage", "").upper()
                output_type = "COIL"
                if storage == "SET" or "OTL" in storage:
                    output_type = "OTL"
                elif storage == "RESET" or "OTU" in storage:
                    output_type = "OTU"

                branches = self._trace_branches(coil_id, nodes, incoming_edges, ns)
                rungs.append(Rung(
                    rung_id=rung_counter,
                    name=f"Rung_{rung_counter}_{raw_tag}",
                    branches=branches if branches else [[("%IX0.4", False)]],
                    output_type=output_type,
                    output_target=target_address,
                ))
                rung_counter += 1

        return rungs, metadata

    def _trace_branches(
        self,
        target_id: str,
        nodes: Dict[str, ET.Element],
        incoming_edges: Dict[str, List[str]],
        ns: Dict[str, str],
    ) -> List[List[Tuple[str, bool]]]:
        """
        Backtracks through connectionPointIn references from coil back to leftPowerRail.
        Constructs all parallel paths (OR branches) where each path is a series list of contacts.
        """
        all_paths: List[List[str]] = []

        def dfs(current_id: str, current_path: List[str]):
            # If we reached leftPowerRail or a dead end
            parents = incoming_edges.get(current_id, [])
            if not parents:
                all_paths.append(list(reversed(current_path)))
                return

            for parent_id in parents:
                parent_elem = nodes.get(parent_id)
                tag_name = parent_elem.tag.split("}")[-1] if parent_elem is not None else ""
                if tag_name == "leftPowerRail":
                    all_paths.append(list(reversed(current_path)))
                else:
                    dfs(parent_id, current_path + [parent_id])

        dfs(target_id, [])

        branches: List[List[Tuple[str, bool]]] = []
        for path in all_paths:
            branch_contacts: List[Tuple[str, bool]] = []
            for node_id in path:
                elem = nodes.get(node_id)
                if elem is None:
                    continue
                tag_name = elem.tag.split("}")[-1]
                if tag_name == "contact":
                    var_elem = elem.find("plc:variable", ns) if ns else elem.find("variable")
                    raw_var = var_elem.text.strip() if var_elem is not None and var_elem.text else ""
                    norm_var = normalize_address(raw_var)
                    negated = elem.attrib.get("negated", "false").lower() == "true"
                    branch_contacts.append((norm_var, negated))
                elif tag_name == "block":
                    inst_name = elem.attrib.get("instanceName", "")
                    if inst_name:
                        branch_contacts.append((f"{inst_name}.DN", False))

            if branch_contacts:
                branches.append(branch_contacts)

        return branches if branches else []

    def _parse_fallback_schema(self, root: ET.Element, metadata: Dict[str, Any]) -> Tuple[List[Rung], Dict[str, Any]]:
        """Parses simplified XML schemas where <rung> tags are defined directly."""
        rungs: List[Rung] = []
        rung_elems = root.findall(".//rung")
        for idx, r_elem in enumerate(rung_elems, start=1):
            name = r_elem.attrib.get("name", f"Rung_{idx}")
            out_target = normalize_address(r_elem.attrib.get("target", f"%QX0.{idx}"))
            out_type = r_elem.attrib.get("type", "COIL").upper()
            preset_ms = int(r_elem.attrib.get("preset_ms", "0"))

            branches: List[List[Tuple[str, bool]]] = []
            for b_elem in r_elem.findall("branch"):
                contacts: List[Tuple[str, bool]] = []
                for c_elem in b_elem.findall("contact"):
                    tag = normalize_address(c_elem.attrib.get("address", ""))
                    is_nc = c_elem.attrib.get("negated", "false").lower() == "true"
                    contacts.append((tag, is_nc))
                if contacts:
                    branches.append(contacts)

            if not branches:
                branches = [[("%IX0.4", False)]]

            rungs.append(Rung(
                rung_id=idx,
                name=name,
                branches=branches,
                output_type=out_type,
                output_target=out_target,
                preset_ms=preset_ms,
            ))

        return rungs, metadata


def parse_plc_file(file_path: str) -> Tuple[List[Rung], Dict[str, Any]]:
    """Loads and parses any PLC file (PLCopen XML or JSON)."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if file_path.endswith(".json"):
        data = json.loads(content)
        rungs = []
        for r in data.get("rungs", []):
            branches = []
            for b in r.get("branches", []):
                branches.append([(c["address"], c.get("negated", False)) for c in b])
            rungs.append(Rung(
                rung_id=r["rung_id"],
                name=r["name"],
                branches=branches,
                output_type=r["output_type"],
                output_target=normalize_address(r["output_target"]),
                preset_ms=r.get("preset_ms", 0),
            ))
        return rungs, {"format": "json"}

    # Default to PLCopen XML
    parser = PLCopenXMLParser()
    return parser.parse_xml_string(content)
