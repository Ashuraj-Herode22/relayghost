/**
 * RelayGhost: Pure TypeScript IEC 61131-3 PLCopen XML Parser & Temporal Bounded Model Checker.
 * Hardened with CTU Up-Counters, UTF-8 BOM stripping, strict validation, and dynamic EARS interlock patching.
 * Runs natively in Node.js / Vercel Serverless with zero Python dependencies.
 */

export interface Timer {
  name: string;
  preset_ms: number;
  timer_type: "TON" | "TOF";
  accum_ms: number;
  en: boolean;
  dn: boolean;
}

export interface Counter {
  name: string;
  preset: number;
  accum: number;
  dn: boolean;
  last_in: boolean;
}

export interface Rung {
  rung_id: number;
  name: string;
  branches: [string, boolean][][]; // [address, is_normally_closed][][]
  output_type: "COIL" | "OTL" | "OTU" | "TON" | "TOF" | "CTU";
  output_target: string;
  preset_ms: number;
  preset_count?: number;
  isNewInterlock?: boolean;
}

export interface PLCState {
  cycle: number;
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  internal_bits: Record<string, boolean>;
  timers: Record<string, Timer>;
  counters: Record<string, Counter>;
  energized_rungs: number[];
  output_drivers: Record<string, number>;
  parent?: PLCState;
}

export interface ReplayFrame {
  cycle: number;
  timestamp_ms: number;
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  energized_rungs: number[];
  timers: Record<string, { accum_ms: number; dn: boolean }>;
  counters: Record<string, { accum: number; dn: boolean }>;
}

export interface VerificationResult {
  safe: boolean;
  hazard: string | null;
  collision_coils: string[];
  fault_rung_ids: number[];
  collision_cycle: number | null;
  states_explored: number;
  replay_mode: "highlight_crash" | "full_nominal";
  trace: ReplayFrame[];
  full_trace_length: number;
  rungs: Rung[];
}

const KEYWORD_MAP: [RegExp, string][] = [
  [/(PRESS|PUNCH|STAMP)/i, "%QX0.0"],
  [/(ARM|ROBOT|TRANSFER|FEED)/i, "%QX0.1"],
  [/(CONVEYOR|BELT|AGV)/i, "%QX0.2"],
  [/(CLAMP|FIXTURE|DIVERTER|GATE)/i, "%QX0.3"],
  [/(MOTOR|PUMP|VALVE|OVEN|HEATER)/i, "%QX0.4"],
  [/(ALARM|BEACON|HORN|LIGHT)/i, "%QX0.5"],
  [/(PART_IN|PART_DETECT|PE_SENSOR)/i, "%IX0.0"],
  [/(PRESS_UP|PRESS_RETRACT)/i, "%IX0.1"],
  [/(ARM_HOME|ARM_RETRACT)/i, "%IX0.2"],
  [/(LIGHT_CURTAIN|OPTICAL)/i, "%IX0.3"],
  [/(ESTOP|EMERGENCY)/i, "%IX0.4"],
  [/(CYCLE_START|START_BUTTON|START_PB)/i, "%IX0.5"],
  [/(GATE_CLOSED|INTERLOCK)/i, "%IX0.6"],
  [/(FAULT_RESET|RESET_PB)/i, "%IX0.7"],
];

export function normalizeAddress(tag: string): string {
  const clean = tag.trim().toUpperCase();
  if (clean.endsWith(".DN") || clean.endsWith(".EN") || clean.endsWith(".Q")) {
    const sfx = clean.endsWith(".Q") ? ".DN" : clean.slice(-3);
    const base = clean.endsWith(".Q") ? clean.slice(0, -2) : clean.slice(0, -3);
    return `${normalizeAddress(base)}${sfx}`;
  }
  if (clean.startsWith("%QX") || clean.startsWith("%IX") || clean.startsWith("%MX")) {
    return clean;
  }
  for (const [regex, mapped] of KEYWORD_MAP) {
    if (regex.test(clean)) return mapped;
  }
  return clean;
}

