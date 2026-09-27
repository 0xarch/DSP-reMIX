import { getBeltConstructionId, getPlanet, getStarSystem, ITEMS, PLANET_LIST, STAR_SYSTEM_LIST } from "./content";
import {
  addHubInteger,
  compareHubInteger,
  normalizeHubInteger,
  subtractHubInteger,
  sumEscalatingModuleCost,
} from "./systemHubLogistics";
import type {
  FactoryEntity,
  GameState,
  GalacticHubNetworkState,
  ItemId,
  PlanetId,
  SpaceStationOutputPortIndex,
  StarSystemId,
  SystemSpaceStationState,
} from "./types";

export interface SpaceStationPhaseRequirement {
  phaseIndex: number;
  name: string;
  itemId: ItemId;
  baseAmount: number;
  requiredAmount: string;
}

export const SPACE_STATION_PHASES: readonly { name: string; itemId: ItemId; amount: number }[] = [
  { name: "轨道基座", itemId: "titanium_alloy", amount: 1_000_000 },
  { name: "轨道基座", itemId: "frame_material", amount: 500_000 },
  { name: "轨道基座", itemId: "small_carrier_rocket", amount: 100_000 },
  { name: "轨道基座", itemId: "universe_matrix", amount: 100_000 },
  { name: "主体框架", itemId: "frame_material", amount: 2_000_000 },
  { name: "主体框架", itemId: "dyson_sphere_component", amount: 1_000_000 },
  { name: "主体框架", itemId: "titanium_glass", amount: 1_000_000 },
  { name: "主体框架", itemId: "quantum_chip", amount: 500_000 },
  { name: "能源核心", itemId: "antimatter_fuel_rod", amount: 250_000 },
  { name: "能源核心", itemId: "annihilation_constraint_sphere", amount: 500_000 },
  { name: "能源核心", itemId: "strange_matter", amount: 1_000_000 },
  { name: "能源核心", itemId: "plane_filter", amount: 1_000_000 },
  { name: "调度核心", itemId: "processor", amount: 5_000_000 },
  { name: "调度核心", itemId: "particle_broadband", amount: 2_000_000 },
  { name: "调度核心", itemId: "quantum_chip", amount: 2_000_000 },
  { name: "调度核心", itemId: "universe_matrix", amount: 1_000_000 },
] as const;

/** Local-only free construction switch for the station/elevator test loop. */
export function isSpaceStationFreeBuildTestMode(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
}

export const SPACE_STATION_MODULE_BASE_COSTS = {
  backbone: {
    frame_material: "100000",
    quantum_chip: "50000",
    processor: "100000",
    universe_matrix: "10000",
  },
  energy: {
    antimatter_fuel_rod: "50000",
    annihilation_constraint_sphere: "50000",
    strange_matter: "100000",
    quantum_chip: "50000",
  },
  interstellar: {
    titanium_alloy: "100000",
    frame_material: "50000",
    particle_container: "100000",
    space_warper: "10000",
  },
} as const satisfies Record<string, Record<string, string>>;

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.85 };

export function createEmptySystemSpaceStation(systemId: StarSystemId): SystemSpaceStationState {
  return {
    systemId,
    status: "not-started",
    costRevision: 0,
    costMultiplierBasisPoints: 10_000,
    phaseIndex: 0,
    delivered: {},
    constructionBuffer: {},
    inventory: {},
    itemPolicies: {},
    modules: { backbone: 0, energy: 0, interstellar: 0 },
    routingCursors: {},
    viewport: { ...DEFAULT_VIEWPORT },
    decorations: [],
  };
}

function safeLauncherInput(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? Math.max(0, value) : 0;
}

