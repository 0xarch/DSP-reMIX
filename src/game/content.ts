import type {
  BeltTier,
  BuildingDefinition,
  BuildingId,
  ConstructionId,
  ConstructionDefinition,
  ConveyorBeltId,
  ItemDefinition,
  ItemId,
  PlanetDefinition,
  PlanetId,
  ProliferatorTier,
  RecipeDefinition,
  RecipeId,
  SorterId,
  SorterTier,
  StarSystemDefinition,
  StarSystemId,
  TechnologyDefinition,
  TechId,
  GalaxyState,
} from "./types";

import { CONSTRUCTION } from "../content/dsp/construction";
import type { ProliferatorDefinition } from "../content/dsp/proliferators";
import { BUILDINGS } from "../content/dsp/buildings";
import { FUEL_ENERGY_MJ } from "../content/dsp/fuels";
import { ITEMS, MATRIX_ITEM_IDS } from "../content/dsp/items";
import { PLANET_LIST, PLANETS } from "../content/dsp/planets";
import { PROLIFERATORS } from "../content/dsp/proliferators";
import { RECIPES } from "../content/dsp/recipes";
import { STAR_SYSTEM_LIST, STAR_SYSTEMS } from "../content/dsp/starSystems";
import { TECHNOLOGIES } from "../content/dsp/technologies";

// 原始目录数据已按领域拆分到 src/content/dsp/（为未来的扩展包预留结构），
// 这里统一 re-export 以保持既有导入路径 `game/content` 完全兼容。
export { BUILDINGS } from "../content/dsp/buildings";
export { CONSTRUCTION } from "../content/dsp/construction";
export { FUEL_ENERGY_MJ } from "../content/dsp/fuels";
export { ITEMS, MATRIX_ITEM_IDS } from "../content/dsp/items";
export { PLANET_LIST, PLANETS } from "../content/dsp/planets";
export { PROLIFERATORS } from "../content/dsp/proliferators";
export type { ProliferatorDefinition } from "../content/dsp/proliferators";
export { RECIPES } from "../content/dsp/recipes";
export { STAR_SYSTEM_LIST, STAR_SYSTEMS } from "../content/dsp/starSystems";
export { TECHNOLOGIES } from "../content/dsp/technologies";
// ---------------------------------------------------------------------------
// 程序化星系/行星的运行时目录注册：
// 生成的星系与行星以确定性的派生数据（种子+生成选项）重建，写入静态目录对象
// 与列表（PLANETS/PLANET_LIST/STAR_SYSTEMS/STAR_SYSTEM_LIST），使引擎建州、
// 星图、统计等既有遍历自动感知；切换存档时先移除上一份存档的动态条目。
// ---------------------------------------------------------------------------

const CORE_PLANET_LIST_LENGTH = PLANET_LIST.length;
const CORE_STAR_SYSTEM_LIST_LENGTH = STAR_SYSTEM_LIST.length;
const DYNAMIC_PLANET_KEYS = new Set<string>();
const DYNAMIC_SYSTEM_KEYS = new Set<string>();
let dynamicCatalogFingerprint = "";

