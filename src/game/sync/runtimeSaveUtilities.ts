import type { GameState } from "../types";
import type { SaveGameResult } from "../storage";
import { listLocalSaveCatalogs } from "../localSaveStore";

/** 主入口（App.tsx）拆分出的存档工具：
 *  运行时持久化的进度类型、生命周期封盘结果、
 *  以及本地主存档的校验字节数读取。 */

const LARGE_RUNTIME_ENTITY_THRESHOLD = 10_000;
const LARGE_RUNTIME_BELT_THRESHOLD = 20_000;

export function isLargeRuntimeState(state: GameState): boolean {
  return state.entities.length >= LARGE_RUNTIME_ENTITY_THRESHOLD || state.belts.length >= LARGE_RUNTIME_BELT_THRESHOLD;
}

export type RuntimePersistenceKind = "autosave" | "manual" | "pure-idle-stop" | "return" | "lifecycle" | "other";
export type RuntimePersistencePhase = "checkpoint" | "serialize-write-readback" | "complete" | "failed";

const LIFECYCLE_SEALED_SAVE_MESSAGE = "页面正在退出，已保留当前 durable recovery 供下次精确恢复";

export function lifecycleSealedSaveResult(): SaveGameResult {
  return { success: false, message: LIFECYCLE_SEALED_SAVE_MESSAGE, code: "conflict" };
}

export function readVerifiedPrimaryByteLength(mode: GameState["mode"]): number | null {
  try {
    const catalog = listLocalSaveCatalogs().find((entry) =>
      entry.kind === "primary" && entry.mode === mode && entry.slot === "main" && entry.integrity === "valid");
    return catalog && Number.isFinite(catalog.byteLength) && catalog.byteLength > 0 ? catalog.byteLength : null;
  } catch {
    return null;
  }
}

export interface RuntimePersistenceProgress {
  id: number;
  kind: RuntimePersistenceKind;
  phase: RuntimePersistencePhase;
  startedAt: number;
  message: string;
}
