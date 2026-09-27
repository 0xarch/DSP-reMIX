import { ITEMS, PLANET_LIST, PLANETS, STAR_SYSTEM_LIST, STAR_SYSTEMS } from "./content";
export { STAR_SYSTEM_LIST };
import { PLANET_TEMPLATE_POOLS, PLANET_TEMPLATES, STAR_CLASS_TEMPLATES, SYSTEM_POSITIONS } from "./galaxyCatalog";
import {
  LARGE_PLANET_TYPE_KEYS,
  PLANET_TYPES,
  SMALL_PLANET_TYPE_KEYS,
  STAR_SYSTEM_NAME_TABLE,
  STAR_SYSTEM_TYPES,
  planetTypeAffinityFit,
} from "../content/dsp/starSystems";
import { syncDynamicGalaxyCatalog } from "./content";
import type {
  GalaxyGenerationOptions,
  GalaxyState,
  GeneratedPlanetDef,
  GeneratedStarSystemDef,
  ItemAmount,
  ItemId,
  PlanetId,
  PlanetIndustrialProfile,
  PlanetDisplayMetadata,
  PlanetIndustryRole,
  PlanetOceanType,
  PlanetSpecialization,
  PlanetTemplateId,
  ResourceMode,
  StarClassId,
  StarSystemId,
  StarSystemProfile,
  StarSystemDisplayMetadata,
} from "./types";

export const GUARANTEED_CRUDE_OIL_PLANETS = ["pelagic", "dune", "prairie"] as const satisfies readonly PlanetId[];

function guaranteePlanetResources(planetId: PlanetId, resourceIds: ItemId[]): ItemId[] {
  if (!GUARANTEED_CRUDE_OIL_PLANETS.includes(planetId as typeof GUARANTEED_CRUDE_OIL_PLANETS[number]) || resourceIds.includes("crude_oil")) {
    return [...resourceIds];
  }
  return [...resourceIds, "crude_oil"];
}

export const DEFAULT_GALAXY_SEED = 240721;

/** 新建存档可配置的星系生成选项范围：迁移的 8 个星系恒在，
 *  第 9~32 个由种子按星系类型/星球类型表程序化生成。 */
export const GALAXY_SYSTEM_COUNT_MIN = 8;
export const GALAXY_SYSTEM_COUNT_MAX = 32;
export const GALAXY_DISTANCE_COEFFICIENT_MIN = 0.5;
export const GALAXY_DISTANCE_COEFFICIENT_MAX = 10;

export function normalizeGalaxyGenerationOptions(value: unknown): GalaxyGenerationOptions {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawCount = source.systemCount;
  const systemCount = typeof rawCount === "number" && Number.isFinite(rawCount)
    ? Math.min(GALAXY_SYSTEM_COUNT_MAX, Math.max(GALAXY_SYSTEM_COUNT_MIN, Math.floor(rawCount)))
    : GALAXY_SYSTEM_COUNT_MIN;
  const rawDistance = source.distanceCoefficient;
  const distanceCoefficient = typeof rawDistance === "number" && Number.isFinite(rawDistance)
    ? Math.min(GALAXY_DISTANCE_COEFFICIENT_MAX, Math.max(GALAXY_DISTANCE_COEFFICIENT_MIN, rawDistance))
    : 1;
  return { systemCount, distanceCoefficient };
}

/** 本存档的恒星系总数：迁移 8 系 + 程序化生成（8~32）。 */
export function includedStarSystemCount(galaxy: GalaxyState | undefined): number {
  const requested = galaxy?.generation?.systemCount ?? GALAXY_SYSTEM_COUNT_MIN;
  return Math.max(GALAXY_SYSTEM_COUNT_MIN, Math.min(GALAXY_SYSTEM_COUNT_MAX, requested));
}

export function isStarSystemIncluded(galaxy: GalaxyState | undefined, systemId: StarSystemId): boolean {
  if (galaxy?.generatedSystems?.some((system) => system.systemId === systemId)) return true;
  // 静态 8 系恒在（systemCount 下限即 8）；未知 ID 不属于本存档。
  const index = STATIC_STAR_SYSTEM_LIST.findIndex((system) => system.id === systemId);
  return index >= 0 && index < STATIC_STAR_SYSTEM_COUNT;
}
export const TIDAL_LOCKED_SOLAR_BONUS = 1.25;
export const PLANET_CUSTOM_NAME_MAX_LENGTH = 32;
export const STAR_SYSTEM_CUSTOM_NAME_MAX_LENGTH = 32;
export const PLANET_NOTE_MAX_LENGTH = 240;
export const PLANET_TAG_MAX_LENGTH = 16;
export const PLANET_TAG_MAX_COUNT = 8;

export const PLANET_INDUSTRY_ROLES: PlanetIndustryRole[] = [
  "auto",
  "mining",
  "smelting",
  "manufacturing",
  "chemical",
  "research",
  "logistics",
  "power",
];

export const PLANET_INDUSTRY_ROLE_LABELS: Record<PlanetIndustryRole, string> = {
  auto: "自动识别",
  mining: "采矿前哨",
  smelting: "冶炼基地",
  manufacturing: "制造中心",
  chemical: "化工基地",
  research: "科研中心",
  logistics: "物流枢纽",
  power: "能源基地",
};