export function syncDynamicGalaxyCatalog(galaxy: GalaxyState): void {
  if (!galaxy || typeof galaxy !== "object") return;
  // 旧存档/手工构造的状态可能没有生成字段，视为空集。
  const generatedSystems = Array.isArray(galaxy.generatedSystems) ? galaxy.generatedSystems : [];
  const generatedPlanets = Array.isArray(galaxy.generatedPlanets) ? galaxy.generatedPlanets : [];
  // inspectSave 等高频路径会重复调用；指纹不变时跳过重建。
  const fingerprint = `${galaxy.seed}:${generatedSystems.length}:${generatedPlanets.length}:${generatedPlanets[generatedPlanets.length - 1]?.planetId ?? ""}`;
  if (fingerprint === dynamicCatalogFingerprint && DYNAMIC_PLANET_KEYS.size === generatedPlanets.length) return;
  dynamicCatalogFingerprint = fingerprint;
  for (const key of DYNAMIC_PLANET_KEYS) delete PLANETS[key];
  for (const key of DYNAMIC_SYSTEM_KEYS) delete STAR_SYSTEMS[key];
  PLANET_LIST.length = CORE_PLANET_LIST_LENGTH;
  STAR_SYSTEM_LIST.length = CORE_STAR_SYSTEM_LIST_LENGTH;
  DYNAMIC_PLANET_KEYS.clear();
  DYNAMIC_SYSTEM_KEYS.clear();
  let previousSystemId: StarSystemId = "blue_giant";
  for (const system of generatedSystems) {
    const definition: StarSystemDefinition = {
      id: system.systemId,
      name: system.displayName,
      code: system.typeCode,
      starType: system.starType,
      defaultStarClassId: system.starClassId,
      color: system.color,
      distanceLy: system.distanceFromOriginLy,
      description: `程序化生成的${system.typeCode}，恒星温度 ${system.temperature.toFixed(2)} · 重力 ${system.gravity.toFixed(2)} · 荒度 ${system.wildness.toFixed(2)} · 生态 ${system.organism.toFixed(2)}。`,
      planetIds: generatedPlanets.filter((planet) => planet.systemId === system.systemId).map((planet) => planet.planetId),
      explorationCost: system.explorationCost.map((cost) => ({ ...cost })),
      requiredTechId: "stellar_exploration",
      prerequisiteSystemId: previousSystemId,
    };
    STAR_SYSTEMS[system.systemId] = definition;
    STAR_SYSTEM_LIST.push(definition);
    DYNAMIC_SYSTEM_KEYS.add(system.systemId);
    previousSystemId = system.systemId;
  }
  for (const planet of generatedPlanets) {
    const profile = galaxy.profiles[planet.planetId];
    const definition: PlanetDefinition = {
      id: planet.planetId,
      name: planet.displayName,
      code: planet.code,
      color: planet.color,
      environment: planet.code,
      resources: profile?.resourceIds.map((itemId) => getItem(itemId).name).join("、") || "由星区种子生成",
      kind: planet.kind,
      defaultTemplateId: profile?.templateId ?? "oceanic",
      systemId: planet.systemId,
      orbitIndex: planet.orbitIndex,
      solarMultiplier: profile?.solarMultiplier ?? 1,
      orbitalYields: profile?.orbitalYields,
    };
    PLANETS[planet.planetId] = definition;
    PLANET_LIST.push(definition);
    DYNAMIC_PLANET_KEYS.add(planet.planetId);
  }
}


export const PROLIFERATOR_ITEM_IDS = Object.values(PROLIFERATORS).map((definition) => definition.itemId);

export function getProliferator(tier: ProliferatorTier): ProliferatorDefinition {
  return PROLIFERATORS[tier];
}

export function getProliferatorTier(itemId: ItemId): ProliferatorTier | undefined {
  return (Object.values(PROLIFERATORS).find((definition) => definition.itemId === itemId)?.tier);
}

export const RECIPES_BY_BUILDING = Object.values(RECIPES).reduce(
  (groups, recipe) => {
    (groups[recipe.buildingId] ??= []).push(recipe);
    return groups;
  },
  {} as Partial<Record<BuildingId, RecipeDefinition[]>>,
);

const RECIPE_BUILDING_BASE: Partial<Record<BuildingId, BuildingId>> = {
  assembling_machine_mk2: "assembling_machine_mk1",
  assembling_machine_mk3: "assembling_machine_mk1",
  plane_smelter: "arc_smelter",
  quantum_chemical_plant: "chemical_plant",
};

