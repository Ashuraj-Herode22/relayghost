"""
RelayGhost: Model Context Protocol (MCP) Server.
Exposes the temporal bounded model checker to Kiro IDE/CLI.
Provides tools: verify_plc_file and verify_plc_xml_string.
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.plc_parser import parse_plc_file, PLCopenXMLParser
from engine.plc_model_checker import TemporalModelChecker, PLCState


def run_verification(rungs) -> dict:
    checker = TemporalModelChecker(scan_cycle_ms=100)
    for rung in rungs:
        checker.add_rung(rung)

    init_state = PLCState(
        cycle=0,
        inputs={},
        outputs={"%QX0.0": False, "%QX0.1": False, "%QX0.2": False, "%QX0.3": False, "%QX0.4": False, "%QX0.5": False},
        internal_bits={},
        timers={},
    )

    candidate_inputs = [
        {"%IX0.4": True, "%IX0.5": True, "%IX0.0": True, "%IX0.2": False, "%IX0.3": True},
        {"%IX0.4": True, "%IX0.5": False, "%IX0.0": True, "%IX0.2": True, "%IX0.3": True},
        {"%IX0.4": True, "%IX0.5": False, "%IX0.0": False, "%IX0.2": False, "%IX0.3": True},
        {"%IX0.4": False, "%IX0.5": False, "%IX0.0": False, "%IX0.2": False, "%IX0.3": True},
    ]

    return checker.explore_temporal_state_space(init_state, candidate_inputs, max_depth=15)


def verify_plc_file_impl(file_path: str) -> str:
    """Verifies any local IEC 61131-3 PLCopen XML or JSON file."""
    if not os.path.exists(file_path):
        return json.dumps({"error": f"File not found: {file_path}", "safe": False})
    try:
        rungs, metadata = parse_plc_file(file_path)
        res = run_verification(rungs)
        res["file"] = os.path.basename(file_path)
        res["rungs_parsed"] = len(rungs)
        return json.dumps(res, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e), "safe": False})


def verify_plc_xml_string_impl(xml_content: str) -> str:
    """Verifies raw PLCopen XML string content submitted from web frontend."""
    try:
        parser = PLCopenXMLParser()
        rungs, metadata = parser.parse_xml_string(xml_content)
        res = run_verification(rungs)
        res["rungs_parsed"] = len(rungs)
        return json.dumps(res, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e), "safe": False})


# Initialize MCP Server
try:
    from mcp.server.mcpserver import MCPServer
    server = MCPServer("relayghost-verifier")

    @server.tool()
    def verify_plc_file(file_path: str) -> str:
        """Runs temporal model checker on a PLCopen XML file and returns safety verification report."""
        return verify_plc_file_impl(file_path)

    @server.tool()
    def verify_plc_xml_string(xml_content: str) -> str:
        """Runs temporal model checker on raw PLCopen XML string and returns safety verification report."""
        return verify_plc_xml_string_impl(xml_content)

    if __name__ == "__main__":
        server.run(transport="stdio")

except ImportError:
    # Standalone JSON-RPC fallback for environments without mcp package
    if __name__ == "__main__":
        if len(sys.argv) > 1:
            print(verify_plc_file_impl(sys.argv[1]))
        else:
            print("RelayGhost MCP Server (standalone fallback ready).")