const LEGACY_COLONY_COSTS: Partial<Record<PlanetId, ItemAmount[]>> = {
  home: [],
  ashen: [],
  giant: [],
  frost: [{ itemId: "titanium_ingot", amount: 2 }],
  boreal_giant: [{ itemId: "titanium_alloy", amount: 10 }, { itemId: "logistics_drone", amount: 5 }],
  magnetar: [{ itemId: "space_warper", amount: 4 }, { itemId: "processor", amount: 20 }],
};

const LEGACY_PROFILE_OVERRIDES: Partial<Record<PlanetId, {
  orbitalYields?: Partial<Record<ItemId, number>>;
  orbitalYieldMultiplier?: number;
  specializationName?: string;
  productionSpeedMultiplier?: number;
  surveyDurationSeconds?: number;
}>> = {
  home: { surveyDurationSeconds: 0 },
  ashen: { surveyDurationSeconds: 0 },
  giant: {
    orbitalYields: { hydrogen: 1, deuterium: 0.2, fire_ice: 0.5 },
    orbitalYieldMultiplier: 1,
    specializationName: "轨道窗口 · 采集器 +15%",
    productionSpeedMultiplier: 1.15,
    surveyDurationSeconds: 0,
  },
};

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number, key: string): number {
  let value = (Math.floor(seed) ^ hashText(key)) >>> 0;
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function jitter(seed: number, key: string, amplitude: number): number {
  return 1 + (seededUnit(seed, key) * 2 - 1) * amplitude;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizedSeed(seed: number): number {
  return Math.max(1, Math.abs(Math.floor(seed)) || DEFAULT_GALAXY_SEED);
}

/** 把玩家输入的种子解析为确定性数值：空白随机；纯数字直接用；文本走 FNV-1a 哈希。 */
export function createGalaxySeedFromText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return createPlayerGalaxySeed();
  if (/^-?\d{1,15}$/.test(trimmed)) return normalizedSeed(Number(trimmed));
  return normalizedSeed(hashText(trimmed));
}

export function createPlayerGalaxySeed(): number {
  try {
    const values = new Uint32Array(1);
    globalThis.crypto?.getRandomValues(values);
    if (values[0] > 0) return values[0];
  } catch {
    // The persisted seed is chosen once; simulation never reads wall-clock randomness.
  }
  return normalizedSeed(Date.now() ^ Math.floor(performance.now() * 1_000));
}

function chooseTemplate(seed: number, planetId: PlanetId, preserveBaseline: boolean): PlanetTemplateId {
  const planet = PLANETS[planetId];
  // 生成的行星不在静态模板池中，直接用注册时的默认模板。
  const pool = PLANET_TEMPLATE_POOLS[planetId];
  if (!planet || !pool) return planet?.defaultTemplateId ?? "oceanic";
  if (preserveBaseline || pool.length < 2) return planet.defaultTemplateId;
  return pool[Math.floor(seededUnit(seed, `${planetId}:template`) * pool.length) % pool.length];
}

function chooseRareResources(seed: number, planetId: PlanetId, templateId: PlanetTemplateId): ItemId[] {
  const template = PLANET_TEMPLATES[templateId];
  return [...template.rareResourcePool]
    .sort((left, right) => seededUnit(seed, `${planetId}:rare:${left}`) - seededUnit(seed, `${planetId}:rare:${right}`))
    .slice(0, template.rareResourceCount);
}

function profileColonyCost(seed: number, planetId: PlanetId, templateId: PlanetTemplateId, preserveBaseline: boolean): ItemAmount[] {
  const legacy = LEGACY_COLONY_COSTS[planetId];
  const source = legacy ?? PLANET_TEMPLATES[templateId].colonyCost;
  return source.map((cost) => ({
    ...cost,
    amount: legacy || preserveBaseline ? cost.amount : Math.max(1, Math.round(cost.amount * jitter(seed, `${planetId}:colony:${cost.itemId}`, 0.12))),
  }));
}

function createStarSystemProfiles(seed: number, preserveBaseline: boolean, distanceCoefficient = 1): GalaxyState["systemProfiles"] {
  return Object.fromEntries(STATIC_STAR_SYSTEM_LIST.map((system) => {
    const star = STAR_CLASS_TEMPLATES[system.defaultStarClassId];
    const basePosition = SYSTEM_POSITIONS[system.id];
    // 距离系数乘算至初始坐标的计算结果（母星系固定在原点）。
    const scaledBase = { x: basePosition.x * distanceCoefficient, y: basePosition.y * distanceCoefficient };
    const positionX = system.id === "helios" ? 0 : rounded(scaledBase.x + (preserveBaseline ? 0 : (seededUnit(seed, `${system.id}:x`) * 2 - 1) * 0.7));
    const positionY = system.id === "helios" ? 0 : rounded(scaledBase.y + (preserveBaseline ? 0 : (seededUnit(seed, `${system.id}:y`) * 2 - 1) * 0.7));
    const profile: StarSystemProfile = {
      systemId: system.id,
      starClassId: star.id,
      starTypeName: star.name,
      luminosity: rounded(star.luminosity * (preserveBaseline ? 1 : jitter(seed, `${system.id}:luminosity`, 0.06))),
      massMultiplier: rounded(star.massMultiplier * (preserveBaseline ? 1 : jitter(seed, `${system.id}:mass`, 0.04))),
      radiusMultiplier: rounded(star.radiusMultiplier * (preserveBaseline ? 1 : jitter(seed, `${system.id}:radius`, 0.04))),
      positionX,
      positionY,
      distanceFromOriginLy: rounded(Math.hypot(positionX, positionY)),
    };
    return [system.id, profile];
  })) as GalaxyState["systemProfiles"];
}

/** 静态目录星系数（迁移的 8 系恒在，生成的星系在其后追加）。
 *  注意：STAR_SYSTEM_LIST 会被动态目录注册修改，这里在模块加载时固定快照。 */
const STATIC_STAR_SYSTEM_LIST = [...STAR_SYSTEM_LIST];
const STATIC_PLANET_LIST = [...PLANET_LIST];
const STATIC_SYSTEM_IDS = new Set(Object.keys(STAR_SYSTEMS));
const STATIC_PLANET_IDS = new Set(Object.keys(PLANETS));
export const STATIC_STAR_SYSTEM_COUNT = STATIC_STAR_SYSTEM_LIST.length;

export interface ExtendedGalaxyGeneration {
  systems: GeneratedStarSystemDef[];
  planets: GeneratedPlanetDef[];
  systemProfiles: Record<string, StarSystemProfile>;
  profiles: Record<string, PlanetIndustrialProfile>;
  planetRoles: Record<string, PlanetIndustryRole>;
}

const seededInt = (seed: number, key: string, min: number, max: number): number =>
  min + Math.floor(seededUnit(seed, key) * (max - min + 1));

/**
 * 程序化生成第 9~N 个恒星系（确定性：全部随机来自存档种子）。
 * 算法：ID 表去重取名 → 随机星系类型（可重复）→ 行星环 ∈ [max-2, max] →
 * 大行星 ∈ [max-2, max] 且 ≤ 环数-2 → 每个空环（含大型行星子环）从星球类型中
 * 删去本星系已有类型、按依附星系数值范围契合度排序、前三随机取一；
 * 行星 ID = `${星系ID}-${星球类型}`。
 */
export function generateExtendedGalaxy(
  seed: number,
  systemCount: number,
  distanceCoefficient: number,
  preserveBaseline: boolean,
): ExtendedGalaxyGeneration {
  const extras = Math.max(0, Math.min(systemCount, 32) - STATIC_STAR_SYSTEM_COUNT);
  const dynamicIds = Object.keys(STAR_SYSTEM_NAME_TABLE).filter((id) => !STATIC_SYSTEM_IDS.has(id));
  const systems: GeneratedStarSystemDef[] = [];
  const planets: GeneratedPlanetDef[] = [];
  const systemProfiles: Record<string, StarSystemProfile> = {};
  const profiles: Record<string, PlanetIndustrialProfile> = {};
  const planetRoles: Record<string, PlanetIndustryRole> = {};
  let previousSystemId: StarSystemId = "blue_giant";

  for (let index = 0; index < extras; index += 1) {
    const systemId = (dynamicIds[index] ?? `outer_${index + 1}`) as StarSystemId;
    const displayName = STAR_SYSTEM_NAME_TABLE[systemId] ?? `外环星域 ${index + 1}`;
    const typeKeys = Object.keys(STAR_SYSTEM_TYPES);
    const typeCode = typeKeys[Math.floor(seededUnit(seed, `${systemId}:type`) * typeKeys.length)];
    const type = STAR_SYSTEM_TYPES[typeCode];
    const dims = { temperature: type.temperature, gravity: type.gravity, wildness: type.wildness, organism: type.organism };

    // 行星环：至少为上限-2，最大为上限。
    const rings = seededInt(seed, `${systemId}:rings`, Math.max(1, type.maxRings - 2), type.maxRings);
    // 大行星：类似区间，但不超过行星环数量 - 2。
    const maxLarge = Math.max(0, Math.min(type.maxLargePlanets, rings - 2));
    const largeCount = maxLarge > 0 ? seededInt(seed, `${systemId}:large`, Math.max(0, maxLarge - 2), maxLarge) : 0;
    const largePool = [...LARGE_PLANET_TYPE_KEYS]
      .sort((left, right) => seededUnit(seed, `${systemId}:large:${left}`) - seededUnit(seed, `${systemId}:large:${right}`));
    const largeTypes = largePool.slice(0, largeCount);

    // 小型行星：空主环数 + 大型行星子环数；类型不可与当前星系已有类型重复。
    const subRingTotal = largeTypes.reduce((sum, key) => sum + PLANET_TYPES[key].largeRings, 0);
    const smallSlots = (rings - largeCount) + subRingTotal;
    const usedTypes = new Set(largeTypes);
    const smallTypes: string[] = [];
    for (let slot = 0; slot < smallSlots; slot += 1) {
      const pool = SMALL_PLANET_TYPE_KEYS.filter((key) => !usedTypes.has(key));
      if (pool.length === 0) break;
      const scored = pool
        .map((key) => ({
          key,
          fit: planetTypeAffinityFit(PLANET_TYPES[key], dims),
          order: seededUnit(seed, `${systemId}:small:${slot}:${key}`),
        }))
        .sort((left, right) => right.fit - left.fit || left.order - right.order);
      const top = scored.slice(0, Math.min(3, scored.length));
      const chosen = top[Math.floor(seededUnit(seed, `${systemId}:small:${slot}:pick`) * top.length)];
      smallTypes.push(chosen.key);
      usedTypes.add(chosen.key);
    }

    // 位置：类型距离范围 × 种子扰动 × 距离系数。
    const [dMin, dMax] = type.distanceLyRange;
    const baseDistance = dMin + seededUnit(seed, `${systemId}:distance`) * (dMax - dMin);
    const angle = seededUnit(seed, `${systemId}:angle`) * Math.PI * 2;
    const distance = Math.max(0.1, Math.round(baseDistance * distanceCoefficient));
    const positionX = rounded(Math.cos(angle) * distance);
    const positionY = rounded(Math.sin(angle) * distance);
    const star = STAR_CLASS_TEMPLATES[type.starClassId];
    systemProfiles[systemId] = {
      systemId,
      starClassId: type.starClassId,
      starTypeName: type.starType,
      luminosity: rounded(star.luminosity * (preserveBaseline ? 1 : jitter(seed, `${systemId}:luminosity`, 0.06))),
      massMultiplier: rounded(star.massMultiplier * (preserveBaseline ? 1 : jitter(seed, `${systemId}:mass`, 0.04))),
      radiusMultiplier: rounded(star.radiusMultiplier * (preserveBaseline ? 1 : jitter(seed, `${systemId}:radius`, 0.04))),
      positionX,
      positionY,
      distanceFromOriginLy: rounded(Math.hypot(positionX, positionY)),
    };

    // 轨道分配：大型行星占前 largeCount 个主环，其子环与其余空主环放小型行星。
    const orbitPlanets: Array<{ typeCode: string; large: boolean }> = [];
    const smallQueue = [...smallTypes];
    for (let ring = 1; ring <= rings && orbitPlanets.length < 32; ring += 1) {
      if (ring <= largeCount) {
        const key = largeTypes[ring - 1];
        orbitPlanets.push({ typeCode: key, large: true });
        for (let sub = 0; sub < PLANET_TYPES[key].largeRings; sub += 1) {
          const smallKey = smallQueue.shift();
          if (!smallKey) break;
          orbitPlanets.push({ typeCode: smallKey, large: false });
        }
      } else {
        const key = smallQueue.shift();
        if (!key) break;
        orbitPlanets.push({ typeCode: key, large: false });
      }
    }

    const explorationCost = type.explorationCost.map((cost) => ({ ...cost }));
    systems.push({
      systemId,
      displayName,
      typeCode,
      starType: type.starType,
      starClassId: type.starClassId,
      color: type.color,
      temperature: dims.temperature,
      gravity: dims.gravity,
      wildness: dims.wildness,
      organism: dims.organism,
      rings,
      largePlanets: [...largeTypes],
      positionX,
      positionY,
      distanceFromOriginLy: rounded(Math.hypot(positionX, positionY)),
      luminosity: systemProfiles[systemId].luminosity,
      massMultiplier: systemProfiles[systemId].massMultiplier,
      radiusMultiplier: systemProfiles[systemId].radiusMultiplier,
      explorationCost,
    });

    let orbitIndex = 0;
    for (const entry of orbitPlanets) {
      orbitIndex += 1;
      const planetType = PLANET_TYPES[entry.typeCode];
      const planetId = `${systemId}-${entry.typeCode}` as PlanetId;
      const template = PLANET_TEMPLATES[planetType.templateId];
      const resourceIds = Object.entries(planetType.resources)
        .filter(([itemId, probability]) => seededUnit(seed, `${planetId}:res:${itemId}`) < (probability ?? 0))
        .map(([itemId]) => itemId as ItemId);
      if (resourceIds.length === 0 && template.resourceIds.length > 0) resourceIds.push(template.resourceIds[0]);
      const rareResourceIds = [...template.rareResourcePool]
        .sort((left, right) => seededUnit(seed, `${planetId}:rare:${left}`) - seededUnit(seed, `${planetId}:rare:${right}`))
        .slice(0, template.rareResourceCount);
      const variation = preserveBaseline ? 1 : jitter(seed, `${planetId}:climate`, 0.12);
      const resourceVariation = preserveBaseline ? 1 : jitter(seed, `${planetId}:resources`, 0.2);
      const orbitalYields = Object.fromEntries(Object.entries(template.orbitalYields).map(([itemId, rate]) => [
        itemId,
        rounded((rate ?? 0) * (preserveBaseline ? 1 : jitter(seed, `${planetId}:orbit:${itemId}`, 0.14))),
      ])) as Partial<Record<ItemId, number>>;
      profiles[planetId] = {
        planetId,
        templateId: planetType.templateId,
        climateName: template.name,
        resourceIds: guaranteePlanetResources(planetId, resourceIds),
        rareResourceIds,
        oceanType: template.oceanType,
        orbitalYields,
        windMultiplier: rounded(template.windMultiplier * variation),
        solarMultiplier: rounded(template.solarMultiplier * (preserveBaseline ? 1 : jitter(seed, `${planetId}:solar`, 0.1))),
        geothermalMultiplier: rounded(template.geothermalMultiplier * variation),
        miningMultiplier: rounded(template.miningMultiplier * resourceVariation),
        orbitalYieldMultiplier: rounded(template.orbitalYieldMultiplier * resourceVariation),
        reserveScale: rounded(template.reserveScale * resourceVariation),
        travelTimeMultiplier: rounded(template.travelTimeMultiplier * (preserveBaseline ? 1 : jitter(seed, `${planetId}:travel`, 0.08))),
        tidalLocked: Boolean(template.tidalLocked),
        sulfuricOcean: template.oceanType === "sulfuric-acid",
        specialization: template.specialization,
        specializationName: template.specializationName,
        productionSpeedMultiplier: template.productionSpeedMultiplier,
        colonyCost: profileColonyCost(seed, planetId, planetType.templateId, preserveBaseline),
        surveyDurationSeconds: preserveBaseline
          ? template.surveyDurationSeconds
          : Math.max(0, Math.round(template.surveyDurationSeconds * jitter(seed, `${planetId}:survey`, 0.1))),
      };
      planetRoles[planetId] = "auto";
      planets.push({
        planetId,
        typeCode: entry.typeCode,
        displayName: `${displayName} · ${planetType.name}`,
        systemId,
        large: entry.large,
        orbitIndex,
        kind: entry.large ? "gas-giant" : "terrestrial",
        color: planetType.color,
        code: `${planetType.code} · ${typeCode}`,
      });
    }
    previousSystemId = systemId;
  }
  void previousSystemId;
  return { systems, planets, systemProfiles, profiles, planetRoles };
}

export function createGalaxyState(
  seed = DEFAULT_GALAXY_SEED,
  preserveBaseline = false,
  options?: Partial<GalaxyGenerationOptions>,
): GalaxyState {
  const normalized = normalizedSeed(seed);
  const generation = normalizeGalaxyGenerationOptions(options);
  const systemProfiles = createStarSystemProfiles(normalized, preserveBaseline, generation.distanceCoefficient);
  const extended = generateExtendedGalaxy(normalized, generation.systemCount, generation.distanceCoefficient, preserveBaseline);
  Object.assign(systemProfiles, extended.systemProfiles);
  const profiles = Object.fromEntries(STATIC_PLANET_LIST.map((planet) => {
    const templateId = chooseTemplate(normalized, planet.id, preserveBaseline);
    const template = PLANET_TEMPLATES[templateId];
    const variation = preserveBaseline ? 1 : jitter(normalized, `${planet.id}:climate`, 0.12);
    const resourceVariation = preserveBaseline ? 1 : jitter(normalized, `${planet.id}:resources`, 0.2);
    const rareResourceIds = chooseRareResources(normalized, planet.id, templateId);
    const legacyOverride = LEGACY_PROFILE_OVERRIDES[planet.id];
    const orbitalYields = Object.fromEntries(Object.entries(legacyOverride?.orbitalYields ?? template.orbitalYields).map(([itemId, rate]) => [
      itemId,
      rounded((rate ?? 0) * (preserveBaseline ? 1 : jitter(normalized, `${planet.id}:orbit:${itemId}`, 0.14))),
    ])) as Partial<Record<ItemId, number>>;
    const profile: PlanetIndustrialProfile = {
      planetId: planet.id,
      templateId,
      climateName: template.name,
      resourceIds: guaranteePlanetResources(planet.id, [...template.resourceIds, ...rareResourceIds]),
      rareResourceIds,
      oceanType: template.oceanType,
      orbitalYields,
      windMultiplier: rounded(template.windMultiplier * variation),
      solarMultiplier: rounded(template.solarMultiplier * (preserveBaseline ? 1 : jitter(normalized, `${planet.id}:solar`, 0.1))),
      geothermalMultiplier: rounded(template.geothermalMultiplier * variation),
      miningMultiplier: rounded(template.miningMultiplier * resourceVariation),
      orbitalYieldMultiplier: rounded((legacyOverride?.orbitalYieldMultiplier ?? template.orbitalYieldMultiplier) * resourceVariation),
      reserveScale: rounded(template.reserveScale * resourceVariation),
      travelTimeMultiplier: rounded(template.travelTimeMultiplier * (preserveBaseline ? 1 : jitter(normalized, `${planet.id}:travel`, 0.08))),
      tidalLocked: Boolean(template.tidalLocked),
      sulfuricOcean: template.oceanType === "sulfuric-acid",
      specialization: template.specialization,
      specializationName: legacyOverride?.specializationName ?? template.specializationName,
      productionSpeedMultiplier: legacyOverride?.productionSpeedMultiplier ?? template.productionSpeedMultiplier,
      colonyCost: profileColonyCost(normalized, planet.id, templateId, preserveBaseline),
      surveyDurationSeconds: preserveBaseline
        ? legacyOverride?.surveyDurationSeconds ?? template.surveyDurationSeconds
        : Math.max(0, Math.round((legacyOverride?.surveyDurationSeconds ?? template.surveyDurationSeconds) * jitter(normalized, `${planet.id}:survey`, 0.1))),
    };
    return [planet.id, profile];
  })) as GalaxyState["profiles"];
  const planetRoles = Object.fromEntries(STATIC_PLANET_LIST.map((planet) => [planet.id, "auto" as PlanetIndustryRole])) as Record<PlanetId, PlanetIndustryRole>;
  Object.assign(planetRoles, extended.planetRoles);
  Object.assign(profiles, extended.profiles);
  const state: GalaxyState = {
    seed: normalized,
    generation,
    generatedSystems: extended.systems,
    generatedPlanets: extended.planets,
    profiles,
    systemProfiles,
    planetRoles,
    planetMetadata: {},
    systemMetadata: {},
  };
  // 生成的星系/行星注册进内容目录（PLANETS/PLANET_LIST/STAR_SYSTEMS/STAR_SYSTEM_LIST），
  // 使引擎建州、星图、统计等既有遍历自动感知动态条目。
  syncDynamicGalaxyCatalog(state);
  return state;
}

function normalizedText(value: unknown, maximumLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

export function normalizePlanetDisplayMetadata(value: unknown): PlanetDisplayMetadata | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const customName = normalizedText(source.customName, PLANET_CUSTOM_NAME_MAX_LENGTH);
  const note = normalizedText(source.note, PLANET_NOTE_MAX_LENGTH);
  const tags = Array.isArray(source.tags)
    ? [...new Set(source.tags.map((tag) => normalizedText(tag, PLANET_TAG_MAX_LENGTH)).filter(Boolean))].slice(0, PLANET_TAG_MAX_COUNT)
    : [];
  return customName || note || tags.length > 0 ? { customName, note, tags } : null;
}

export function normalizeStarSystemDisplayMetadata(value: unknown): StarSystemDisplayMetadata | null {
  if (!value || typeof value !== "object") return null;
  const customName = normalizedText((value as Record<string, unknown>).customName, STAR_SYSTEM_CUSTOM_NAME_MAX_LENGTH);
  return customName ? { customName } : null;
}

function profileNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.round(value * 100) / 100))
    : fallback;
}