export const BUILDING_UPGRADES: Partial<Record<BuildingId, BuildingId>> = {
  assembling_machine_mk1: "assembling_machine_mk2",
  assembling_machine_mk2: "assembling_machine_mk3",
  arc_smelter: "plane_smelter",
  chemical_plant: "quantum_chemical_plant",
};

export interface RuntimeBeltDefinition {
  id: ConveyorBeltId;
  tier: BeltTier;
  speed: number;
  name: string;
}

const CORE_BELT_DEFINITIONS: RuntimeBeltDefinition[] = [
  { id: "conveyor_belt_mk1", tier: 1, speed: 6, name: "传送带 Mk.I" },
  { id: "conveyor_belt_mk2", tier: 2, speed: 12, name: "传送带 Mk.II" },
  { id: "conveyor_belt_mk3", tier: 3, speed: 30, name: "传送带 Mk.III" },
];
const RUNTIME_BELT_DEFINITIONS = new Map<number, RuntimeBeltDefinition>(CORE_BELT_DEFINITIONS.map((definition) => [definition.tier, definition]));

export function resetRuntimeBeltDefinitions(): void {
  RUNTIME_BELT_DEFINITIONS.clear();
  for (const definition of CORE_BELT_DEFINITIONS) RUNTIME_BELT_DEFINITIONS.set(definition.tier, { ...definition });
}

export function registerRuntimeBeltDefinition(definition: RuntimeBeltDefinition): boolean {
  if (!Number.isInteger(definition.tier) || definition.tier < 4 || definition.tier > 32 ||
    !Number.isFinite(definition.speed) || definition.speed <= 0 || RUNTIME_BELT_DEFINITIONS.has(definition.tier) ||
    [...RUNTIME_BELT_DEFINITIONS.values()].some((entry) => entry.id === definition.id)) return false;
  RUNTIME_BELT_DEFINITIONS.set(definition.tier, { ...definition });
  return true;
}

export function getBeltTiers(): BeltTier[] {
  return [...RUNTIME_BELT_DEFINITIONS.keys()].sort((left, right) => left - right);
}

export function isRegisteredBeltTier(tier: unknown): tier is BeltTier {
  return typeof tier === "number" && Number.isInteger(tier) && RUNTIME_BELT_DEFINITIONS.has(tier);
}

export function getBeltSpeed(tier: BeltTier): number {
  return RUNTIME_BELT_DEFINITIONS.get(tier)?.speed ?? 0;
}

export function getNextBeltTier(tier: BeltTier): BeltTier | null {
  return getBeltTiers().find((candidate) => candidate > tier) ?? null;
}

export const SORTER_CONSTRUCTION_BY_TIER: Record<SorterTier, SorterId> = {
  1: "sorter_mk1",
  2: "sorter_mk2",
  3: "sorter_mk3",
};

export function getRecipesForBuilding(buildingId: BuildingId): RecipeDefinition[] {
  // Content packs can add recipes at runtime. Keep the exported static index for
  // core-data consumers, but resolve this lookup from the live registry. A
  // declarative building family is a capability contract: pack-provided
  // smelters/assemblers/chemical plants receive the same generic recipes as
  // their core counterparts without duplicating hundreds of definitions.
  return Object.values(RECIPES).filter((recipe) => buildingSupportsRecipe(buildingId, recipe));
}

export function buildingSupportsRecipe(buildingId: BuildingId, recipe: RecipeDefinition): boolean {
  if ((RECIPE_BUILDING_BASE[buildingId] ?? buildingId) === recipe.buildingId) return true;
  const family = BUILDINGS[buildingId]?.family;
  return Boolean(family && BUILDINGS[recipe.buildingId]?.family === family);
}

export function getBuildingUpgradeTarget(buildingId: BuildingId): BuildingId | undefined {
  return BUILDING_UPGRADES[buildingId];
}

export function getBeltConstructionId(tier: BeltTier): ConveyorBeltId {
  return RUNTIME_BELT_DEFINITIONS.get(tier)?.id ?? `unknown_conveyor_belt_tier_${tier}`;
}

