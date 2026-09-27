import type { GameState } from "./types";

/** 控制台调试入口：`__DSP_DUMP_SAVE__()` 输出当前存档的全部信息。
 *  由 FactoryGame 挂载；离开游戏界面时自动卸载，避免悬挂旧存档引用。 */

export interface SaveDebugSummary {
  version: number;
  mode: GameState["mode"];
  savedAtComparableElapsedSeconds: number;
  galaxySeed: number;
  galaxyGeneration: GameState["galaxy"]["generation"];
  activePlanetId: string;
  settings: GameState["settings"];
  counts: {
    entities: number;
    belts: number;
    entitiesByKind: Record<string, number>;
    infiniteVeins: number;
    completedTechnologies: number;
    unlockedSystems: string[];
    colonizedPlanets: string[];
  };
  achievements: string[];
  research: {
    selectedTechId: string | null;
    queuedTechIds: string[];
    completedTechCount: number;
  };
}

export function summarizeSaveState(state: GameState): SaveDebugSummary {
  const entitiesByKind: Record<string, number> = {};
  let infiniteVeins = 0;
  for (const entity of state.entities) {
    entitiesByKind[entity.kind] = (entitiesByKind[entity.kind] ?? 0) + 1;
    if (entity.kind === "vein" && entity.resourceInfinite === true) infiniteVeins += 1;
  }
  return {
    version: state.version,
    mode: state.mode,
    savedAtComparableElapsedSeconds: state.elapsedSeconds,
    galaxySeed: state.galaxy.seed,
    galaxyGeneration: state.galaxy.generation,
    activePlanetId: state.activePlanetId,
    settings: state.settings,
    counts: {
      entities: state.entities.length,
      belts: state.belts.length,
      entitiesByKind,
      infiniteVeins,
      completedTechnologies: state.research.completedTechIds.length,
      unlockedSystems: [...state.exploration.unlockedSystemIds],
      colonizedPlanets: [...state.exploration.colonizedPlanetIds],
    },
    achievements: [...state.achievements.unlockedIds],
    research: {
      selectedTechId: state.research.selectedTechId,
      queuedTechIds: [...state.research.queuedTechIds],
      completedTechCount: state.research.completedTechIds.length,
    },
  };
}

export type SaveDebugDump = { summary: SaveDebugSummary; state: GameState };

export function createSaveDump(state: GameState): SaveDebugDump {
  return { summary: summarizeSaveState(state), state };
}

type SaveDebugWindow = Window & {
  __DSP_DUMP_SAVE__?: () => SaveDebugDump;
};

export function installSaveDebugConsole(getState: () => GameState | null, target: SaveDebugWindow = window): () => void {
  const dump = (): SaveDebugDump => {
    const state = getState();
    if (!state) throw new Error("当前没有运行中的存档（__DSP_DUMP_SAVE__ 仅在游戏界面内可用）。");
    const result = createSaveDump(state);
    console.groupCollapsed(
      `%c__DSP_DUMP_SAVE__ v${result.summary.version} · ${result.summary.mode} · 种子 #${result.summary.galaxySeed}`,
      "color:#62b5ae;font-weight:bold",
    );
    console.table(result.summary.counts.entitiesByKind);
    console.log("存档摘要:", result.summary);
    console.log("完整 GameState（可直接右键 Store as global variable）:", result.state);
    console.groupEnd();
    return result;
  };
  target.__DSP_DUMP_SAVE__ = dump;
  return () => {
    if (target.__DSP_DUMP_SAVE__ === dump) delete target.__DSP_DUMP_SAVE__;
  };
}