function isPlanetSpecialization(value: unknown): value is PlanetSpecialization {
  return value === "balanced" || value === "smelting" || value === "chemical" || value === "logistics" ||
    value === "research" || value === "particle";
}

function isPlanetTemplateId(value: unknown): value is PlanetTemplateId {
  return typeof value === "string" && value in PLANET_TEMPLATES;
}

function isStarClassId(value: unknown): value is StarClassId {
  return typeof value === "string" && value in STAR_CLASS_TEMPLATES;
}

function isOceanType(value: unknown): value is PlanetOceanType {
  return value === "water" || value === "sulfuric-acid" || value === "lava" || value === "ice" || value === "none";
}

function itemIds(value: unknown, fallback: ItemId[]): ItemId[] {
  if (!Array.isArray(value)) return [...fallback];
  const valid = [...new Set(value.filter((itemId): itemId is ItemId => typeof itemId === "string" && itemId in ITEMS))];
  return valid.length > 0 ? valid : [...fallback];
}

function itemAmounts(value: unknown, fallback: ItemAmount[]): ItemAmount[] {
  if (!Array.isArray(value)) return fallback.map((cost) => ({ ...cost }));
  const valid = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const cost = entry as Record<string, unknown>;
    if (typeof cost.itemId !== "string" || !(cost.itemId in ITEMS)) return [];
    const amount = profileNumber(cost.amount, 0, 0, 1_000_000);
    return amount > 0 ? [{ itemId: cost.itemId as ItemId, amount: Math.floor(amount) }] : [];
  });
  return valid.length > 0 || value.length === 0 ? valid : fallback.map((cost) => ({ ...cost }));
}