function applyConstructionBuffer(
  station: SystemSpaceStationState,
  research: GameState["research"],
): { station: SystemSpaceStationState; moved: number; completed: boolean } {
  const requirements = getSpaceStationPhaseRequirements({ research }, station.costMultiplierBasisPoints);
  const delivered = { ...station.delivered };
  const buffer = { ...station.constructionBuffer };
  let phaseIndex = Math.max(0, Math.min(requirements.length, station.phaseIndex));
  let moved = 0;

  while (phaseIndex < requirements.length) {
    const phaseName = requirements[phaseIndex].name;
    const phaseRequirements = requirements.filter((requirement) => requirement.name === phaseName);
    let phaseComplete = true;
    for (const requirement of phaseRequirements) {
      const current = delivered[requirement.itemId] ?? "0";
      const remaining = subtractHubInteger(requirement.requiredAmount, current);
      const available = buffer[requirement.itemId] ?? "0";
      const take = compareHubInteger(available, remaining) < 0 ? available : remaining;
      if (compareHubInteger(take, "0") > 0) {
        delivered[requirement.itemId] = addHubInteger(current, take);
        buffer[requirement.itemId] = subtractHubInteger(available, take);
        moved += Math.min(Number.MAX_SAFE_INTEGER, Number(normalizeHubInteger(take)));
      }
      if (compareHubInteger(delivered[requirement.itemId] ?? "0", requirement.requiredAmount) < 0) phaseComplete = false;
    }
    if (!phaseComplete) break;
    phaseIndex += phaseRequirements.length;
  }

  const completed = phaseIndex >= requirements.length;
  return {
    station: {
      ...station,
      delivered,
      constructionBuffer: buffer,
      phaseIndex,
      status: completed ? "operational" : "building",
    },
    moved,
    completed,
  };
}

export interface ConstructionLauncherSettlementReport {
  launchers: number;
  accepted: number;
  completedSystems: number;
}

/** Moves material that arrived through real launcher inputs into the staged project buffer. */
export function settleSpaceStationConstructionInputs(state: GameState): ConstructionLauncherSettlementReport {
  const report: ConstructionLauncherSettlementReport = { launchers: 0, accepted: 0, completedSystems: 0 };
  const nextStations = { ...state.systemSpaceStations };
  if (isSpaceStationFreeBuildTestMode()) {
    for (const [systemId, current] of Object.entries(nextStations)) {
      if (!current || current.status !== "building") continue;
      const applied = applyConstructionBuffer(current, state.research);
      if (applied.completed) {
        nextStations[systemId as StarSystemId] = applied.station;
        report.completedSystems += 1;
      }
    }
  }
  for (const launcher of state.entities) {
    if (launcher.buildingId !== "space_station_construction_launcher") continue;
    const systemId = getPlanet(launcher.planetId).systemId;
    const current = nextStations[systemId];
    if (!current || current.status !== "building") continue;
    report.launchers += 1;
    const powerFactor = Math.max(0, Math.min(1, typeof launcher.powerFactor === "number" && Number.isFinite(launcher.powerFactor) ? launcher.powerFactor : 1));
    const constructionBuffer = { ...current.constructionBuffer };
    for (const [rawItemId, rawAmount] of Object.entries(launcher.inputs)) {
      if (!(rawItemId in ITEMS)) continue;
      const amount = safeLauncherInput(rawAmount);
      if (amount < 1) continue;
      const accepted = Math.floor(amount * powerFactor);
      if (accepted < 1) continue;
      const itemId = rawItemId as ItemId;
      constructionBuffer[itemId] = addHubInteger(constructionBuffer[itemId] ?? "0", accepted);
      launcher.inputs[itemId] = amount - accepted;
      report.accepted += accepted;
    }
    const applied = applyConstructionBuffer({ ...current, constructionBuffer }, state.research);
    nextStations[systemId] = applied.station;
    if (applied.completed) report.completedSystems += 1;
  }
  if (report.accepted < 1 && report.completedSystems < 1) return report;
  state.systemSpaceStations = nextStations;
  return report;
}

export function createEmptySystemSpaceStations(): Partial<Record<StarSystemId, SystemSpaceStationState>> {
  return Object.fromEntries(STAR_SYSTEM_LIST.map((system) => [system.id, createEmptySystemSpaceStation(system.id)]));
}

export function createEmptyGalacticHubNetwork(): GalacticHubNetworkState {
  return { fleetInstalled: 0, fleetBusy: 0, fleetReturns: [], warpers: "0", warperTarget: "0", routingCursors: {} };
}

function hasTech(state: GameState, techId: string): boolean {
  return state.research.completedTechIds.includes(techId as never);
}

export function getSpaceStationCostMultiplierBasisPoints(state: Pick<GameState, "research">): number {
  if (state.research.completedTechIds.includes("autonomous_station_construction")) return 8_000;
  if (state.research.completedTechIds.includes("orbital_modular_assembly")) return 9_000;
  return 10_000;
}