export function getBeltTier(id: ConveyorBeltId): BeltTier {
  return [...RUNTIME_BELT_DEFINITIONS.values()].find((definition) => definition.id === id)?.tier ?? 1;
}

export function getSorterConstructionId(tier: SorterTier): SorterId {
  return SORTER_CONSTRUCTION_BY_TIER[tier];
}

export function getSorterTier(id: SorterId): SorterTier {
  return id === "sorter_mk3" ? 3 : id === "sorter_mk2" ? 2 : 1;
}

export function isConveyorBeltId(id: ConstructionId): boolean {
  return [...RUNTIME_BELT_DEFINITIONS.values()].some((definition) => definition.id === id);
}

export function isSorterId(id: ConstructionId): id is SorterId {
  return id === "sorter_mk1" || id === "sorter_mk2" || id === "sorter_mk3";
}


/**
 * Construction ids that ship with the game.  The array is captured once so
 * runtime content-pack entries appended to CONSTRUCTION can be discovered
 * without changing the ordering of the built-in tray.
 */
const CORE_CONSTRUCTION_IDS: readonly ConstructionId[] = CONSTRUCTION.map((definition) => definition.buildingId);

export type ConstructionCategory = "power" | "production" | "logistics" | "dyson";

const CORE_CONSTRUCTION_CATEGORY_IDS: Record<ConstructionCategory, ReadonlySet<ConstructionId>> = {
  power: new Set(["wind_turbine", "solar_panel", "geothermal_power_station", "thermal_power_plant", "mini_fusion_power_plant", "artificial_star", "accumulator", "energy_exchanger"]),
  production: new Set(["mining_machine", "arc_smelter", "plane_smelter", "assembling_machine_mk1", "assembling_machine_mk2", "assembling_machine_mk3", "spray_coater", "matrix_lab", "oil_extractor", "oil_refinery", "water_pump", "chemical_plant", "quantum_chemical_plant", "fractionator", "miniature_particle_collider", "construction_center"]),
  logistics: new Set(["conveyor_belt_mk1", "conveyor_belt_mk2", "conveyor_belt_mk3", "storage_mk1", "material_delivery_hub", "orbital_cargo_terminal", "splitter_4way", "storage_tank", "planetary_logistics_station", "interstellar_logistics_station", "space_station_construction_launcher", "orbital_collector"]),
  dyson: new Set(["em_rail_ejector", "vertical_launching_silo", "ray_receiver", "galactic_material_exporter", "micro_black_hole_connector", "time_warp_device"]),
};

const CORE_RESOURCE_EXTRACTOR_IDS: ReadonlySet<BuildingId> = new Set([
  "mining_machine",
  "oil_extractor",
  "water_pump",
]);