function orbitalYields(value: unknown, fallback: Partial<Record<ItemId, number>>): Partial<Record<ItemId, number>> {
  if (!value || typeof value !== "object") return { ...fallback };
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([itemId, rate]) =>
    itemId in ITEMS ? [[itemId, profileNumber(rate, 0, 0, 10)]] : [])) as Partial<Record<ItemId, number>>;
}

export function normalizeGalaxyState(value: unknown, preserveBaseline = false): GalaxyState {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const seed = typeof source.seed === "number" && Number.isFinite(source.seed) ? source.seed : DEFAULT_GALAXY_SEED;
  const normalized = createGalaxyState(seed, preserveBaseline, normalizeGalaxyGenerationOptions(source.generation));
  const sourceProfiles = source.profiles && typeof source.profiles === "object" ? source.profiles as Record<string, unknown> : {};

  for (const planetId of Object.keys(normalized.profiles) as PlanetId[]) {
    const fallback = normalized.profiles[planetId];
    const raw = sourceProfiles[planetId];
    if (!raw || typeof raw !== "object") continue;
    const profile = raw as Record<string, unknown>;
    const templateId = isPlanetTemplateId(profile.templateId) && PLANET_TEMPLATES[profile.templateId].kind === PLANETS[planetId].kind
      ? profile.templateId
      : fallback.templateId;
    const template = PLANET_TEMPLATES[templateId];
    const resources = guaranteePlanetResources(planetId, itemIds(profile.resourceIds, fallback.resourceIds));
    const rareResources = itemIds(profile.rareResourceIds, fallback.rareResourceIds).filter((itemId) => resources.includes(itemId));
    const oceanType = isOceanType(profile.oceanType) ? profile.oceanType : typeof profile.sulfuricOcean === "boolean" && profile.sulfuricOcean ? "sulfuric-acid" : fallback.oceanType;
    normalized.profiles[planetId] = {
      ...fallback,
      templateId,
      climateName: typeof profile.climateName === "string" && profile.climateName.trim() ? profile.climateName.trim().slice(0, 40) : template.name,
      resourceIds: resources,
      rareResourceIds: rareResources,
      oceanType,
      orbitalYields: orbitalYields(profile.orbitalYields, fallback.orbitalYields),
      windMultiplier: profileNumber(profile.windMultiplier, fallback.windMultiplier, 0, 5),
      solarMultiplier: profileNumber(profile.solarMultiplier, fallback.solarMultiplier, 0, 5),
      geothermalMultiplier: profileNumber(profile.geothermalMultiplier, fallback.geothermalMultiplier, 0, 5),
      miningMultiplier: profileNumber(profile.miningMultiplier, fallback.miningMultiplier, 0.05, 5),
      orbitalYieldMultiplier: profileNumber(profile.orbitalYieldMultiplier, fallback.orbitalYieldMultiplier, 0.05, 5),
      reserveScale: profileNumber(profile.reserveScale, fallback.reserveScale, 0.05, 10),
      travelTimeMultiplier: profileNumber(profile.travelTimeMultiplier, fallback.travelTimeMultiplier, 0.1, 5),
      tidalLocked: typeof profile.tidalLocked === "boolean" ? profile.tidalLocked : fallback.tidalLocked,
      sulfuricOcean: oceanType === "sulfuric-acid",
      specialization: isPlanetSpecialization(profile.specialization) ? profile.specialization : fallback.specialization,
      specializationName: typeof profile.specializationName === "string" && profile.specializationName.trim() ? profile.specializationName.trim().slice(0, 48) : fallback.specializationName,
      productionSpeedMultiplier: profileNumber(profile.productionSpeedMultiplier, fallback.productionSpeedMultiplier, 0.1, 5),
      colonyCost: itemAmounts(profile.colonyCost, fallback.colonyCost),
      surveyDurationSeconds: profileNumber(profile.surveyDurationSeconds, fallback.surveyDurationSeconds, 0, 86_400),
    };
  }

  const sourceSystems = source.systemProfiles && typeof source.systemProfiles === "object" ? source.systemProfiles as Record<string, unknown> : {};
  for (const systemId of Object.keys(normalized.systemProfiles) as StarSystemId[]) {
    const fallback = normalized.systemProfiles[systemId];
    const raw = sourceSystems[systemId];
    if (!raw || typeof raw !== "object") continue;
    const profile = raw as Record<string, unknown>;
    const starClassId = isStarClassId(profile.starClassId) ? profile.starClassId : fallback.starClassId;
    const star = STAR_CLASS_TEMPLATES[starClassId];
    const positionX = profileNumber(profile.positionX, fallback.positionX, -100, 100);
    const positionY = profileNumber(profile.positionY, fallback.positionY, -100, 100);
    normalized.systemProfiles[systemId] = {
      systemId,
      starClassId,
      starTypeName: typeof profile.starTypeName === "string" && profile.starTypeName.trim() ? profile.starTypeName.trim().slice(0, 36) : star.name,
      luminosity: profileNumber(profile.luminosity, fallback.luminosity, 0.01, 20),
      massMultiplier: profileNumber(profile.massMultiplier, fallback.massMultiplier, 0.01, 20),
      radiusMultiplier: profileNumber(profile.radiusMultiplier, fallback.radiusMultiplier, 0.01, 20),
      positionX,
      positionY,
      distanceFromOriginLy: rounded(Math.hypot(positionX, positionY)),
    };
  }

  const sourceRoles = source.planetRoles && typeof source.planetRoles === "object" ? source.planetRoles as Record<string, unknown> : {};
  for (const planetId of Object.keys(normalized.planetRoles) as PlanetId[]) {
    const role = sourceRoles[planetId];
    if (PLANET_INDUSTRY_ROLES.includes(role as PlanetIndustryRole)) normalized.planetRoles[planetId] = role as PlanetIndustryRole;
  }
  const sourcePlanetMetadata = source.planetMetadata && typeof source.planetMetadata === "object"
    ? source.planetMetadata as Record<string, unknown>
    : {};
  for (const planetId of Object.keys(normalized.profiles) as PlanetId[]) {
    const metadata = normalizePlanetDisplayMetadata(sourcePlanetMetadata[planetId]);
    if (metadata) normalized.planetMetadata[planetId] = metadata;
  }
  const sourceSystemMetadata = source.systemMetadata && typeof source.systemMetadata === "object"
    ? source.systemMetadata as Record<string, unknown>
    : {};
  for (const systemId of Object.keys(normalized.systemProfiles) as StarSystemId[]) {
    const metadata = normalizeStarSystemDisplayMetadata(sourceSystemMetadata[systemId]);
    if (metadata) normalized.systemMetadata[systemId] = metadata;
  }
  return normalized;
}

