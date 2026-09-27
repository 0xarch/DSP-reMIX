import type { GameState } from "../types";
import type { SimulationCheckpointStateChunk } from "../simulation.worker";
import type { AuthoritativeSaveCheckpointOverlay } from "../authoritativeSaveSerializationProtocol";
import type { SimulationRuntimeDurableAppHead } from "../simulationRuntimeDurableAppState";

/** 主入口（App.tsx）拆分出的检查点 / 状态同步工具：
 *  负责 worker 分块检查点的拼装、权威检查点向 UI 状态的同步，
 *  以及 durable recovery 基线一致性的判断。 */

export function serializedPayloadBytes(value: unknown): number {
  try {
    const raw = JSON.stringify(value);
    return typeof TextEncoder === "undefined" ? raw.length : new TextEncoder().encode(raw).byteLength;
  } catch {
    return 0;
  }
}

export interface SimulationCheckpointAccumulator {
  base: Omit<GameState, "entities" | "belts"> | null;
  entityCount: number;
  beltCount: number;
  entities: GameState["entities"];
  belts: GameState["belts"];
}

export function appendSimulationCheckpointChunk(
  current: SimulationCheckpointAccumulator | undefined,
  chunk: SimulationCheckpointStateChunk,
): SimulationCheckpointAccumulator {
  const accumulator = current ?? { base: null, entityCount: -1, beltCount: -1, entities: [], belts: [] };
  if (chunk.kind === "base") {
    if (accumulator.base || accumulator.entities.length > 0 || accumulator.belts.length > 0 ||
      !Number.isSafeInteger(chunk.entityCount) || chunk.entityCount < 0 ||
      !Number.isSafeInteger(chunk.beltCount) || chunk.beltCount < 0) {
      throw new Error("模拟检查点 base 分块顺序无效");
    }
    accumulator.base = chunk.state;
    accumulator.entityCount = chunk.entityCount;
    accumulator.beltCount = chunk.beltCount;
    return accumulator;
  }
  if (!accumulator.base) throw new Error("模拟检查点数据分块早于 base");
  if (chunk.kind === "entities") {
    if (chunk.offset !== accumulator.entities.length || accumulator.entities.length + chunk.values.length > accumulator.entityCount) {
      throw new Error("模拟检查点 entity 分块不连续");
    }
    accumulator.entities.push(...chunk.values);
    return accumulator;
  }
  if (chunk.offset !== accumulator.belts.length || accumulator.belts.length + chunk.values.length > accumulator.beltCount) {
    throw new Error("模拟检查点 belt 分块不连续");
  }
  accumulator.belts.push(...chunk.values);
  return accumulator;
}

export function finishSimulationCheckpointChunks(accumulator: SimulationCheckpointAccumulator | undefined): GameState | undefined {
  if (!accumulator) return undefined;
  if (!accumulator.base || accumulator.entities.length !== accumulator.entityCount || accumulator.belts.length !== accumulator.beltCount) {
    throw new Error("模拟检查点分块缺失");
  }
  return { ...accumulator.base, entities: accumulator.entities, belts: accumulator.belts };
}

export function applyAuthoritativeCheckpointOverlay(
  state: GameState,
  overlay: AuthoritativeSaveCheckpointOverlay | undefined,
): GameState {
  if (!overlay) return state;
  let next = state;
  if (overlay.planetViewports && overlay.planetViewports.length > 0) {
    let planetViewports = state.planetViewports;
    for (const entry of overlay.planetViewports) {
      const previous = planetViewports[entry.planetId];
      const viewport = entry.viewport;
      if (previous?.x === viewport.x && previous.y === viewport.y && previous.zoom === viewport.zoom) continue;
      if (planetViewports === state.planetViewports) planetViewports = { ...state.planetViewports };
      planetViewports[entry.planetId] = viewport;
    }
    if (planetViewports !== state.planetViewports) next = { ...next, planetViewports };
  }
  if (overlay.timeWarp && (
    next.timeWarp.pendingSimulationSeconds !== overlay.timeWarp.pendingSimulationSeconds ||
    next.timeWarp.pendingWallSeconds !== overlay.timeWarp.pendingWallSeconds
  )) {
    next = {
      ...next,
      timeWarp: {
        ...next.timeWarp,
        pendingSimulationSeconds: overlay.timeWarp.pendingSimulationSeconds,
        pendingWallSeconds: overlay.timeWarp.pendingWallSeconds,
      },
    };
  }
  return next;
}

export function sameDurableRecoveryBaseIdentity(
  left: SimulationRuntimeDurableAppHead["baseIdentity"],
  right: SimulationRuntimeDurableAppHead["baseIdentity"],
): boolean {
  return left.mode === right.mode &&
    left.savedAt === right.savedAt &&
    left.checksum === right.checksum &&
    left.revision === right.revision;
}
