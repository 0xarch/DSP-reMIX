import type { ItemAmount, ItemId, PlanetId, PlanetTemplateId, StarClassId, StarSystemDefinition, StarSystemId } from "../../game/types";

export const STAR_SYSTEMS: Record<StarSystemId, StarSystemDefinition> = {
  helios: {
    id: "helios",
    name: "赫利俄斯",
    code: "母恒星系",
    starType: "G 型主序星",
    defaultStarClassId: "g_main",
    color: "#e1b452",
    distanceLy: 0,
    description: "工业网络的起点，拥有海洋、熔岩与气态巨星三种基础生态。",
    planetIds: ["home", "ashen", "giant"],
    explorationCost: [],
  },
  borealis: {
    id: "borealis",
    name: "北冕座",
    code: "冰晶恒星系",
    starType: "K 型橙矮星",
    defaultStarClassId: "k_dwarf",
    color: "#79aeb9",
    distanceLy: 4.2,
    description: "低温行星保存了天然微观结构，是可燃冰与高阶晶体的主要产区。",
    planetIds: ["frost", "boreal_giant"],
    explorationCost: [
      { itemId: "space_warper", amount: 2 },
      { itemId: "information_matrix", amount: 10 },
    ],
    requiredTechId: "stellar_exploration",
  },
  aurora: {
    id: "aurora", name: "曙光庭", code: "F 型星系", starType: "F 型主序星", defaultStarClassId: "f_main", color: "#e8d99b", distanceLy: 9.4,
    description: "高光照星区，海洋与草原生态适合建立太阳能和综合制造基地。", planetIds: ["verdant", "pelagic", "aurora_giant"],
    explorationCost: [{ itemId: "space_warper", amount: 3 }, { itemId: "information_matrix", amount: 20 }], requiredTechId: "stellar_exploration", prerequisiteSystemId: "borealis",
  },
  ember: {
    id: "ember", name: "余烬座", code: "红矮星系", starType: "M 型红矮星", defaultStarClassId: "m_dwarf", color: "#c76c56", distanceLy: 15.7,
    description: "低亮度红矮星周围聚集着矿物丰厚的荒漠与火山世界。", planetIds: ["dune", "cinder", "ember_giant"],
    explorationCost: [{ itemId: "space_warper", amount: 4 }, { itemId: "gravity_matrix", amount: 10 }], requiredTechId: "stellar_exploration", prerequisiteSystemId: "aurora",
  },
  sirius: {
    id: "sirius", name: "天狼工域", code: "A 型星系", starType: "A 型主序星", defaultStarClassId: "a_main", color: "#dbe8ff", distanceLy: 20.4,
    description: "强光恒星与富硅晶体行星组成的高能工业区，戴森工程收益显著。", planetIds: ["crystal", "prairie", "sirius_giant"],
    explorationCost: [{ itemId: "space_warper", amount: 6 }, { itemId: "gravity_matrix", amount: 20 }], requiredTechId: "stellar_exploration", prerequisiteSystemId: "ember",
  },
  white_dwarf: {
    id: "white_dwarf", name: "苍白余烬", code: "白矮星系", starType: "白矮星", defaultStarClassId: "white_dwarf", color: "#d9e4ef", distanceLy: 18.7,
    description: "致密恒星周围保留盐湖、黑曜火山和冰巨星，适合作为星际中转节点。", planetIds: ["salt", "obsidian", "white_giant"],
    explorationCost: [{ itemId: "space_warper", amount: 8 }, { itemId: "universe_matrix", amount: 5 }], requiredTechId: "stellar_exploration", prerequisiteSystemId: "sirius",
  },
  neutron: {
    id: "neutron",
    name: "赫卡忒",
    code: "中子星系",
    starType: "中子星",
    defaultStarClassId: "neutron_star",
    color: "#a88ec5",
    distanceLy: 11.8,
    description: "极端磁场重塑了行星矿层，可持续开采极为稀有的单极磁石。",
    planetIds: ["magnetar"],
    explorationCost: [
      { itemId: "space_warper", amount: 5 },
      { itemId: "gravity_matrix", amount: 20 },
    ],
    requiredTechId: "stellar_exploration",
    prerequisiteSystemId: "borealis",
  },
  blue_giant: {
    id: "blue_giant", name: "蔚蓝王座", code: "蓝巨星系", starType: "O 型蓝巨星", defaultStarClassId: "o_blue_giant", color: "#6fa8ff", distanceLy: 30,
    description: "遥远而极亮的终局星区，戴森结构回报极高，但殖民与长航线成本同样惊人。", planetIds: ["tempest", "inferno", "abyss", "azure_giant"],
    explorationCost: [{ itemId: "space_warper", amount: 12 }, { itemId: "universe_matrix", amount: 20 }], requiredTechId: "stellar_exploration", prerequisiteSystemId: "white_dwarf",
  },
};