let baselineGalaxy: GalaxyState | undefined;

function fallbackGalaxy(): GalaxyState {
  baselineGalaxy ??= createGalaxyState(DEFAULT_GALAXY_SEED, true);
  return baselineGalaxy;
}

export function getPlanetIndustrialProfile(state: { galaxy?: GalaxyState }, planetId: PlanetId): PlanetIndustrialProfile {
  return state.galaxy?.profiles?.[planetId] ?? fallbackGalaxy().profiles[planetId];
}

export function getStarSystemProfile(state: { galaxy?: GalaxyState }, systemId: StarSystemId): StarSystemProfile {
  return state.galaxy?.systemProfiles?.[systemId] ?? fallbackGalaxy().systemProfiles[systemId];
}

export function getPlanetDisplayName(state: { galaxy?: GalaxyState }, planetId: PlanetId): string {
  return state.galaxy?.planetMetadata?.[planetId]?.customName || PLANETS[planetId].name;
}

export function getStarSystemDisplayName(state: { galaxy?: GalaxyState }, systemId: StarSystemId): string {
  return state.galaxy?.systemMetadata?.[systemId]?.customName || STAR_SYSTEMS[systemId].name;
}

export function getPlanetSearchText(state: { galaxy?: GalaxyState }, planetId: PlanetId): string {
  const planet = PLANETS[planetId];
  const system = STAR_SYSTEMS[planet.systemId];
  const metadata = state.galaxy?.planetMetadata?.[planetId];
  return [
    planet.name,
    planet.code,
    getPlanetDisplayName(state, planetId),
    system.name,
    getStarSystemDisplayName(state, planet.systemId),
    metadata?.note ?? "",
    ...(metadata?.tags ?? []),
  ].join(" ").toLocaleLowerCase("zh-CN");
}

