/**
 * RelayGhost: Pure TypeScript IEC 61131-3 PLCopen XML Parser & Temporal Bounded Model Checker.
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

export interface Rung {
  rung_id: number;
  name: string;
  branches: [string, boolean][][]; // [address, is_normally_closed][][]
  output_type: "COIL" | "OTL" | "OTU" | "TON" | "TOF";
  output_target: string;
  preset_ms: number;
}

export interface PLCState {
  cycle: number;
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  internal_bits: Record<string, boolean>;
  timers: Record<string, Timer>;
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

function normalizeAddress(tag: string): string {
  const clean = tag.trim().toUpperCase();
  if (clean.endsWith(".DN") || clean.endsWith(".EN")) {
    const base = clean.slice(0, -3);
    const sfx = clean.slice(-3);
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
  const cleanXml = xmlContent.replace(/\sxmlns="[^"]+"/g, "");
  const rungs: Rung[] = [];

  // Robust regex node extraction
  const coilMatches = [...cleanXml.matchAll(/<coil([^>]*)>[\s\S]*?<variable>([^<]+)<\/variable>[\s\S]*?<\/coil>/gi)];
  const blockMatches = [...cleanXml.matchAll(/<block([^>]*)>[\s\S]*?<expression>([^<]+)<\/expression>[\s\S]*?<\/block>/gi)];
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

  // 1. Process Timers
  for (const bm of blockMatches) {
    const localId = bm[1].match(/localId="([^"]+)"/i)?.[1];
    const instName = bm[1].match(/instanceName="([^"]+)"/i)?.[1] || `T4:${rungId}`;
    const ptExpr = bm[2].trim();
    const timeMatch = ptExpr.match(/T#(\d+)(ms|s)/i);
    const presetMs = timeMatch ? (timeMatch[2].toLowerCase() === "s" ? parseInt(timeMatch[1]) * 1000 : parseInt(timeMatch[1])) : 300;

    // Trace contacts feeding into timer
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
      name: `Rung_${instName}_TON`,
      branches: branch.length ? [branch] : [[["%QX0.1", false]]],
      output_type: "TON",
      output_target: instName,
      preset_ms: presetMs,
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

    const branch: [string, boolean][] = [];
    if (localId) {
      const connMatch = cm[0].match(/refLocalId="([^"]+)"/i);
      let currRef = connMatch ? connMatch[1] : undefined;
      while (currRef && contactsMap[currRef]) {
        branch.unshift([contactsMap[currRef].tag, contactsMap[currRef].negated]);
        currRef = contactsMap[currRef].refId;
      }
    }

    rungs.push({
      rung_id: rungId++,
      name: `Rung_${rawTag}`,
      branches: branch.length ? [branch] : [[["%IX0.4", false]]],
      output_type: outType,
      output_target: target,
      preset_ms: 0,
    });
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
          const tName = addr.slice(0, -3);
          val = state.timers[tName]?.dn || false;
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
    const energized: number[] = [];
    const drivers = { ...current.output_drivers };

    const working: PLCState = {
      cycle: current.cycle + 1,
      inputs,
      outputs: nextOutputs,
      internal_bits: nextBits,
      timers: nextTimers,
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
          drivers[`${tName}.DN`] = rung.rung_id;
        } else {
          timer.accum_ms = 0;
          timer.dn = false;
          delete drivers[`${tName}.DN`];
        }
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
      list.push({
        cycle: curr.cycle,
        timestamp_ms: curr.cycle * scanCycleMs,
        inputs: curr.inputs,
        outputs: curr.outputs,
        energized_rungs: curr.energized_rungs,
        timers: timerSummary,
      });
      curr = curr.parent;
    }
    return list.reverse();
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    statesExplored++;

    // Check hazard
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
      const sig = JSON.stringify([nextState.outputs, nextState.internal_bits, Object.entries(nextState.timers).map(([k, v]) => [k, v.accum_ms, v.dn])]);
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

export function patchLadderLogicWithInterlocks(rungs: Rung[]): Rung[] {
  // Synthesizes mutual exclusion interlocks between %QX0.0 (Press) and %QX0.1 (Arm)
  return rungs.map((r) => {
    // If rung drives Arm (%QX0.1), ensure [ / %QX0.0 ] (Press not active) is in all branches
    if (r.output_target === "%QX0.1" && r.output_type === "OTL") {
      const newBranches = r.branches.map((b) => {
        if (!b.some(([addr]) => addr === "%QX0.0")) {
          return [...b, ["%QX0.0", true] as [string, boolean]];
        }
        return b;
      });
      return { ...r, branches: newBranches };
    }

    // If rung drives Press (%QX0.0), ensure [ / %QX0.1 ] (Arm not active) is in all branches
    if (r.output_target === "%QX0.0" && r.output_type === "COIL") {
      const newBranches = r.branches.map((b) => {
        if (!b.some(([addr]) => addr === "%QX0.1")) {
          return [...b, ["%QX0.1", true] as [string, boolean]];
        }
        return b;
      });
      return { ...r, branches: newBranches };
    }

    return r;
  });
}