export const STAR_SYSTEM_LIST = Object.values(STAR_SYSTEMS);

// ---------------------------------------------------------------------------
// 程序化星系生成（拓展存档：星系个数 8~32）
// ---------------------------------------------------------------------------

/** 星系 ID 与名称表：保证星系名独一无二。前 8 项对应静态目录（迁移自原
 *  STAR_SYSTEMS），其余供程序化生成按表序取用（不可重复）。 */
export const STAR_SYSTEM_NAME_TABLE: Readonly<Record<string, string>> = {
  helios: "赫利俄斯",
  borealis: "北冕座",
  aurora: "曙光庭",
  ember: "余烬座",
  sirius: "天狼工域",
  white_dwarf: "苍白余烬",
  neutron: "赫卡忒",
  blue_giant: "蔚蓝王座",
  verdant_gate: "翡翠之门",
  azure_corridor: "苍蓝回廊",
  ember_whisper: "烬色低语",
  frost_throne: "霜结王座",
  gilded_dune: "曜金荒漠",
  sunken_star_sea: "沉星之海",
  tempest_dome: "雷暴穹顶",
  polar_night: "白夜冰川",
  crimson_basin: "绯红沙海",
  quiet_belt: "静谧环带",
  magnetic_eye: "磁暴眼",
  glazed_vault: "琉璃天穹",
  ash_corridor: "灰烬走廊",
  tidal_yard: "潮汐墓场",
  gilt_steppe: "鎏金草原",
  eclipse_echo: "蚀月回响",
  deep_blue_end: "深蓝尽头",
  flint_waste: "燧石荒原",
  molten_ring: "融光之环",
  mist_route: "雾锁航路",
  crystal_sanctum: "晶簇圣所",
  backlight_strait: "逆光海峡",
  shard_grave: "碎星坟场",
  dawn_beacon: "晨曦界碑",
};

export interface StarSystemType {
  /** 迁移来源星系（code 即类型名，如“冰晶恒星系”）。 */
  originSystemId: StarSystemId;
  starType: string;
  starClassId: StarClassId;
  color: string;
  /** 恒星表现四维（0~1）：温度 / 重力 / 荒度 / 生态。 */
  temperature: number;
  gravity: number;
  wildness: number;
  organism: number;
  /** 行星环数量上限（实际环数 ∈ [max-2, max]）。 */
  maxRings: number;
  /** 大型行星数量上限（实际数量 ∈ [max-2, max]，且 ≤ 环数 - 2）。 */
  maxLargePlanets: number;
  /** 初始距离取值范围（ly），乘算距离系数前的基础值。 */
  distanceLyRange: [number, number];
  explorationCost: ItemAmount[];
  description: string;
}