export function getStarLuminosity(state: { galaxy?: GalaxyState }, systemId: StarSystemId): number {
  return getStarSystemProfile(state, systemId).luminosity;
}

export function getPlanetSolarPowerMultiplier(state: { galaxy?: GalaxyState }, planetId: PlanetId): number {
  const profile = getPlanetIndustrialProfile(state, planetId);
  const luminosity = getStarLuminosity(state, PLANETS[planetId].systemId);
  return rounded(profile.solarMultiplier * luminosity * (profile.tidalLocked ? TIDAL_LOCKED_SOLAR_BONUS : 1));
}

export function getSystemDistanceLy(state: { galaxy?: GalaxyState }, sourceSystemId: StarSystemId, targetSystemId: StarSystemId): number {
  if (sourceSystemId === targetSystemId) return 0;
  const source = getStarSystemProfile(state, sourceSystemId);
  const target = getStarSystemProfile(state, targetSystemId);
  return rounded(Math.max(0.1, Math.hypot(source.positionX - target.positionX, source.positionY - target.positionY)));
}

export function getPlanetOrbitalYields(state: { galaxy?: GalaxyState }, planetId: PlanetId): Partial<Record<ItemId, number>> {
  return getPlanetIndustrialProfile(state, planetId).orbitalYields;
}