export function getSpaceStationPhaseRequirements(state: Pick<GameState, "research">, basisPoints = getSpaceStationCostMultiplierBasisPoints(state)): SpaceStationPhaseRequirement[] {
  const multiplier = Math.max(8_000, Math.min(10_000, Math.floor(basisPoints)));
  const freeBuildTest = isSpaceStationFreeBuildTestMode();
  return SPACE_STATION_PHASES.map((phase, phaseIndex) => ({
    ...phase,
    phaseIndex,
    baseAmount: phase.amount,
    requiredAmount: freeBuildTest ? "0" : String(Math.ceil(phase.amount * multiplier / 10_000)),
  }));
}

export function getSpaceStationState(state: Pick<GameState, "systemSpaceStations">, systemId: StarSystemId): SystemSpaceStationState {
  return state.systemSpaceStations[systemId] ?? createEmptySystemSpaceStation(systemId);
}

export function getSpaceStationProgress(state: Pick<GameState, "systemSpaceStations" | "research">, systemId: StarSystemId) {
  const station = getSpaceStationState(state, systemId);
  const requirements = getSpaceStationPhaseRequirements({ research: state.research }, station.costMultiplierBasisPoints);
  const deliveredInteger = requirements.reduce((sum, requirement) => addHubInteger(sum, station.delivered[requirement.itemId] ?? "0"), "0");
  const totalInteger = requirements.reduce((sum, requirement) => addHubInteger(sum, requirement.requiredAmount), "0");
  const delivered = Math.min(Number.MAX_SAFE_INTEGER, Number(normalizeHubInteger(deliveredInteger)));
  const total = Math.min(Number.MAX_SAFE_INTEGER, Number(normalizeHubInteger(totalInteger)));
  const progressScale = 1_000_000n;
  const progressNumerator = BigInt(normalizeHubInteger(deliveredInteger)) * progressScale;
  const progressDenominator = BigInt(normalizeHubInteger(totalInteger));
  const progress = progressDenominator > 0n
    ? Number(progressNumerator / progressDenominator) / Number(progressScale)
    : station.status === "operational" ? 1 : 0;
  const nextRequirement = requirements.find((requirement) => compareHubInteger(
    station.delivered[requirement.itemId] ?? "0",
    requirement.requiredAmount,
  ) < 0);
  return {
    station,
    requirements,
    delivered,
    total,
    progress: Math.max(0, Math.min(1, progress)),
    nextRequirement,
  };
}

export function canStartSystemSpaceStation(state: GameState, systemId: StarSystemId): boolean {
  const system = getStarSystem(systemId);
  const station = getSpaceStationState(state, systemId);
  const hasConstructionPlatform = state.entities.some((entity) => entity.buildingId === "space_station_construction_launcher" &&
    PLANET_LIST.some((planet) => planet.id === entity.planetId && planet.systemId === systemId));
  return Boolean(system && state.exploration.unlockedSystemIds.includes(systemId) &&
    hasTech(state, "system_space_station_engineering") && hasConstructionPlatform && station.status === "not-started");
}

export function startSystemSpaceStationConstruction(state: GameState, systemId: StarSystemId): GameState {
  if (!canStartSystemSpaceStation(state, systemId)) return state;
  const multiplier = getSpaceStationCostMultiplierBasisPoints(state);
  const current = getSpaceStationState(state, systemId);
  const next = {
    ...state,
    systemSpaceStations: {
      ...state.systemSpaceStations,
      [systemId]: {
        ...current,
        status: "building",
        costRevision: current.costRevision + 1,
        costMultiplierBasisPoints: multiplier,
        phaseIndex: 0,
        delivered: {},
        constructionBuffer: {},
        inventory: {},
      },
    },
  };
  if (!isSpaceStationFreeBuildTestMode()) return next;
  const applied = applyConstructionBuffer((next.systemSpaceStations as Record<string, SystemSpaceStationState>)[systemId]!, next.research);
  return {
    ...next,
    systemSpaceStations: {
      ...next.systemSpaceStations,
      [systemId]: applied.station,
    },
  };
}

