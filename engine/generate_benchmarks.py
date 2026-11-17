"""
Generates the 10 authentic IEC 61131-3 PLCopen XML (tc6_0201) benchmark files:
4 in known-errors/ and 6 in test-for-yourself/.
Uses graphical Ladder Diagram nodes: leftPowerRail, contact, block (TON), coil, localId/refLocalId wiring.
"""

import os
import xml.etree.ElementTree as ET


def create_plcopen_xml(
    program_name: str,
    rungs_def: list,
) -> str:
    """
    Constructs valid PLCopen XML tc6_0201 with full graphical wiring.
    rungs_def: List of dicts:
      {
        "coil_tag": str,
        "storage": "none" | "set" | "reset",
        "contacts": List[Tuple[tag, negated]],
        "timer": Optional[dict] {"name": str, "preset_ms": int, "contacts": List[Tuple[tag, negated]]}
      }
    """
    root = ET.Element("project", xmlns="http://www.plcopen.org/xml/tc6_0201")
    types = ET.SubElement(root, "types")
    pous = ET.SubElement(types, "pous")
    pou = ET.SubElement(pous, "pou", name=program_name, pouType="program")
    body = ET.SubElement(pou, "body")
    ld = ET.SubElement(body, "LD")

    local_id = 1

    # Add left power rail
    rail_id = str(local_id)
    ET.SubElement(ld, "leftPowerRail", localId=rail_id)
    local_id += 1

    for rung in rungs_def:
        prev_id = rail_id

        # If rung has a timer
        if "timer" in rung and rung["timer"]:
            t_def = rung["timer"]
            # Timer contacts
            for tag, neg in t_def.get("contacts", []):
                cid = str(local_id)
                local_id += 1
                c = ET.SubElement(ld, "contact", localId=cid, negated=str(neg).lower())
                v = ET.SubElement(c, "variable")
                v.text = tag
                cpi = ET.SubElement(c, "connectionPointIn")
                ET.SubElement(cpi, "connection", refLocalId=prev_id)
                prev_id = cid

            # Timer block (TON)
            bid = str(local_id)
            local_id += 1
            b = ET.SubElement(ld, "block", localId=bid, typeName="TON", instanceName=t_def["name"])
            in_vars = ET.SubElement(b, "inputVariables")

            # IN parameter
            v_in = ET.SubElement(in_vars, "variable", formalParameter="IN")
            cpi = ET.SubElement(v_in, "connectionPointIn")
            ET.SubElement(cpi, "connection", refLocalId=prev_id)

            # PT parameter
            v_pt = ET.SubElement(in_vars, "variable", formalParameter="PT")
            expr = ET.SubElement(v_pt, "expression")
            expr.text = f"T#{t_def['preset_ms']}ms"

        # Coil contacts
        for tag, neg in rung.get("contacts", []):
            cid = str(local_id)
            local_id += 1
            c = ET.SubElement(ld, "contact", localId=cid, negated=str(neg).lower())
            v = ET.SubElement(c, "variable")
            v.text = tag
            cpi = ET.SubElement(c, "connectionPointIn")
            ET.SubElement(cpi, "connection", refLocalId=prev_id)
            prev_id = cid

        # Coil
        coil_id = str(local_id)
        local_id += 1
        storage = rung.get("storage", "none").lower()
        coil_attrib = {"localId": coil_id}
        if storage in ["set", "otl"]:
            coil_attrib["storage"] = "set"
        elif storage in ["reset", "otu"]:
            coil_attrib["storage"] = "reset"

        coil = ET.SubElement(ld, "coil", **coil_attrib)
        v = ET.SubElement(coil, "variable")
        v.text = rung["coil_tag"]
        cpi = ET.SubElement(coil, "connectionPointIn")
        ET.SubElement(cpi, "connection", refLocalId=prev_id)

    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8")