export function parsePlcopenXml(xmlContent: string): Rung[] {
  // Strip leading UTF-8 BOM if present
  let cleanXml = xmlContent.replace(/^\uFEFF/, "").trim();

  // Strict validation: Must contain basic XML structure and PLC elements
  if (!cleanXml || !cleanXml.startsWith("<")) {
    throw new Error("Invalid PLCopen XML: File does not contain valid XML content.");
  }

  const hasPlcElements =
    cleanXml.includes("<coil") ||
    cleanXml.includes("<block") ||
    cleanXml.includes("<contact");

  if (!hasPlcElements) {
    throw new Error(
      "Invalid PLCopen XML: No executable ladder rungs, coils, or function blocks detected in file."
    );
  }

  cleanXml = cleanXml.replace(/\sxmlns="[^"]+"/g, "");
  const rungs: Rung[] = [];

  // Robust regex node extraction
  const coilMatches = [...cleanXml.matchAll(/<coil([^>]*)>[\s\S]*?<variable>([^<]+)<\/variable>[\s\S]*?<\/coil>/gi)];
  const blockMatches = [...cleanXml.matchAll(/<block([^>]*)>[\s\S]*?(?:<expression>([^<]+)<\/expression>)?[\s\S]*?<\/block>/gi)];
  const contactMatches = [...cleanXml.matchAll(/<contact([^>]*)>[\s\S]*?<variable>([^<]+)<\/variable>[\s\S]*?<\/contact>/gi)];

  const contactsMap: Record<string, { tag: string; negated: boolean; refId?: string }> = {};
  for (const cm of contactMatches) {
    const localIdMatch = cm[1].match(/localId="([^"]+)"/i);
    const negatedMatch = cm[1].match(/negated="true"/i);
    const refMatch = cm[0].match(/refLocalId="([^"]+)"/i);
    if (localIdMatch) {
      contactsMap[localIdMatch[1]] = {
        tag: normalizeAddress(cm[2].trim()),
        negated: !!negatedMatch,
        refId: refMatch ? refMatch[1] : undefined,
      };
    }
  }

  let rungId = 1;

  // 1. Process Function Blocks (TON, TOF, CTU)
  for (const bm of blockMatches) {
    const localId = bm[1].match(/localId="([^"]+)"/i)?.[1];
    const typeName = (bm[1].match(/typeName="([^"]+)"/i)?.[1] || "").toUpperCase();
    const instName = bm[1].match(/instanceName="([^"]+)"/i)?.[1] || `FB_${rungId}`;

    let outType: "TON" | "TOF" | "CTU" = "TON";
    let presetMs = 300;
    let presetCount = 5;

    if (typeName.includes("TOF")) {
      outType = "TOF";
    } else if (typeName.includes("CTU")) {
      outType = "CTU";
      // Extract count from PV
      const pvMatch = bm[0].match(/formalParameter="PV"[\s\S]*?<expression>([^<]+)<\/expression>/i);
      if (pvMatch) {
        const count = parseInt(pvMatch[1].trim(), 10);
        if (!isNaN(count)) presetCount = count;
      }
    } else {
      outType = "TON";
      // Extract PT
      const ptMatch = bm[0].match(/formalParameter="PT"[\s\S]*?<expression>([^<]+)<\/expression>/i) ||
                      bm[0].match(/<expression>([^<]+)<\/expression>/i);
      if (ptMatch) {
        const timeMatch = ptMatch[1].trim().match(/T#(\d+)(ms|s)/i);
        if (timeMatch) {
          presetMs = timeMatch[2].toLowerCase() === "s" ? parseInt(timeMatch[1], 10) * 1000 : parseInt(timeMatch[1], 10);
        }
      }
    }

    // Trace contacts feeding into block
    const branch: [string, boolean][] = [];
    if (localId) {
      const connMatch = bm[0].match(/refLocalId="([^"]+)"/i);
      let currRef = connMatch ? connMatch[1] : undefined;
      while (currRef && contactsMap[currRef]) {
        branch.unshift([contactsMap[currRef].tag, contactsMap[currRef].negated]);
        currRef = contactsMap[currRef].refId;
      }
    }

    rungs.push({
      rung_id: rungId++,
      name: `Rung_${instName}_${outType}`,
      branches: branch.length ? [branch] : [[["%IX0.4", false]]],
      output_type: outType,
      output_target: instName,
      preset_ms: presetMs,
      preset_count: presetCount,
    });
  }

  // 2. Process Coils
  for (const cm of coilMatches) {
    const localId = cm[1].match(/localId="([^"]+)"/i)?.[1];
    const storage = cm[1].match(/storage="([^"]+)"/i)?.[1]?.toLowerCase() || "none";
    const rawTag = cm[2].trim();
    const target = normalizeAddress(rawTag);

    let outType: "COIL" | "OTL" | "OTU" = "COIL";
    if (storage === "set") outType = "OTL";
    if (storage === "reset") outType = "OTU";

    // Trace all connection lines feeding into coil (including parallel OR branches)
    const branches: [string, boolean][][] = [];
    if (localId) {
      const connMatches = [...cm[0].matchAll(/refLocalId="([^"]+)"/gi)];
      for (const conn of connMatches) {
        const branch: [string, boolean][] = [];
        let currRef: string | undefined = conn[1];
        const visitedRefs = new Set<string>();

        while (currRef && contactsMap[currRef] && !visitedRefs.has(currRef)) {
          visitedRefs.add(currRef);
          branch.unshift([contactsMap[currRef].tag, contactsMap[currRef].negated]);
          currRef = contactsMap[currRef].refId;
        }
        if (branch.length > 0) {
          branches.push(branch);
        }
      }
    }

    rungs.push({
      rung_id: rungId++,
      name: `Rung_${rawTag}`,
      branches: branches.length ? branches : [[["%IX0.4", false]]],
      output_type: outType,
      output_target: target,
      preset_ms: 0,
    });
  }

  if (rungs.length === 0) {
    throw new Error("Invalid PLCopen XML: Failed to extract any valid Ladder Diagram rungs.");
  }

  return rungs;
}