function updatePlanetTray(state: GameState, planetId: PlanetId, tray: Partial<Record<ItemId, number>>): GameState {
  const planetTrays = { ...state.planetTrays, [planetId]: tray };
  return state.activePlanetId === planetId ? { ...state, tray, planetTrays } : { ...state, planetTrays };
}

/** Delivers from one planet tray in phase order; no material is accepted after completion. */
export function deliverSystemSpaceStationMaterial(
  state: GameState,
  systemId: StarSystemId,
  planetId: PlanetId,
  itemId: ItemId,
  requestedAmount: number,
): GameState {
  const station = getSpaceStationState(state, systemId);
  if (station.status !== "building" || !Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) return state;
  if (!PLANET_LIST.some((planet) => planet.id === planetId && planet.systemId === systemId)) return state;
  const requirement = getSpaceStationPhaseRequirements({ research: state.research }, station.costMultiplierBasisPoints)
    .find((candidate) => candidate.itemId === itemId && candidate.phaseIndex >= station.phaseIndex);
  if (!requirement) return state;
  const planetTray = { ...(state.planetTrays[planetId] ?? {}) };
  const available = Math.max(0, Math.floor(planetTray[itemId] ?? 0));
  const remaining = Number(normalizeHubInteger(subtractHubInteger(requirement.requiredAmount, station.delivered[itemId] ?? "0")));
  const moved = Math.min(available, requestedAmount, Math.max(0, remaining));
  if (moved <= 0) return state;
  const staged = applyConstructionBuffer({ ...station, constructionBuffer: { ...station.constructionBuffer, [itemId]: addHubInteger(station.constructionBuffer[itemId] ?? "0", moved) } }, state.research);
  const next = updatePlanetTray({
    ...state,
    systemSpaceStations: {
      ...state.systemSpaceStations,
      [systemId]: staged.station,
    },
  }, planetId, { ...planetTray, [itemId]: available - moved });
  return next;
}

export function getSpaceStationModuleCost(module: keyof SystemSpaceStationState["modules"], existing: number, amount: number) {
  const costs = SPACE_STATION_MODULE_BASE_COSTS[module];
  return Object.fromEntries(Object.entries(costs).map(([itemId, base]) => [
    itemId,
    sumEscalatingModuleCost(base, existing, amount),
  ])) as Partial<Record<ItemId, string>>;
}

export function setSystemSpaceStationModuleCount(
  state: GameState,
  systemId: StarSystemId,
  module: keyof SystemSpaceStationState["modules"],
  amount: number,
): GameState {
  const station = getSpaceStationState(state, systemId);
  if (station.status !== "operational" || !Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000) return state;
  const current = station.modules[module];
  if (amount === current) return state;
  const nextInventory = { ...station.inventory };
  if (amount > current) {
    const costs = getSpaceStationModuleCost(module, current, amount - current);
    if (Object.entries(costs).some(([itemId, cost]) => compareHubInteger(nextInventory[itemId as ItemId] ?? "0", cost) < 0)) return state;
    for (const [itemId, cost] of Object.entries(costs)) nextInventory[itemId as ItemId] = subtractHubInteger(nextInventory[itemId as ItemId] ?? "0", cost);
  } else {
    const costs = getSpaceStationModuleCost(module, amount, current - amount);
    for (const [itemId, cost] of Object.entries(costs)) nextInventory[itemId as ItemId] = addHubInteger(nextInventory[itemId as ItemId] ?? "0", decimalHalf(cost));
  }
  return {
    ...state,
    systemSpaceStations: {
      ...state.systemSpaceStations,
      [systemId]: { ...station, modules: { ...station.modules, [module]: amount }, inventory: nextInventory },
    },
  };
}

function decimalHalf(value: string): string {
  const digits = BigInt(normalizeHubInteger(value));
  return (digits / 2n).toString();
}

export function canUpgradeInterstellarStation(state: GameState, entityId: string): boolean {
  return getInterstellarStationUpgradeStatus(state, entityId).blocker === "ready";
}

export type InterstellarStationUpgradeBlocker =
  | "ready"
  | "not-found"
  | "already-upgraded"
  | "technology"
  | "materials"
  | "invalid";