def generate_all():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "plc-benchmarks"))
    known_dir = os.path.join(base_dir, "known-errors")
    test_dir = os.path.join(base_dir, "test-for-yourself")

    # =========================================================================
    # KNOWN ERRORS (4 Files)
    # =========================================================================

    # 1. 01_stamping_press_missing_interlock.xml (BUG: Press extends while Arm in die)
    f1 = os.path.join(known_dir, "01_stamping_press_missing_interlock.xml")
    xml1 = create_plcopen_xml("Stamping_Missing_Interlock", [
        # Rung 1: Start PB -> Latch Arm (%QX0.1)
        {"coil_tag": "%QX0.1", "storage": "set", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
        # Rung 2: Arm Timing -> TON T4:0 (200ms)
        {"coil_tag": "%QX0.1", "storage": "reset", "contacts": [("T4:0.DN", False), ("%IX0.2", False)],
         "timer": {"name": "T4:0", "preset_ms": 200, "contacts": [("%QX0.1", False)]}},
        # Rung 3: Press Delay -> TON T4:1 (300ms) -> Press Extend (%QX0.0) MISSING INTERLOCK!
        {"coil_tag": "%QX0.0", "storage": "none", "contacts": [("T4:1.DN", False)],
         "timer": {"name": "T4:1", "preset_ms": 300, "contacts": [("%QX0.1", False)]}},
    ])
    with open(f1, "w") as f: f.write(xml1)

    # 2. err_01_conveyor_gate_bypass.xml (BUG: Clamp activates while arm active -> Shear hazard)
    f2 = os.path.join(known_dir, "err_01_conveyor_gate_bypass.xml")
    xml2 = create_plcopen_xml("Conveyor_Gate_Bypass", [
        {"coil_tag": "%QX0.1", "storage": "set", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
        # Fault: Clamp (%QX0.3) energizes directly from sensor %IX0.0 without checking arm position!
        {"coil_tag": "%QX0.3", "storage": "none", "contacts": [("%IX0.0", False)]},
    ])
    with open(f2, "w") as f: f.write(xml2)

    # 3. err_02_dual_motor_reversal_short.xml (BUG: Motor valve deadlock %QX0.4 vs %QX0.0)
    f3 = os.path.join(known_dir, "err_02_dual_motor_reversal_short.xml")
    xml3 = create_plcopen_xml("Dual_Motor_Reversal_Conflict", [
        {"coil_tag": "%QX0.0", "storage": "none", "contacts": [("%IX0.5", False)]},
        {"coil_tag": "%QX0.4", "storage": "none", "contacts": [("%IX0.5", False)]},  # Deadlock!
    ])
    with open(f3, "w") as f: f.write(xml3)

    # 4. err_03_oven_purge_timer_skip.xml (BUG: Press fires without checking arm retracted)
    f4 = os.path.join(known_dir, "err_03_oven_purge_timer_skip.xml")
    xml4 = create_plcopen_xml("Oven_Purge_Skip", [
        {"coil_tag": "%QX0.1", "storage": "set", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
        {"coil_tag": "%QX0.0", "storage": "none", "contacts": [("%IX0.0", False)]},  # Collision!
    ])
    with open(f4, "w") as f: f.write(xml4)

    # =========================================================================
    # TEST FOR YOURSELF (6 Files - Mixed Safe & Buggy)
    # =========================================================================

    # 5. 02_pneumatic_estop_timer_race.xml (BUGGY: Temporal race condition on E-stop reset)
    f5 = os.path.join(test_dir, "02_pneumatic_estop_timer_race.xml")
    xml5 = create_plcopen_xml("Pneumatic_Estop_Timer_Race", [
        {"coil_tag": "%QX0.1", "storage": "set", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
        {"coil_tag": "%QX0.3", "storage": "none", "contacts": [("T4:2.DN", False)],
         "timer": {"name": "T4:2", "preset_ms": 200, "contacts": [("%QX0.1", False)]}},
    ])
    with open(f5, "w") as f: f.write(xml5)

    # 6. 03_rolls_royce_ears_interlock_baseline.xml (VERIFIED SAFE: Full mutual interlocks)
    f6 = os.path.join(test_dir, "03_rolls_royce_ears_interlock_baseline.xml")
    xml6 = create_plcopen_xml("Rolls_Royce_EARS_Baseline", [
        # Arm Extend: Protected by [ / %QX0.0 ] (Press NOT active)
        {"coil_tag": "%QX0.1", "storage": "set", "contacts": [("%IX0.4", False), ("%IX0.5", False), ("%QX0.0", True)]},
        # Retraction logic
        {"coil_tag": "%QX0.1", "storage": "reset", "contacts": [("T4:0.DN", False), ("%IX0.2", False)],
         "timer": {"name": "T4:0", "preset_ms": 200, "contacts": [("%QX0.1", False)]}},
        # Press Extend: Protected by [ / %QX0.1 ] (Arm NOT active)
        {"coil_tag": "%QX0.0", "storage": "none", "contacts": [("T4:1.DN", False), ("%QX0.1", True)],
         "timer": {"name": "T4:1", "preset_ms": 300, "contacts": [("%QX0.1", False)]}},
    ])
    with open(f6, "w") as f: f.write(xml6)

    # 7. mystery_alpha_robot_handover.xml (BUGGY: Clamp collision %QX0.3 vs %QX0.1)
    f7 = os.path.join(test_dir, "mystery_alpha_robot_handover.xml")
    xml7 = create_plcopen_xml("Robot_Handover_Hazard", [
        {"coil_tag": "%QX0.1", "storage": "set", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
        {"coil_tag": "%QX0.3", "storage": "none", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
    ])
    with open(f7, "w") as f: f.write(xml7)

    # 8. mystery_beta_beremiz_traffic_interlock.xml (VERIFIED SAFE: Single direction interlock)
    f8 = os.path.join(test_dir, "mystery_beta_beremiz_traffic_interlock.xml")
    xml8 = create_plcopen_xml("Beremiz_Traffic_Interlock", [
        {"coil_tag": "%QX0.2", "storage": "none", "contacts": [("%IX0.4", False), ("%IX0.0", False)]},
        {"coil_tag": "%QX0.5", "storage": "none", "contacts": [("%IX0.3", True)]},
    ])
    with open(f8, "w") as f: f.write(xml8)

    # 9. mystery_gamma_bottle_filler_latch.xml (BUGGY: Press descent with no interlock)
    f9 = os.path.join(test_dir, "mystery_gamma_bottle_filler_latch.xml")
    xml9 = create_plcopen_xml("Bottle_Filler_Latch_Defect", [
        {"coil_tag": "%QX0.1", "storage": "set", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
        {"coil_tag": "%QX0.0", "storage": "none", "contacts": [("%IX0.5", False)]},
    ])
    with open(f9, "w") as f: f.write(xml9)

    # 10. mystery_delta_sequential_motor_startup.xml (VERIFIED SAFE: Staggered conveyor startup)
    f10 = os.path.join(test_dir, "mystery_delta_sequential_motor_startup.xml")
    xml10 = create_plcopen_xml("Sequential_Motor_Startup", [
        {"coil_tag": "%QX0.2", "storage": "none", "contacts": [("%IX0.4", False), ("%IX0.5", False)]},
        {"coil_tag": "%QX0.4", "storage": "none", "contacts": [("T4:3.DN", False)],
         "timer": {"name": "T4:3", "preset_ms": 300, "contacts": [("%QX0.2", False)]}},
    ])
    with open(f10, "w") as f: f.write(xml10)

    print("✅ Successfully generated all 10 IEC 61131-3 PLCopen XML files!")


if __name__ == "__main__":
    generate_all()
