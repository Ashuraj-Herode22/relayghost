import { NextRequest, NextResponse } from "next/server";
import { parsePlcopenXml, executeModelChecker, Rung } from "@/lib/plcVerifier";
import { BENCHMARKS } from "@/lib/benchmarkPresets";

const PRESET_INDEX_MAP: Record<string, string> = {
  "1": "known-errors/01_stamping_press_missing_interlock.xml",
  "2": "test-for-yourself/02_pneumatic_estop_timer_race.xml",
  "3": "test-for-yourself/03_rolls_royce_ears_interlock_baseline.xml",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let rungs: Rung[] = [];

    // Mode A: Re-verify patched rungs
    if (body.patchedRungs && Array.isArray(body.patchedRungs)) {
      rungs = body.patchedRungs;
    }
    // Mode B: Raw XML string uploaded
    else if (body.xml && typeof body.xml === "string") {
      rungs = parsePlcopenXml(body.xml);
    }
    // Mode C: Preset ID (1, 2, 3 or full benchmark id)
    else if (body.preset) {
      const targetId = PRESET_INDEX_MAP[String(body.preset)] || String(body.preset);
      const found = BENCHMARKS.find((b) => b.id === targetId || b.id.includes(targetId));
      if (found) {
        rungs = parsePlcopenXml(found.xml);
      } else {
        // Safe local disk fallback with try/catch
        try {
          const fs = await import("fs");
          const path = await import("path");
          const fullPath = path.resolve(process.cwd(), "..", "plc-benchmarks", targetId);
          if (fs.existsSync(fullPath)) {
            const xml = fs.readFileSync(fullPath, "utf-8");
            rungs = parsePlcopenXml(xml);
          } else {
            return NextResponse.json(
              { error: `Preset benchmark '${targetId}' not found in presets or disk` },
              { status: 404 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: `Preset benchmark '${targetId}' not found` },
            { status: 404 }
          );
        }
      }
    } else {
      return NextResponse.json({ error: "Missing xml, preset, or patchedRungs in payload" }, { status: 400 });
    }

    if (!rungs.length) {
      return NextResponse.json({ error: "Could not parse any valid Ladder Diagram rungs from XML" }, { status: 422 });
    }

    // Execute the temporal bounded model checker
    const result = executeModelChecker(rungs);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal verification error" }, { status: 500 });
  }
}