export function getRecommendedPlanetRole(state: { galaxy?: GalaxyState }, planetId: PlanetId): Exclude<PlanetIndustryRole, "auto"> {
  const specialization = getPlanetIndustrialProfile(state, planetId).specialization;
  if (specialization === "smelting") return "smelting";
  if (specialization === "chemical") return "chemical";
  if (specialization === "logistics") return "logistics";
  if (specialization === "research") return "research";
  if (specialization === "particle") return "manufacturing";
  return "manufacturing";
}

export function isInfiniteResource(itemId: ItemId, planetId: PlanetId, mode: ResourceMode, galaxy?: GalaxyState): boolean {
  if (mode === "infinite") return true;
  const oceanType = getPlanetIndustrialProfile({ galaxy }, planetId).oceanType;
  return (itemId === "water" && oceanType === "water") || (itemId === "sulfuric_acid" && oceanType === "sulfuric-acid");
}

export function createVeinReserve(galaxy: GalaxyState, planetId: PlanetId, itemId: ItemId, veinId: string): number {
  const rare = new Set<ItemId>([
    "kimberlite_ore",
    "fractal_silicon",
    "optical_grating_crystal",
    "spiniform_stalagmite_crystal",
    "unipolar_magnet",
    "organic_crystal",
  ]);
  const oilMultiplier = itemId !== "crude_oil" ? 1 : planetId === "dune" ? 2.4 : planetId === "prairie" ? 1.5 : planetId === "pelagic" ? 1.15 : 1;
  const base = itemId === "crude_oil" ? 420_000 * oilMultiplier : rare.has(itemId) ? 36_000 : 240_000;
  const profile = galaxy.profiles[planetId];
  return Math.max(1, Math.floor(base * profile.reserveScale * jitter(galaxy.seed, `${veinId}:${itemId}`, 0.16)));
}

export function specializationApplies(profile: PlanetIndustrialProfile, buildingFamily?: string, buildingId?: string): boolean {
  if (profile.specialization === "balanced") return true;
  if (profile.specialization === "smelting") return buildingFamily === "smelter";
  if (profile.specialization === "chemical") return buildingFamily === "chemical";
  if (profile.specialization === "research") return buildingId === "matrix_lab";
  if (profile.specialization === "particle") return buildingId === "miniature_particle_collider" || buildingId === "fractionator";
  return buildingId === "orbital_collector" || buildingId?.includes("logistics_station") === true;
}

export function getSystemStarTypeName(state: { galaxy?: GalaxyState }, systemId: StarSystemId): string {
  return getStarSystemProfile(state, systemId).starTypeName || STAR_SYSTEMS[systemId].starType;
}