/** 星系类型表（键 = 原目录 code，迁移自原 8 星系）。 */
export const STAR_SYSTEM_TYPES: Readonly<Record<string, StarSystemType>> = {
  "G 型主序星": { originSystemId: "helios", starType: "G 型主序星", starClassId: "g_main", color: "#e1b452", temperature: 0.55, gravity: 0.5, wildness: 0.4, organism: 0.7, maxRings: 4, maxLargePlanets: 2, distanceLyRange: [5, 12], explorationCost: [], description: "温和的黄色主序星，行星生态均衡，适合作为新工业带的起点。" },
  "冰晶恒星系": { originSystemId: "borealis", starType: "K 型橙矮星", starClassId: "k_dwarf", color: "#79aeb9", temperature: 0.2, gravity: 0.5, wildness: 0.3, organism: 0.4, maxRings: 4, maxLargePlanets: 2, distanceLyRange: [6, 14], explorationCost: [{ itemId: "space_warper", amount: 2 }, { itemId: "information_matrix", amount: 10 }], description: "低温恒星保存了天然微观结构，是可燃冰与高阶晶体的主产区。" },
  "F 型星系": { originSystemId: "aurora", starType: "F 型主序星", starClassId: "f_main", color: "#e8d99b", temperature: 0.7, gravity: 0.45, wildness: 0.5, organism: 0.65, maxRings: 5, maxLargePlanets: 2, distanceLyRange: [10, 20], explorationCost: [{ itemId: "space_warper", amount: 3 }, { itemId: "information_matrix", amount: 20 }], description: "高光照星区，海洋与草原生态适合太阳能与综合制造基地。" },
  "红矮星系": { originSystemId: "ember", starType: "M 型红矮星", starClassId: "m_dwarf", color: "#c76c56", temperature: 0.3, gravity: 0.6, wildness: 0.25, organism: 0.3, maxRings: 4, maxLargePlanets: 2, distanceLyRange: [14, 24], explorationCost: [{ itemId: "space_warper", amount: 4 }, { itemId: "gravity_matrix", amount: 10 }], description: "低亮度红矮星周围聚集着矿物丰厚的荒漠与火山世界。" },
  "A 型星系": { originSystemId: "sirius", starType: "A 型主序星", starClassId: "a_main", color: "#dbe8ff", temperature: 0.85, gravity: 0.5, wildness: 0.45, organism: 0.5, maxRings: 5, maxLargePlanets: 3, distanceLyRange: [18, 28], explorationCost: [{ itemId: "space_warper", amount: 6 }, { itemId: "gravity_matrix", amount: 20 }], description: "强光恒星与富硅晶体行星组成的高能工业区，戴森工程收益显著。" },
  "白矮星系": { originSystemId: "white_dwarf", starType: "白矮星", starClassId: "white_dwarf", color: "#d9e4ef", temperature: 0.4, gravity: 0.8, wildness: 0.2, organism: 0.2, maxRings: 3, maxLargePlanets: 2, distanceLyRange: [16, 26], explorationCost: [{ itemId: "space_warper", amount: 8 }, { itemId: "universe_matrix", amount: 5 }], description: "致密恒星周围保留盐湖、黑曜火山和冰巨星，适合星际中转。" },
  "中子星系": { originSystemId: "neutron", starType: "中子星", starClassId: "neutron_star", color: "#a88ec5", temperature: 0.35, gravity: 0.95, wildness: 0.15, organism: 0.15, maxRings: 3, maxLargePlanets: 1, distanceLyRange: [12, 22], explorationCost: [{ itemId: "space_warper", amount: 5 }, { itemId: "gravity_matrix", amount: 20 }], description: "极端磁场重塑行星矿层，可持续开采极为稀有的单极磁石。" },
  "O 型蓝巨星": { originSystemId: "blue_giant", starType: "O 型蓝巨星", starClassId: "o_blue_giant", color: "#6fa8ff", temperature: 0.95, gravity: 0.7, wildness: 0.55, organism: 0.35, maxRings: 6, maxLargePlanets: 3, distanceLyRange: [24, 34], explorationCost: [{ itemId: "space_warper", amount: 12 }, { itemId: "universe_matrix", amount: 20 }], description: "遥远而极亮的终局星区，戴森结构回报极高，殖民成本同样惊人。" },
};

export interface PlanetType {
  /** 迁移来源行星（ID 即类型键，如 frost）。 */
  originPlanetId: PlanetId;
  name: string;
  /** 是否大型行星（气态巨星一类，带子环）。 */
  large: boolean;
  /** 大型行星的行星环（子环）数量。 */
  largeRings: number;
  color: string;
  code: string;
  environment: string;
  /** 生态模板：决定海洋、倍率、殖民成本、勘探时长等基础面。 */
  templateId: PlanetTemplateId;
  /** 各资源出现概率（0~1）；稀有资源走模板的 rareResourcePool 按种子抽选。 */
  resources: Partial<Record<ItemId, number>>;
  /** 依附星系数值范围（四维各一个区间，与星系类型四维匹配）。 */
  affinity: { temperature: [number, number]; gravity: [number, number]; wildness: [number, number]; organism: [number, number] };
}

const dim = (value: number): [number, number] => [Math.max(0, value - 0.3), Math.min(1, value + 0.3)];
const ORIGIN_DIMENSIONS: Record<string, { temperature: number; gravity: number; wildness: number; organism: number }> = {
  helios: { temperature: 0.55, gravity: 0.5, wildness: 0.4, organism: 0.7 },
  borealis: { temperature: 0.2, gravity: 0.5, wildness: 0.3, organism: 0.4 },
  aurora: { temperature: 0.7, gravity: 0.45, wildness: 0.5, organism: 0.65 },
  ember: { temperature: 0.3, gravity: 0.6, wildness: 0.25, organism: 0.3 },
  sirius: { temperature: 0.85, gravity: 0.5, wildness: 0.45, organism: 0.5 },
  white_dwarf: { temperature: 0.4, gravity: 0.8, wildness: 0.2, organism: 0.2 },
  neutron: { temperature: 0.35, gravity: 0.95, wildness: 0.15, organism: 0.15 },
  blue_giant: { temperature: 0.95, gravity: 0.7, wildness: 0.55, organism: 0.35 },
};
const affinityOf = (originSystemId: string): PlanetType["affinity"] => {
  const dims = ORIGIN_DIMENSIONS[originSystemId];
  return { temperature: dim(dims.temperature), gravity: dim(dims.gravity), wildness: dim(dims.wildness), organism: dim(dims.organism) };
};
const common = (ids: ItemId[]): Partial<Record<ItemId, number>> => Object.fromEntries(ids.map((id) => [id, 0.82]));
const hydrogenYield = { hydrogen: 0.8, deuterium: 0.45 } as const;