/** Return the core construction order followed by active runtime additions. */
export function getConstructionCatalogIds(): ConstructionId[] {
  const result: ConstructionId[] = [];
  const seen = new Set<ConstructionId>();
  for (const id of [...CORE_CONSTRUCTION_IDS, ...CONSTRUCTION.map((definition) => definition.buildingId)]) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * Whether an entry has a supported placement interaction.  Core extractors
 * are installed on resource veins through their dedicated interaction; a
 * declarative `kind: "miner"` has no resource mapping yet and must not look
 * deployable in a free-coordinate tray.
 */
export function isConstructionDeployable(id: ConstructionId): boolean {
  if (isConveyorBeltId(id)) return true;
  const building = BUILDINGS[id as BuildingId];
  return Boolean(building && (building.kind !== "miner" || CORE_RESOURCE_EXTRACTOR_IDS.has(building.id)));
}

/**
 * Categorize both core and declarative content-pack construction entries.
 * Custom buildings use their safe generic kind; custom belts always belong to
 * logistics.  Dyson-specific behavior remains an explicit core allowlist.
 */
export function isConstructionInCategory(id: ConstructionId, category: ConstructionCategory): boolean {
  if (CORE_CONSTRUCTION_CATEGORY_IDS[category].has(id)) return true;
  if (isConveyorBeltId(id)) return category === "logistics";
  const building = BUILDINGS[id as BuildingId];
  if (!building) return false;
  if (category === "power") return building.kind === "power";
  if (category === "production") return building.kind === "machine" || building.kind === "miner";
  if (category === "logistics") return building.kind === "storage" || building.kind === "splitter" || building.kind === "station";
  return false;
}


/**
 * Historical system-space-station technologies remain in the catalog so old
 * saves and migration code can resolve their ids, but they are no longer
 * offered as new research.  The orbital elevator chain still unlocks the
 * compatible Mk.II station upgrade used by existing saves.
 */
export const DEPRECATED_TECHNOLOGY_IDS: ReadonlySet<TechId> = new Set<TechId>([
  "orbital_elevator_engineering",
  "orbital_multi_cargo_bus",
  "orbital_energy_recovery",
  "system_space_station_engineering",
  "orbital_modular_assembly",
  "autonomous_station_construction",
  "unified_system_logistics_protocol",
]);

export function isDeprecatedTechnology(id: TechId | null | undefined): boolean {
  return Boolean(id && DEPRECATED_TECHNOLOGY_IDS.has(id));
}

export const TECHNOLOGY_LIST = Object.values(TECHNOLOGIES).filter((technology) => !isDeprecatedTechnology(technology.id));


export const FUEL_ITEM_IDS = Object.keys(FUEL_ENERGY_MJ) as ItemId[];

const FUSION_FUEL_ITEM_IDS: ItemId[] = ["deuteron_fuel_rod"];
const ARTIFICIAL_STAR_FUEL_ITEM_IDS: ItemId[] = ["antimatter_fuel_rod"];

export function getFuelItemIdsForBuilding(buildingId: BuildingId): ItemId[] {
  if (buildingId === "mini_fusion_power_plant") return FUSION_FUEL_ITEM_IDS;
  if (buildingId === "artificial_star") return ARTIFICIAL_STAR_FUEL_ITEM_IDS;
  return buildingId === "thermal_power_plant" ? FUEL_ITEM_IDS : [];
}

export function getFuelEfficiency(buildingId: BuildingId): number {
  return buildingId === "thermal_power_plant" ? 0.8 : 1;
}

export function getPlanet(id: PlanetId): PlanetDefinition {
  return PLANETS[id];
}

export function getStarSystem(id: StarSystemId): StarSystemDefinition {
  return STAR_SYSTEMS[id];
}

export function getPlanetsForSystem(id: StarSystemId): PlanetDefinition[] {
  return STAR_SYSTEMS[id].planetIds.map((planetId) => PLANETS[planetId]);
}

export function getExtractorBuildingId(resourceId: ItemId): BuildingId {
  if (resourceId === "crude_oil") return "oil_extractor";
  if (resourceId === "water" || resourceId === "sulfuric_acid") return "water_pump";
  return "mining_machine";
}

export function getItem(id: ItemId): ItemDefinition {
  return ITEMS[id];
}

export function getBuilding(id: BuildingId): BuildingDefinition {
  return BUILDINGS[id];
}

export function getConstructionDefinition(id: ConstructionId): ConstructionDefinition | undefined {
  return CONSTRUCTION.find((definition) => definition.buildingId === id);
}

export function getCompatibleRecipeBuildings(recipe: RecipeDefinition): BuildingDefinition[] {
  return Object.values(BUILDINGS).filter((building) => buildingSupportsRecipe(building.id, recipe));
}

export function getRecipe(id: RecipeId | undefined): RecipeDefinition | undefined {
  return id ? RECIPES[id] : undefined;
}

export function getTechnology(id: TechId | null | undefined): TechnologyDefinition | undefined {
  return id ? TECHNOLOGIES[id] : undefined;
}

export interface ContentAuditIssue {
  severity: "error" | "warning";
  code: string;
  id: string;
  message: string;
}

export interface ContentAuditResult {
  valid: boolean;
  issues: ContentAuditIssue[];
}

/**
 * Validate the data registry at runtime so additions to the catalog cannot
 * silently create broken recipe cards, unreachable technologies, or save data
 * that points at an unknown content id.
 */
export function validateContentCatalog(): ContentAuditResult {
  const issues: ContentAuditIssue[] = [];
  const itemIds = new Set(Object.keys(ITEMS));
  const buildingIds = new Set(Object.keys(BUILDINGS));
  const techIds = new Set(Object.keys(TECHNOLOGIES));
  const add = (severity: ContentAuditIssue["severity"], code: string, id: string, message: string) => issues.push({ severity, code, id, message });

  for (const recipe of Object.values(RECIPES)) {
    if (!buildingIds.has(recipe.buildingId)) add("error", "recipe-building", recipe.id, `配方引用未知设备 ${recipe.buildingId}`);
    if (recipe.duration <= 0 || !Number.isFinite(recipe.duration)) add("error", "recipe-duration", recipe.id, "配方周期必须为正数");
    if (recipe.requiredTechId && !techIds.has(recipe.requiredTechId)) add("error", "recipe-tech", recipe.id, `配方引用未知科技 ${recipe.requiredTechId}`);
    for (const entry of [...recipe.inputs, ...recipe.outputs]) {
      if (!itemIds.has(entry.itemId)) add("error", "recipe-item", recipe.id, `配方引用未知物品 ${entry.itemId}`);
      if (entry.amount <= 0 || !Number.isFinite(entry.amount)) add("error", "recipe-amount", recipe.id, "配方数量必须为正数");
    }
    if (recipe.outputs.length === 0 && !["solar_sail_launch", "carrier_rocket_launch", "ray_power"].includes(recipe.id)) {
      add("warning", "recipe-no-output", recipe.id, "配方没有实体产物，将只作为流程记录");
    }
  }

  for (const definition of CONSTRUCTION) {
    if (!isConveyorBeltId(definition.buildingId) && !definition.buildingId.startsWith("sorter_") && !buildingIds.has(definition.buildingId)) {
      add("error", "construction-building", definition.buildingId, "施工定义引用未知建筑");
    }
    if (definition.requiredTechId && !techIds.has(definition.requiredTechId)) add("error", "construction-tech", definition.buildingId, `施工定义引用未知科技 ${definition.requiredTechId}`);
    for (const cost of definition.costs) if (!itemIds.has(cost.itemId)) add("error", "construction-item", definition.buildingId, `施工成本引用未知物品 ${cost.itemId}`);
  }

  for (const technology of Object.values(TECHNOLOGIES)) {
    for (const prerequisite of technology.prerequisites) if (!techIds.has(prerequisite)) add("error", "tech-prerequisite", technology.id, `科技引用未知前置 ${prerequisite}`);
    for (const cost of technology.costs) if (!itemIds.has(cost.itemId)) add("error", "tech-item", technology.id, `科技成本引用未知物品 ${cost.itemId}`);
  }

  const visiting = new Set<TechId>();
  const visited = new Set<TechId>();
  const walk = (techId: TechId) => {
    if (visiting.has(techId)) {
      add("error", "tech-cycle", techId, "科技前置关系存在循环");
      return;
    }
    if (visited.has(techId)) return;
    visiting.add(techId);
    for (const prerequisite of TECHNOLOGIES[techId]?.prerequisites ?? []) if (TECHNOLOGIES[prerequisite]) walk(prerequisite);
    visiting.delete(techId);
    visited.add(techId);
  };
  for (const technology of Object.values(TECHNOLOGIES)) walk(technology.id);

  return { valid: issues.every((issue) => issue.severity !== "error"), issues };
}