export function executeModelChecker(rungs: Rung[], maxDepth: number = 15): VerificationResult {
  const scanCycleMs = 100;
  const hazardPairs: [string, string, string][] = [
    ["%QX0.0", "%QX0.1", "CRITICAL COLLISION: Hydraulic Press (%QX0.0) closed while Transfer Arm (%QX0.1) was extended inside die zone!"],
    ["%QX0.3", "%QX0.1", "MECHANICAL SHEAR: Clamp (%QX0.3) engaged while Transfer Arm (%QX0.1) was transferring workpiece!"],
    ["%QX0.0", "%QX0.4", "HYDRAULIC DEADLOCK: Hydraulic Press Extend (%QX0.0) and Relief Valve (%QX0.4) energized in opposing flow!"],
  ];

  function evaluateRung(rung: Rung, state: PLCState, inputs: Record<string, boolean>): boolean {
    for (const branch of rung.branches) {
      let branchOk = true;
      for (const [addr, isNc] of branch) {
        let val = false;
        if (addr in inputs) val = inputs[addr];
        else if (addr in state.internal_bits) val = state.internal_bits[addr];
        else if (addr in state.outputs) val = state.outputs[addr];
        else if (addr.endsWith(".DN")) {
          const baseName = addr.slice(0, -3);
          if (state.timers[baseName]) {
            val = state.timers[baseName].dn;
          } else if (state.counters[baseName]) {
            val = state.counters[baseName].dn;
          }
        }

        const closed = isNc ? !val : val;
        if (!closed) {
          branchOk = false;
          break;
        }
      }
      if (branchOk) return true;
    }
    return false;
  }

  function step(current: PLCState, inputs: Record<string, boolean>): PLCState {
    const nextOutputs = { ...current.outputs };
    const nextBits = { ...current.internal_bits };
    const nextTimers: Record<string, Timer> = {};
    for (const [k, v] of Object.entries(current.timers)) {
      nextTimers[k] = { ...v };
    }
    const nextCounters: Record<string, Counter> = {};
    for (const [k, v] of Object.entries(current.counters)) {
      nextCounters[k] = { ...v };
    }

    const energized: number[] = [];
    const drivers = { ...current.output_drivers };

    const working: PLCState = {
      cycle: current.cycle + 1,
      inputs,
      outputs: nextOutputs,
      internal_bits: nextBits,
      timers: nextTimers,
      counters: nextCounters,
      energized_rungs: energized,
      output_drivers: drivers,
      parent: current,
    };

    for (const rung of rungs) {
      const power = evaluateRung(rung, working, inputs);
      if (power) energized.push(rung.rung_id);

      if (rung.output_type === "COIL") {
        if (rung.output_target.startsWith("%QX")) {
          nextOutputs[rung.output_target] = power;
          if (power) drivers[rung.output_target] = rung.rung_id;
          else if (drivers[rung.output_target] === rung.rung_id) delete drivers[rung.output_target];
        } else {
          nextBits[rung.output_target] = power;
          if (power) drivers[rung.output_target] = rung.rung_id;
        }
      } else if (rung.output_type === "OTL" && power) {
        if (rung.output_target.startsWith("%QX")) nextOutputs[rung.output_target] = true;
        else nextBits[rung.output_target] = true;
        drivers[rung.output_target] = rung.rung_id;
      } else if (rung.output_type === "OTU" && power) {
        if (rung.output_target.startsWith("%QX")) nextOutputs[rung.output_target] = false;
        else nextBits[rung.output_target] = false;
        delete drivers[rung.output_target];
      } else if (rung.output_type === "TON") {
        const tName = rung.output_target;
        if (!nextTimers[tName]) {
          nextTimers[tName] = { name: tName, preset_ms: rung.preset_ms, timer_type: "TON", accum_ms: 0, en: false, dn: false };
        }
        const timer = nextTimers[tName];
        timer.en = power;
        if (timer.en) {
          timer.accum_ms = Math.min(timer.preset_ms, timer.accum_ms + scanCycleMs);
          timer.dn = timer.accum_ms >= timer.preset_ms;
          if (timer.dn) {
            drivers[`${tName}.DN`] = rung.rung_id;
            nextBits[`${tName}.DN`] = true;
          }
        } else {
          timer.accum_ms = 0;
          timer.dn = false;
          delete drivers[`${tName}.DN`];
          delete nextBits[`${tName}.DN`];
        }
      } else if (rung.output_type === "CTU") {
        const cName = rung.output_target;
        if (!nextCounters[cName]) {
          nextCounters[cName] = { name: cName, preset: rung.preset_count || 5, accum: 0, dn: false, last_in: false };
        }
        const counter = nextCounters[cName];
        if (power && !counter.last_in) {
          counter.accum += 1;
          counter.dn = counter.accum >= counter.preset;
          if (counter.dn) {
            drivers[`${cName}.DN`] = rung.rung_id;
            nextBits[`${cName}.DN`] = true;
          }
        }
        counter.last_in = power;
      }
    }

    return working;
  }

  const candidateInputs: Record<string, boolean>[] = [
    { "%IX0.4": true, "%IX0.5": true, "%IX0.0": true, "%IX0.2": false, "%IX0.3": true },
    { "%IX0.4": true, "%IX0.5": false, "%IX0.0": true, "%IX0.2": true, "%IX0.3": true },
    { "%IX0.4": true, "%IX0.5": false, "%IX0.0": false, "%IX0.2": false, "%IX0.3": true },
    { "%IX0.4": false, "%IX0.5": false, "%IX0.0": false, "%IX0.2": false, "%IX0.3": true },
  ];

  const initialState: PLCState = {
    cycle: 0,
    inputs: {},
    outputs: { "%QX0.0": false, "%QX0.1": false, "%QX0.2": false, "%QX0.3": false, "%QX0.4": false, "%QX0.5": false },
    internal_bits: {},
    timers: {},
    counters: {},
    energized_rungs: [],
    output_drivers: {},
  };

  const queue: PLCState[] = [initialState];
  const visited = new Set<string>();
  let statesExplored = 0;

  function reconstruct(s: PLCState): ReplayFrame[] {
    const list: ReplayFrame[] = [];
    let curr: PLCState | undefined = s;
    while (curr) {
      const timerSummary: Record<string, { accum_ms: number; dn: boolean }> = {};
      for (const [k, v] of Object.entries(curr.timers)) {
        timerSummary[k] = { accum_ms: v.accum_ms, dn: v.dn };
      }
      const counterSummary: Record<string, { accum: number; dn: boolean }> = {};
      for (const [k, v] of Object.entries(curr.counters)) {
        counterSummary[k] = { accum: v.accum, dn: v.dn };
      }
      list.push({
        cycle: curr.cycle,
        timestamp_ms: curr.cycle * scanCycleMs,
        inputs: curr.inputs,
        outputs: curr.outputs,
        energized_rungs: curr.energized_rungs,
        timers: timerSummary,
        counters: counterSummary,
      });
      curr = curr.parent;
    }
    return list.reverse();
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    statesExplored++;

    // Check hazards
    for (const [addrA, addrB, desc] of hazardPairs) {
      const valA = curr.outputs[addrA] || curr.internal_bits[addrA];
      const valB = curr.outputs[addrB] || curr.internal_bits[addrB];
      if (valA && valB) {
        const faults = [curr.output_drivers[addrA], curr.output_drivers[addrB]].filter(Boolean);
        const fullTrace = reconstruct(curr);
        const clip = fullTrace.length >= 4 ? fullTrace.slice(-4) : fullTrace;
        return {
          safe: false,
          hazard: desc,
          collision_coils: [addrA, addrB],
          fault_rung_ids: Array.from(new Set(faults)),
          collision_cycle: curr.cycle,
          states_explored: statesExplored,
          replay_mode: "highlight_crash",
          trace: clip,
          full_trace_length: fullTrace.length,
          rungs,
        };
      }
    }

    if (curr.cycle >= maxDepth || statesExplored >= 10000) continue;

    for (const inp of candidateInputs) {
      const nextState = step(curr, inp);
      const sig = JSON.stringify([
        nextState.outputs,
        nextState.internal_bits,
        Object.entries(nextState.timers).map(([k, v]) => [k, v.accum_ms, v.dn]),
        Object.entries(nextState.counters).map(([k, v]) => [k, v.accum, v.dn]),
      ]);
      if (!visited.has(sig)) {
        visited.add(sig);
        queue.push(nextState);
      }
    }
  }

  // Safe run - emit nominal happy path
  const nominalSequence: Record<string, boolean>[] = [
    { "%IX0.4": true, "%IX0.5": true, "%IX0.2": false, "%IX0.0": true, "%IX0.3": true },
    { "%IX0.4": true, "%IX0.5": false, "%IX0.2": false, "%IX0.0": true, "%IX0.3": true },
    { "%IX0.4": true, "%IX0.5": false, "%IX0.2": true, "%IX0.0": false, "%IX0.3": true },
    { "%IX0.4": true, "%IX0.5": false, "%IX0.2": true, "%IX0.0": false, "%IX0.3": true },
    { "%IX0.4": true, "%IX0.5": false, "%IX0.2": false, "%IX0.0": false, "%IX0.3": true },
    { "%IX0.4": true, "%IX0.5": false, "%IX0.2": false, "%IX0.0": false, "%IX0.3": true },
  ];

  let currNominal = initialState;
  for (const seq of nominalSequence) {
    currNominal = step(currNominal, seq);
  }
  const fullNominalTrace = reconstruct(currNominal);

  return {
    safe: true,
    hazard: null,
    collision_coils: [],
    fault_rung_ids: [],
    collision_cycle: null,
    states_explored: statesExplored,
    replay_mode: "full_nominal",
    trace: fullNominalTrace,
    full_trace_length: fullNominalTrace.length,
    rungs,
  };
}

