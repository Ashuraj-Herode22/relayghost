"""
RelayGhost: Hardened IEC 61131-3 PLCopen XML and JSON Graph Resolver.
Parses both tc6_0200 and tc6_0201 formats by dynamically stripping XML namespaces.
Guards DFS traversal with per-path visited sets to prevent recursion loops on seal-in latches.
Supports TON, TOF, and CTU function blocks and includes keyword fallback address mapping.
"""

import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple, Any, Optional, Set
import re
import json

from engine.plc_model_checker import Rung


KEYWORD_FALLBACK_PATTERNS = [
    # Outputs (%QX0.0 - %QX0.5)
    (r"(PRESS|PUNCH|STAMP)", "%QX0.0"),
    (r"(ARM|ROBOT|TRANSFER|FEED)", "%QX0.1"),
    (r"(CONVEYOR|BELT|AGV)", "%QX0.2"),
    (r"(CLAMP|FIXTURE|DIVERTER|GATE_CYL)", "%QX0.3"),
    (r"(MOTOR|PUMP|VALVE|OVEN|HEATER)", "%QX0.4"),
    (r"(ALARM|BEACON|HORN|FAULT_LIGHT)", "%QX0.5"),

    # Inputs (%IX0.0 - %IX0.7)
    (r"(PART_IN|PART_DETECT|PE_SENSOR|PART_PRESENT)", "%IX0.0"),
    (r"(PRESS_UP|PRESS_RETRACT)", "%IX0.1"),
    (r"(ARM_HOME|ARM_RETRACT)", "%IX0.2"),
    (r"(LIGHT_CURTAIN|OPTICAL_SAFETY|SAFETY_MAT)", "%IX0.3"),
    (r"(ESTOP|EMERGENCY_STOP|SAFETY_OK)", "%IX0.4"),
    (r"(CYCLE_START|START_BUTTON|START_PB)", "%IX0.5"),
    (r"(GATE_CLOSED|INTERLOCK_GATE)", "%IX0.6"),
    (r"(FAULT_RESET|SYSTEM_RESET|RESET_PB)", "%IX0.7"),
]


def normalize_address(tag: str) -> str:
    """Normalizes industrial tag names to standard IEC 61131-3 addresses."""
    tag_clean = tag.strip().upper()

    # Exact matches or timer done bits
    if tag_clean.endswith(".DN") or tag_clean.endswith(".EN"):
        base = tag_clean[:-3]
        suffix = tag_clean[-3:]
        return f"{normalize_address(base)}{suffix}"

    if tag_clean.startswith("%QX") or tag_clean.startswith("%IX") or tag_clean.startswith("%MX"):
        return tag_clean

    for pattern, mapped_addr in KEYWORD_FALLBACK_PATTERNS:
        if re.search(pattern, tag_clean):
            return mapped_addr

    return tag_clean


class PLCopenXMLParser:
    """
    Parses authentic IEC 61131-3 PLCopen XML and constructs executable Rung objects.
    Resolves localId/refLocalId connection graphs into parallel OR branches of serial contacts.
    """

    def parse_xml_string(self, xml_content: str) -> Tuple[List[Rung], Dict[str, Any]]:
        # Dynamically strip namespaces so both tc6_0200 and tc6_0201 parse cleanly
        clean_xml = re.sub(r'\sxmlns="[^"]+"', '', xml_content)
        root = ET.fromstring(clean_xml)

        rungs: List[Rung] = []
        metadata: Dict[str, Any] = {
            "pous": [],
            "tag_names": {},
            "raw_element_count": 0,
        }

        ld_bodies = root.findall(".//body/LD")
        if not ld_bodies:
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
                    conns = elem.findall(".//connectionPointIn/connection")
                    for conn in conns:
                        ref_id = conn.attrib.get("refLocalId")
                        if ref_id:
                            incoming_edges.setdefault(local_id, []).append(ref_id)

            # Find all target endpoints: coils and function blocks
            coils = ld.findall(".//coil")
            blocks = ld.findall(".//block")

            # 1. Parse Timer and Counter Blocks (TON, TOF, CTU)
            for block in blocks:
                type_name = block.attrib.get("typeName", "").upper()
                block_id = block.attrib.get("localId")
                inst_name = block.attrib.get("instanceName", f"FB_{rung_counter}")

                # Preset Time (PT) for Timers
                pt_ms = 300
                pt_elem = block.find(".//variable[@formalParameter='PT']/expression")
                if pt_elem is not None and pt_elem.text:
                    match = re.search(r"T#(\d+)(MS|S)", pt_elem.text.upper())
                    if match:
                        val = int(match.group(1))
                        pt_ms = val * 1000 if match.group(2) == "S" else val

                # Preset Value (PV) for Counters
                pv_count = 5
                pv_elem = block.find(".//variable[@formalParameter='PV']/expression")
                if pv_elem is not None and pv_elem.text:
                    try:
                        pv_count = int(pv_elem.text.strip())
                    except ValueError:
                        pass

                branches = self._trace_branches(block_id, nodes, incoming_edges)
                output_type = "TON"
                if "TOF" in type_name:
                    output_type = "TOF"
                elif "CTU" in type_name:
                    output_type = "CTU"

                rungs.append(Rung(
                    rung_id=rung_counter,
                    name=f"Rung_{rung_counter}_{inst_name}_{output_type}",
                    branches=branches if branches else [[("%IX0.4", False)]],
                    output_type=output_type,
                    output_target=inst_name,
                    preset_ms=pt_ms,
                    preset_count=pv_count,
                ))
                rung_counter += 1

            # 2. Parse Coils
            for coil in coils:
                coil_id = coil.attrib.get("localId")
                var_elem = coil.find("variable")
                raw_tag = var_elem.text.strip() if var_elem is not None and var_elem.text else f"OUT_{rung_counter}"
                target_address = normalize_address(raw_tag)
                metadata["tag_names"][target_address] = raw_tag

                storage = coil.attrib.get("storage", "").upper()
                output_type = "COIL"
                if storage in ["SET", "OTL"]:
                    output_type = "OTL"
                elif storage in ["RESET", "OTU"]:
                    output_type = "OTU"

                branches = self._trace_branches(coil_id, nodes, incoming_edges)
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
    ) -> List[List[Tuple[str, bool]]]:
        """
        Backtracks through connectionPointIn references from coil back to leftPowerRail.
        Guards with visited sets to prevent infinite loops on seal-in latches.
        """
        all_paths: List[List[str]] = []

        def dfs(current_id: str, current_path: List[str], visited_in_path: Set[str]):
            parents = incoming_edges.get(current_id, [])
            if not parents:
                all_paths.append(list(reversed(current_path)))
                return

            for parent_id in parents:
                if parent_id in visited_in_path:
                    # Prevent cycle from seal-in latch feedback loop
                    continue

                parent_elem = nodes.get(parent_id)
                tag_name = parent_elem.tag if parent_elem is not None else ""
                if tag_name == "leftPowerRail":
                    all_paths.append(list(reversed(current_path)))
                else:
                    dfs(parent_id, current_path + [parent_id], visited_in_path | {parent_id})

        dfs(target_id, [], {target_id})

        branches: List[List[Tuple[str, bool]]] = []
        for path in all_paths:
            branch_contacts: List[Tuple[str, bool]] = []
            for node_id in path:
                elem = nodes.get(node_id)
                if elem is None:
                    continue
                tag_name = elem.tag
                if tag_name == "contact":
                    var_elem = elem.find("variable")
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

    parser = PLCopenXMLParser()
    return parser.parse_xml_string(content)
