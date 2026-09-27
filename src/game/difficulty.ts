import type { DifficultyMode } from "./types";

export interface DifficultyDefinition {
  id: DifficultyMode;
  name: string;
  summary: string;
  productionMultiplier: number;
  miningMultiplier: number;
  logisticsMultiplier: number;
  powerDemandMultiplier: number;
}

/**
 * Balance presets intentionally change a small set of high-leverage values.
 * This keeps the underlying recipes and deterministic simulation identical
 * while making a new run feel meaningfully different.
 */
export const DIFFICULTY_DEFINITIONS: readonly DifficultyDefinition[] = [
  {
    id: "relaxed",
    name: "舒缓",
    summary: "生产与物流更宽松，适合专注布局和生产链。",
    productionMultiplier: 1.15,
    miningMultiplier: 1.15,
    logisticsMultiplier: 1.1,
    powerDemandMultiplier: 0.9,
  },
  {
    id: "standard",
    name: "标准",
    summary: "按当前原型的默认节奏运行。",
    productionMultiplier: 1,
    miningMultiplier: 1,
    logisticsMultiplier: 1,
    powerDemandMultiplier: 1,
  },
  {
    id: "hard",
    name: "高压",
    summary: "生产与物流更紧凑，电网负载更高，适合挑战优化。",
    productionMultiplier: 0.85,
    miningMultiplier: 0.85,
    logisticsMultiplier: 0.9,
    powerDemandMultiplier: 1.2,
  },
] as const;

const BY_ID = new Map(DIFFICULTY_DEFINITIONS.map((definition) => [definition.id, definition]));

export function isDifficultyMode(value: unknown): value is DifficultyMode {
  return typeof value === "string" && BY_ID.has(value as DifficultyMode);
}

export function getDifficultyDefinition(value: DifficultyMode | null | undefined): DifficultyDefinition {
  return BY_ID.get(value ?? "standard") ?? BY_ID.get("standard")!;
}

/**
 * 存档级精准难度倍率（矿物倍率 / 发电倍率）。
 * 运行时取值为 number，可为 +Infinity（无限矿石 / 无限发电功率）。
 * 存档序列化是纯 JSON.stringify，Infinity 会丢成 null，因此落盘时用
 * 字符串哨兵 "Infinity" 表示；读取时经 resolveResourceMultiplier 还原。
 */
export type ResourceMultiplierSetting = number | "Infinity";

export const RESOURCE_MULTIPLIER_MIN = 0.01;
export const RESOURCE_MULTIPLIER_MAX = 100;
export const RESOURCE_MULTIPLIER_INFINITY_SENTINEL = "Infinity" as const;

/** Infinity 语义在数值路径上的有限替身：远超任何需求，且可安全 JSON 序列化。 */
export const RESOURCE_MULTIPLIER_EFFECTIVE_INFINITY = 1e15;

export function resolveResourceMultiplier(value: unknown): number {
  if (value === RESOURCE_MULTIPLIER_INFINITY_SENTINEL) return Number.POSITIVE_INFINITY;
  if (typeof value === "number" && Number.isFinite(value) && value >= RESOURCE_MULTIPLIER_MIN && value <= RESOURCE_MULTIPLIER_MAX) return value;
  return 1;
}

/** 校验并把倍率归一化为可落盘形态；非法输入返回 null（由调用方回退默认值）。 */
export function normalizeResourceMultiplierSetting(value: unknown): ResourceMultiplierSetting | null {
  if (value === RESOURCE_MULTIPLIER_INFINITY_SENTINEL) return RESOURCE_MULTIPLIER_INFINITY_SENTINEL;
  if (typeof value === "number" && Number.isFinite(value) && value >= RESOURCE_MULTIPLIER_MIN && value <= RESOURCE_MULTIPLIER_MAX) {
    return Math.round(value * 100) / 100;
  }
  return null;
}

export function formatResourceMultiplier(value: unknown): string {
  const resolved = resolveResourceMultiplier(value);
  if (!Number.isFinite(resolved)) return "∞";
  return `${Math.round(resolved * 100) / 100}×`;
}

/** 同 resolveResourceMultiplier，但 Infinity 以有限大数表示（用于进入持久化状态的功率计算）。 */
export function resolveFiniteResourceMultiplier(value: unknown): number {
  const resolved = resolveResourceMultiplier(value);
  return Number.isFinite(resolved) ? resolved : RESOURCE_MULTIPLIER_EFFECTIVE_INFINITY;
}