export interface InterstellarStationUpgradeStatus {
  blocker: InterstellarStationUpgradeBlocker;
  reason: string;
  stationId?: string;
  planetId?: PlanetId;
  machineCount?: number;
  costs: Partial<Record<ItemId, number>>;
  missing: Partial<Record<ItemId, number>>;
}

export interface InterstellarStationUpgradeBatchSkip {
  entityId: string;
  blocker: InterstellarStationUpgradeBlocker;
  reason: string;
}

export interface InterstellarStationUpgradeBatchResult {
  state: GameState;
  upgradedIds: string[];
  skipped: InterstellarStationUpgradeBatchSkip[];
}

/**
 * Quantum logistics is an access-mode change, not a second construction
 * project.  Keep the legacy Mk.II upgrade package in the shape of the save
 * and status payload, but make every amount zero so switching to the quantum
 * tower never consumes player materials.
 */
const INTERSTELLAR_STATION_UPGRADE_BASE_COSTS: Partial<Record<ItemId, number>> = {
  titanium_alloy: 0,
  frame_material: 0,
  quantum_chip: 0,
  universe_matrix: 0,
};

function getUpgradeMachineCount(entity: { machineCount: number }): number | null {
  const count = entity.machineCount;
  return Number.isSafeInteger(count) && count >= 1 ? count : null;
}

function getInterstellarStationUpgradeCosts(): Partial<Record<ItemId, number>> {
  if (isSpaceStationFreeBuildTestMode()) {
    return Object.fromEntries(Object.keys(INTERSTELLAR_STATION_UPGRADE_BASE_COSTS).map((itemId) => [itemId, 0])) as Partial<Record<ItemId, number>>;
  }
  return { ...INTERSTELLAR_STATION_UPGRADE_BASE_COSTS };
}

/**
 * Returns the exact reason an interstellar station upgrade can or cannot run.
 * Keeping this pure lets desktop, mobile and batch actions show the same state
 * without mutating the save or relying on a hidden UI-only flag.
 */
function getInterstellarStationUpgradeStatusForEntity(
  state: GameState,
  entity: FactoryEntity | undefined,
  availableTray?: Partial<Record<ItemId, number>>,
): InterstellarStationUpgradeStatus {
  if (!entity || entity.buildingId !== "interstellar_logistics_station") {
    return { blocker: "not-found", reason: "找不到可升级的星际物流站", costs: {}, missing: {} };
  }
  const machineCount = getUpgradeMachineCount(entity);
  const costs = machineCount == null ? {} : getInterstellarStationUpgradeCosts();
  const base = { stationId: entity.id, planetId: entity.planetId, machineCount: machineCount ?? undefined, costs, missing: {} };
  if ((entity.stationTier ?? 1) >= 2) return { ...base, blocker: "already-upgraded", reason: "该星际物流站已经是 Mk.II" };
  if (machineCount == null || Object.keys(costs).length === 0) {
    return { ...base, blocker: "invalid", reason: "建筑堆叠数量无效，无法安全计算升级材料" };
  }
  // New saves use the quantum-network technology.  The historical orbital
  // elevator technology remains accepted so old saves can still upgrade an
  // existing station without being forced through a removed research node.
  if (!hasTech(state, "quantum_logistics_network") && !hasTech(state, "orbital_elevator_engineering")) {
    return { ...base, blocker: "technology", reason: "需要先研究“量子物流网络”" };
  }
  const tray = availableTray ?? state.planetTrays[entity.planetId] ?? {};
  const missing = Object.fromEntries(Object.entries(costs).flatMap(([itemId, amount]) => {
    const available = Math.max(0, Math.floor(tray[itemId as ItemId] ?? 0));
    const deficit = Math.max(0, amount - available);
    return deficit > 0 ? [[itemId, deficit]] : [];
  })) as Partial<Record<ItemId, number>>;
  if (Object.keys(missing).length > 0) {
    const detail = Object.entries(missing).map(([itemId, amount]) => `${ITEMS[itemId as ItemId].name}缺${amount.toLocaleString("zh-CN")}`).join("、");
    return { ...base, blocker: "materials", reason: `升级材料不足：${detail}`, missing };
  }
  return { ...base, blocker: "ready", reason: "科技与升级材料均已满足，可原地升级为 Mk.II" };
}