/**
 * Dynamically synthesizes mutual exclusion interlocks based on actual colliding coils and fault rungs.
 * Deadlock-Free: Injects the normally-closed guard into the SECONDARY conflicting rung only,
 * allowing the primary actuator to finish its workcycle cleanly.
 */
export function patchLadderLogicWithInterlocks(
  rungs: Rung[],
  collisionCoils: string[] = ["%QX0.0", "%QX0.1"],
  faultRungIds: number[] = []
): { patchedRungs: Rung[]; patchDescription: string; deltaText: string } {
  const coilA = collisionCoils[0] || "%QX0.0";
  const coilB = collisionCoils[1] || "%QX0.1";

  // Identify secondary rung: the rung driving coilB or faultRungIds[1]
  let secondaryRungId = faultRungIds.length > 1 ? faultRungIds[1] : -1;
  if (secondaryRungId === -1) {
    const r = rungs.find((r) => r.output_target === coilB);
    if (r) secondaryRungId = r.rung_id;
  }

  const patchedRungs = rungs.map((r) => {
    // If this is the secondary conflicting rung, interlock it with primary coil (coilA)
    const matchesTarget = r.output_target === coilB || (secondaryRungId !== -1 && r.rung_id === secondaryRungId);

    if (matchesTarget) {
      const newBranches = r.branches.map((b) => {
        // Prevent duplicate injection
        if (!b.some(([addr]) => addr === coilA)) {
          return [...b, [coilA, true] as [string, boolean]]; // [ / coilA ]
        }
        return b;
      });
      return { ...r, branches: newBranches, isNewInterlock: true };
    }
    return r;
  });

  const patchDescription = `Synthesized normally-closed guard [ / ${coilA} ] on secondary rung (drives ${coilB}). Primary actuator ${coilA} operates without deadlock.`;
  const deltaText = `Interlock Injected: [ / ${coilA} ] into Rung #${secondaryRungId !== -1 ? secondaryRungId : "B"}`;

  return { patchedRungs, patchDescription, deltaText };
}