/** 星球类型表（键 = 原行星 ID，迁移自原 22 颗行星；大型行星即气态巨星一类）。 */
export const PLANET_TYPES: Readonly<Record<string, PlanetType>> = {
  home: { originPlanetId: "home", name: "澄海型", large: false, largeRings: 0, color: "#61b2aa", code: "母星", environment: "海洋型行星", templateId: "oceanic", resources: common(["iron_ore", "copper_ore", "stone", "coal", "crude_oil", "water"]), affinity: affinityOf("helios") },
  ashen: { originPlanetId: "ashen", name: "烬原型", large: false, largeRings: 0, color: "#d8794d", code: "熔岩星", environment: "熔岩型行星", templateId: "lava", resources: common(["iron_ore", "copper_ore", "stone", "coal", "silicon_ore", "titanium_ore", "sulfuric_acid"]), affinity: affinityOf("helios") },
  giant: { originPlanetId: "giant", name: "苍岚型", large: true, largeRings: 2, color: "#75a9bd", code: "气态巨星", environment: "冰气态巨星", templateId: "ice_giant", resources: {}, affinity: affinityOf("helios") },
  frost: { originPlanetId: "frost", name: "霜原型", large: false, largeRings: 0, color: "#91b8c4", code: "冰原星", environment: "永冻冰原行星", templateId: "ice_field", resources: common(["iron_ore", "copper_ore", "titanium_ore", "silicon_ore", "fire_ice"]), affinity: affinityOf("borealis") },
  boreal_giant: { originPlanetId: "boreal_giant", name: "青冥型", large: true, largeRings: 2, color: "#6b94ad", code: "冰巨星", environment: "富可燃冰气态巨星", templateId: "fire_ice_giant", resources: {}, affinity: affinityOf("borealis") },
  magnetar: { originPlanetId: "magnetar", name: "极夜型", large: false, largeRings: 0, color: "#a48ac2", code: "磁暴星", environment: "中子星潮汐锁定行星", templateId: "tidal_locked", resources: common(["iron_ore", "copper_ore", "titanium_ore", "silicon_ore"]), affinity: affinityOf("neutron") },
  verdant: { originPlanetId: "verdant", name: "翠环型", large: false, largeRings: 0, color: "#72aa78", code: "绿洲星", environment: "草原与浅海行星", templateId: "prairie", resources: common(["iron_ore", "copper_ore", "stone", "coal", "water"]), affinity: affinityOf("aurora") },
  pelagic: { originPlanetId: "pelagic", name: "澜渊型", large: false, largeRings: 0, color: "#4d9fb4", code: "深海星", environment: "深海群岛行星", templateId: "mediterranean", resources: common(["iron_ore", "copper_ore", "stone", "coal", "crude_oil", "water"]), affinity: affinityOf("aurora") },
  aurora_giant: { originPlanetId: "aurora_giant", name: "天穹型", large: true, largeRings: 2, color: "#8fa9cf", code: "氢巨星", environment: "高氢气态巨星", templateId: "hydrogen_giant", resources: {}, affinity: affinityOf("aurora") },
  dune: { originPlanetId: "dune", name: "赤砂型", large: false, largeRings: 0, color: "#c7965d", code: "荒漠星", environment: "干旱沙漠行星", templateId: "desert", resources: common(["iron_ore", "copper_ore", "stone", "coal", "silicon_ore", "titanium_ore"]), affinity: affinityOf("ember") },
  cinder: { originPlanetId: "cinder", name: "灰烬型", large: false, largeRings: 0, color: "#a9634f", code: "火山灰星", environment: "火山灰与熔岩行星", templateId: "volcanic_ash", resources: common(["iron_ore", "copper_ore", "stone", "coal", "silicon_ore", "titanium_ore"]), affinity: affinityOf("ember") },
  ember_giant: { originPlanetId: "ember_giant", name: "红飓型", large: true, largeRings: 1, color: "#b87964", code: "气态巨星", environment: "高温气态巨星", templateId: "gas_giant", resources: {}, affinity: affinityOf("ember") },
  crystal: { originPlanetId: "crystal", name: "晶穹型", large: false, largeRings: 0, color: "#9ac4c6", code: "晶漠星", environment: "硅晶荒漠行星", templateId: "crystal_desert", resources: common(["iron_ore", "copper_ore", "stone", "silicon_ore", "titanium_ore"]), affinity: affinityOf("sirius") },
  prairie: { originPlanetId: "prairie", name: "牧云型", large: false, largeRings: 0, color: "#89aa67", code: "草原星", environment: "风暴草原行星", templateId: "savanna", resources: common(["iron_ore", "copper_ore", "stone", "coal", "titanium_ore", "water"]), affinity: affinityOf("sirius") },
  sirius_giant: { originPlanetId: "sirius_giant", name: "银冠型", large: true, largeRings: 2, color: "#7ba8c5", code: "冰巨星", environment: "明亮冰巨星", templateId: "ice_giant", resources: {}, affinity: affinityOf("sirius") },
  salt: { originPlanetId: "salt", name: "白盐型", large: false, largeRings: 0, color: "#c5bf9a", code: "盐湖星", environment: "盐湖与干海盆行星", templateId: "salt_lake", resources: common(["iron_ore", "copper_ore", "stone", "silicon_ore", "titanium_ore"]), affinity: affinityOf("white_dwarf") },
  obsidian: { originPlanetId: "obsidian", name: "黑曜型", large: false, largeRings: 0, color: "#746b75", code: "黑曜星", environment: "黑曜火山行星", templateId: "volcanic_ash", resources: common(["iron_ore", "copper_ore", "stone", "coal", "silicon_ore", "titanium_ore"]), affinity: affinityOf("white_dwarf") },
  white_giant: { originPlanetId: "white_giant", name: "苍白型", large: true, largeRings: 2, color: "#a7bfd0", code: "冰巨星", environment: "低温冰巨星", templateId: "fire_ice_giant", resources: {}, affinity: affinityOf("white_dwarf") },
  tempest: { originPlanetId: "tempest", name: "风暴型", large: false, largeRings: 0, color: "#5f9d91", code: "飓风星", environment: "高风速海陆行星", templateId: "savanna", resources: common(["iron_ore", "copper_ore", "stone", "coal", "titanium_ore", "water"]), affinity: affinityOf("blue_giant") },
  inferno: { originPlanetId: "inferno", name: "炽核型", large: false, largeRings: 0, color: "#d65f43", code: "熔岩星", environment: "超高热熔岩行星", templateId: "lava", resources: common(["iron_ore", "copper_ore", "stone", "coal", "silicon_ore", "titanium_ore"]), affinity: affinityOf("blue_giant") },
  abyss: { originPlanetId: "abyss", name: "幽冥型", large: false, largeRings: 0, color: "#66778f", code: "永夜星", environment: "潮汐锁定永夜行星", templateId: "tidal_locked", resources: common(["iron_ore", "copper_ore", "stone", "silicon_ore", "titanium_ore"]), affinity: affinityOf("blue_giant") },
  azure_giant: { originPlanetId: "azure_giant", name: "蓝穹型", large: true, largeRings: 3, color: "#5e83bd", code: "蓝巨星行星", environment: "高能气态巨星", templateId: "hydrogen_giant", resources: {}, affinity: affinityOf("blue_giant") },
};

export const PLANET_TYPE_KEYS = Object.keys(PLANET_TYPES);
export const LARGE_PLANET_TYPE_KEYS = PLANET_TYPE_KEYS.filter((key) => PLANET_TYPES[key].large);
export const SMALL_PLANET_TYPE_KEYS = PLANET_TYPE_KEYS.filter((key) => !PLANET_TYPES[key].large);
export const ORBITAL_YIELD_FALLBACK: Partial<Record<ItemId, number>> = { ...hydrogenYield };

/** 星球类型对星系四维的匹配度：落在依附范围内的维数（0~4，越大越契合）。 */
export function planetTypeAffinityFit(type: PlanetType, system: { temperature: number; gravity: number; wildness: number; organism: number }): number {
  const fits = [
    system.temperature >= type.affinity.temperature[0] && system.temperature <= type.affinity.temperature[1],
    system.gravity >= type.affinity.gravity[0] && system.gravity <= type.affinity.gravity[1],
    system.wildness >= type.affinity.wildness[0] && system.wildness <= type.affinity.wildness[1],
    system.organism >= type.affinity.organism[0] && system.organism <= type.affinity.organism[1],
  ];
  return fits.filter(Boolean).length;
}