export function getInterstellarStationUpgradeStatus(state: GameState, entityId: string): InterstellarStationUpgradeStatus {
  return getInterstellarStationUpgradeStatusForEntity(
    state,
    state.entities.find((candidate) => candidate.id === entityId),
  );
}

/** Upgrade every eligible station in a stable entity-id order. */
export function upgradeAllInterstellarStationsToMk2(state: GameState, systemId?: StarSystemId): InterstellarStationUpgradeBatchResult {
  const candidates = state.entities
    .filter((entity) => entity.buildingId === "interstellar_logistics_station")
    .filter((entity) => systemId == null || getPlanet(entity.planetId).systemId === systemId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const upgradedIds: string[] = [];
  const skipped: InterstellarStationUpgradeBatchSkip[] = [];
  const plannedTrays = new Map<PlanetId, Partial<Record<ItemId, number>>>();
  const outputItemsByStation = new Map<string, Array<ItemId | null>>();
  for (const candidate of candidates) {
    const tray = plannedTrays.get(candidate.planetId) ?? { ...(state.planetTrays[candidate.planetId] ?? {}) };
    const status = getInterstellarStationUpgradeStatusForEntity(state, candidate, tray);
    if (status.blocker !== "ready") {
      skipped.push({ entityId: candidate.id, blocker: status.blocker, reason: status.reason });
      continue;
    }
    for (const [itemId, amount] of Object.entries(status.costs)) {
      if (amount <= 0) continue;
      tray[itemId as ItemId] = Math.max(0, Math.floor((tray[itemId as ItemId] ?? 0) - amount));
    }
    plannedTrays.set(candidate.planetId, tray);
    outputItemsByStation.set(candidate.id, candidate.elevatorOutputItems ?? [
      ...(candidate.stationSlots ?? []).slice(0, 5).map((slot) => slot.itemId ?? null),
      null, null, null, null, null,
    ].slice(0, 5));
    upgradedIds.push(candidate.id);
  }
  if (upgradedIds.length === 0) return { state, upgradedIds, skipped };
  const planetTrays = { ...state.planetTrays };
  for (const [planetId, tray] of plannedTrays) planetTrays[planetId] = tray;
  const belts = state.belts.map((belt) => {
    const outputItems = outputItemsByStation.get(belt.source);
    if (!outputItems || belt.elevatorOutputIndex !== undefined) return belt;
    const index = outputItems.findIndex((item) => item === belt.itemId);
    return index >= 0 ? { ...belt, elevatorOutputIndex: index as SpaceStationOutputPortIndex } : belt;
  });
  const entities = state.entities.map((entity) => {
    const outputItems = outputItemsByStation.get(entity.id);
    return outputItems ? {
      ...entity,
      stationTier: 2 as const,
      stationOperationMode: entity.stationOperationMode ?? "legacy" as const,
      stationModeTransition: null,
      elevatorOutputItems: outputItems,
    } : entity;
  });
  const next = {
    ...state,
    entities,
    belts,
    planetTrays,
    tray: plannedTrays.has(state.activePlanetId) ? planetTrays[state.activePlanetId] : state.tray,
  };
  return { state: next, upgradedIds, skipped };
}

export function upgradeInterstellarStationToMk2(state: GameState, entityId: string): GameState {
  const status = getInterstellarStationUpgradeStatus(state, entityId);
  if (status.blocker !== "ready" || status.stationId == null) return state;
  const station = state.entities.find((candidate) => candidate.id === entityId)!;
  const costs = status.costs;
  const tray = { ...(state.planetTrays[station.planetId] ?? {}) };
  if (Object.entries(costs).some(([itemId, amount]) => (tray[itemId as ItemId] ?? 0) < amount)) return state;
  for (const [itemId, amount] of Object.entries(costs)) {
    if (amount <= 0) continue;
    tray[itemId as ItemId] = Math.max(0, Math.floor((tray[itemId as ItemId] ?? 0) - amount));
  }
  const withTray = updatePlanetTray(state, station.planetId, tray);
  const outputItems = station.elevatorOutputItems ?? [
    ...(station.stationSlots ?? []).slice(0, 5).map((slot) => slot.itemId ?? null),
    null, null, null, null, null,
  ].slice(0, 5);
  const belts = withTray.belts.map((belt) => {
    if (belt.source !== entityId || belt.elevatorOutputIndex !== undefined) return belt;
    const index = outputItems.findIndex((item) => item === belt.itemId);
    return index >= 0 ? { ...belt, elevatorOutputIndex: index as SpaceStationOutputPortIndex } : belt;
  });
  return {
    ...withTray,
    belts,
    entities: withTray.entities.map((entity) => entity.id === entityId ? {
      ...entity,
      stationTier: 2,
      stationOperationMode: entity.stationOperationMode ?? "legacy",
      stationModeTransition: null,
      elevatorOutputItems: outputItems,
    } : entity),
  };
}

export function requestStationOperationMode(state: GameState, entityId: string, mode: "legacy" | "elevator"): GameState {
  const entity = state.entities.find((candidate) => candidate.id === entityId);
  if (!entity || entity.buildingId !== "interstellar_logistics_station" || entity.stationTier !== 2 ||
    mode === "elevator" && !hasTech(state, "orbital_multi_cargo_bus")) return state;
  const current = entity.stationOperationMode ?? "legacy";
  if (current === mode && !entity.stationModeTransition) return state;
  const transition = mode === "elevator" ? "to-elevator" : "to-legacy";
  const outputItems = entity.elevatorOutputItems ?? [null, null, null, null, null];
  const belts = mode === "elevator"
    ? state.belts.map((belt) => {
      if (belt.source !== entityId || belt.elevatorOutputIndex !== undefined) return belt;
      const index = outputItems.findIndex((item) => item === belt.itemId);
      return index >= 0 ? { ...belt, elevatorOutputIndex: index as SpaceStationOutputPortIndex } : belt;
    })
    : state.belts;
  return { ...state, belts, entities: state.entities.map((candidate) => candidate.id === entityId ? { ...candidate, stationModeTransition: transition } : candidate) };
}

export function completeStationOperationModeTransition(state: GameState, entityId: string): GameState {
  const entity = state.entities.find((candidate) => candidate.id === entityId);
  if (!entity?.stationModeTransition) return state;
  const hasRelatedLegacyRoute = state.entities.some((candidate) => (candidate.stationRoutes ?? []).some((route) =>
    candidate.id === entityId || route.peerId === entityId || route.vehicleStationId === entityId || (route.waypointStationIds ?? []).includes(entityId)));
  if (hasRelatedLegacyRoute) return state;
  const mode = entity.stationModeTransition === "to-elevator" ? "elevator" : "legacy";
  return { ...state, entities: state.entities.map((candidate) => candidate.id === entityId ? { ...candidate, stationOperationMode: mode, stationModeTransition: null } : candidate) };
}

export function setElevatorOutputItem(
  state: GameState,
  entityId: string,
  portIndex: SpaceStationOutputPortIndex,
  itemId: ItemId | null,
  confirmations: number,
): GameState {
  const entity = state.entities.find((candidate) => candidate.id === entityId);
  if (!entity || entity.stationTier !== 2 || entity.stationOperationMode !== "elevator" || confirmations < 2 ||
    itemId && !ITEMS[itemId]) return state;
  const outputItems = [...(entity.elevatorOutputItems ?? [null, null, null, null, null])];
  if (itemId && outputItems.some((value, index) => index !== portIndex && value === itemId)) return state;
  const previousItemId = outputItems[portIndex];
  outputItems[portIndex] = itemId;
  const removedBelts = state.belts.filter((belt) => belt.source === entityId &&
    (belt.elevatorOutputIndex === portIndex || (belt.elevatorOutputIndex === undefined && previousItemId !== null && belt.itemId === previousItemId)));
  const construction = { ...state.construction };
  for (const belt of removedBelts) {
    const constructionId = getBeltConstructionId(belt.tier);
    construction[constructionId] = Math.max(0, Math.floor(construction[constructionId] ?? 0)) + Math.max(1, Math.floor(belt.lanes));
  }
  return {
    ...state,
    construction,
    belts: removedBelts.length > 0 ? state.belts.filter((belt) => !removedBelts.some((removed) => removed.id === belt.id)) : state.belts,
    entities: state.entities.map((candidate) => candidate.id === entityId ? { ...candidate, elevatorOutputItems: outputItems } : candidate),
  };
}