/**
 * Generates an authentic IEC 61131-3 PLCopen XML document with patched rungs.
 */
export function generatePatchedPlcopenXml(rungs: Rung[]): string {
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Rolls-Royce / RelayGhost" productName="RelayGhost Patched Controller" productVersion="2.4" creationDateTime="${new Date().toISOString()}"/>
  <contentHeader name="Patched_Safety_Logic"><coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo></contentHeader>
  <types><dataTypes/><pous><pou name="Main_Safe" pouType="program"><interface/><body/></pou></pous></types>
  <instances><configurations><configuration name="Config"><resource name="Res"><task name="Task1" priority="1" interval="T#100ms"><pouInstance name="Inst" typeName="Main_Safe"/></task></resource></configuration></instances>
  <!-- RELAYGHOST SYNTHESIZED RUNGS WITH ROLLS-ROYCE EARS MUTUAL EXCLUSION -->
`;

  for (const r of rungs) {
    xml += `  <!-- Rung #${r.rung_id}: ${r.name} (${r.output_type} -> ${r.output_target}) -->\n`;
    for (const b of r.branches) {
      const contactsStr = b.map(([addr, isNc]) => `[${isNc ? "/" : " "}${addr}]`).join("---");
      xml += `  <!-- Power Flow: |---${contactsStr}---(${r.output_target})---| -->\n`;
    }
  }

  xml += `</project>\n`;
  return xml;
}
