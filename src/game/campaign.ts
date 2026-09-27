import {
  BUILDINGS,
  ITEMS,
  PLANET_LIST,
  RECIPES,
  STAR_SYSTEMS,
  getBuilding,
  getConstructionDefinition,
  getPlanet,
  getTechnology,
} from "./content";
import { isStarSystemIncluded } from "./galaxy";
import type {
  CampaignChapterId,
  CampaignState,
  CampaignTaskId,
  ConstructionId,
  GameState,
  ItemAmount,
  ItemId,
  BuildingId,
  PlanetId,
  RecipeId,
  StarSystemId,
  TechId,
} from "./types";

export type CampaignTaskTrack = "main" | "side";

export type CampaignNavigation =
  | { kind: "recipe"; itemId: ItemId }
  | { kind: "technology"; techId: TechId }
  | { kind: "building"; buildingId: BuildingId }
  | { kind: "construction"; constructionId: ConstructionId }
  | { kind: "planet"; planetId: PlanetId }
  | { kind: "system"; systemId: StarSystemId }
  | { kind: "dyson"; systemId?: StarSystemId }
  | { kind: "galactic" };

export interface CampaignReward {
  constructionId?: ConstructionId;
  itemId?: ItemId;
  amount: number;
}

type CampaignMetric =
  | { kind: "manual-mined"; target: number }
  | { kind: "produced"; itemId: ItemId; target: number }
  | { kind: "building"; buildingId: BuildingId; target: number }
  | { kind: "miner"; target: number }
  | { kind: "belt"; target: number; minimumTier?: number }
  | { kind: "research"; techId: TechId }
  | { kind: "exploration"; systemId: StarSystemId }
  | { kind: "station-trips"; buildingId: "planetary_logistics_station" | "interstellar_logistics_station"; target: number }
  | { kind: "dyson"; measure: "sails" | "rockets" | "structure" | "shell"; target: number }
  | { kind: "power"; target: number }
  | { kind: "rare-resource"; target: number }
  | { kind: "spray-coater"; target: number }
  | { kind: "blueprint"; target: number }
  | { kind: "infinite-research"; target: number }
  | { kind: "exported"; target: number }
  | { kind: "galactic-score"; target: number }
  | { kind: "endgame-mastery"; target: number };

export interface CampaignTaskDefinition {
  id: CampaignTaskId;
  chapterId: CampaignChapterId;
  track: CampaignTaskTrack;
  title: string;
  description: string;
  metric: CampaignMetric;
  prerequisites?: CampaignTaskId[];
  navigation?: CampaignNavigation;
  requirements?: ItemAmount[];
  rewards?: CampaignReward[];
}

export interface CampaignChapterDefinition {
  id: CampaignChapterId;
  name: string;
  summary: string;
  taskIds: CampaignTaskId[];
}

export interface CampaignTaskProgress {
  current: number;
  target: number;
  complete: boolean;
}

export type CampaignTaskStatus = "locked" | "available" | "active" | "complete";

export interface CampaignTaskView extends CampaignTaskDefinition {
  status: CampaignTaskStatus;
  progress: CampaignTaskProgress;
  requirements: ItemAmount[];
}

export interface CampaignChapterView extends CampaignChapterDefinition {
  complete: boolean;
  completedCount: number;
  tasks: CampaignTaskView[];
}

export interface CampaignSnapshot {
  chapters: CampaignChapterView[];
  activeTask: CampaignTaskView | null;
  completedCount: number;
  totalCount: number;
}

export const CAMPAIGN_CHAPTERS: CampaignChapterDefinition[] = [
  { id: "foundation", name: "母星点火", summary: "从第一块矿石开始，建立可持续的基础工业。", taskIds: ["mine_first_ore", "smelt_iron", "deploy_miner", "side_storage"] },
  { id: "blue_matrix", name: "蓝色矩阵", summary: "让采集、熔炼和科研第一次连成网络。", taskIds: ["lay_first_belt", "deploy_matrix_lab", "produce_blue_matrix"] },
  { id: "red_matrix", name: "石油红糖", summary: "打通原油、精炼、塑料与能源矩阵链。", taskIds: ["refine_oil", "produce_plastic", "produce_red_matrix", "side_stable_power"] },
  { id: "planetary_logistics", name: "行星物流", summary: "用无人机把分散的生产节点接入同一网络。", taskIds: ["deploy_planetary_station", "complete_planetary_trip", "produce_structure_matrix", "side_belt_upgrade"] },
  { id: "interstellar_logistics", name: "群星工业", summary: "离开母星，把生产网络扩展到新的恒星系。", taskIds: ["unlock_borealis", "deploy_interstellar_station", "complete_interstellar_trip", "side_rare_resource"] },
  { id: "matrix_mastery", name: "矩阵全谱", summary: "完成高阶矩阵生产，为终局工程提供算力。", taskIds: ["produce_information_matrix", "produce_gravity_matrix", "produce_universe_matrix", "side_spray_coater"] },
  { id: "dyson_program", name: "戴森计划", summary: "发射太阳帆与运载火箭，点亮恒星工程。", taskIds: ["launch_solar_sail", "launch_carrier_rocket", "build_dyson_structure", "absorb_shell_sail", "side_blueprint"] },
  { id: "galactic_endgame", name: "银河终局", summary: "把戴森球的算力转化为无限科研、银河出口与长期挂机目标。", taskIds: ["endgame_infinite_research", "endgame_export", "endgame_score", "endgame_mastery"] },
];

export const CAMPAIGN_TASKS: CampaignTaskDefinition[] = [
  {
    id: "mine_first_ore", chapterId: "foundation", track: "main", title: "采集第一份矿石", description: "亲手采集一份固体矿物，确认这颗星球可以成为工业基地。",
    metric: { kind: "manual-mined", target: 1 }, navigation: { kind: "recipe", itemId: "iron_ore" }, rewards: [{ constructionId: "conveyor_belt_mk1", amount: 2 }],
  },
  {
    id: "smelt_iron", chapterId: "foundation", track: "main", title: "铸造基础铁块", description: "生产 4 个铁块，为后续设备制造准备材料。",
    metric: { kind: "produced", itemId: "iron_ingot", target: 4 }, navigation: { kind: "recipe", itemId: "iron_ingot" }, requirements: [{ itemId: "iron_ore", amount: 4 }], rewards: [{ constructionId: "assembling_machine_mk1", amount: 1 }],
  },
  {
    id: "deploy_miner", chapterId: "foundation", track: "main", title: "部署第一台采矿机", description: "让矿脉从手工采集转入自动生产。",
    metric: { kind: "miner", target: 1 }, navigation: { kind: "building", buildingId: "mining_machine" }, rewards: [{ constructionId: "conveyor_belt_mk1", amount: 4 }],
  },
  {
    id: "lay_first_belt", chapterId: "blue_matrix", track: "main", title: "铺设第一条传送带", description: "把矿脉和加工设备连成一条真正的生产线。",
    metric: { kind: "belt", target: 1 }, prerequisites: ["deploy_miner"], navigation: { kind: "construction", constructionId: "conveyor_belt_mk1" }, rewards: [{ constructionId: "storage_mk1", amount: 1 }],
  },
  {
    id: "deploy_matrix_lab", chapterId: "blue_matrix", track: "main", title: "部署矩阵研究站", description: "建造研究站，为第一项科技提供稳定的科研入口。",
    metric: { kind: "building", buildingId: "matrix_lab", target: 1 }, prerequisites: ["lay_first_belt"], navigation: { kind: "building", buildingId: "matrix_lab" }, rewards: [{ constructionId: "matrix_lab", amount: 1 }],
  },
  {
    id: "produce_blue_matrix", chapterId: "blue_matrix", track: "main", title: "产出电磁矩阵", description: "完成第一份蓝色矩阵，正式启动科技树。",
    metric: { kind: "produced", itemId: "electromagnetic_matrix", target: 1 }, prerequisites: ["deploy_matrix_lab"], navigation: { kind: "recipe", itemId: "electromagnetic_matrix" }, requirements: [{ itemId: "iron_ingot", amount: 1 }, { itemId: "copper_ingot", amount: 1 }, { itemId: "magnetic_coil", amount: 1 }], rewards: [{ constructionId: "arc_smelter", amount: 1 }],
  },
  {
    id: "refine_oil", chapterId: "red_matrix", track: "main", title: "启动原油精炼", description: "将原油转化为精炼油，打开化工生产链。",
    metric: { kind: "produced", itemId: "refined_oil", target: 1 }, prerequisites: ["produce_blue_matrix"], navigation: { kind: "recipe", itemId: "refined_oil" }, requirements: [{ itemId: "crude_oil", amount: 2 }], rewards: [{ constructionId: "oil_refinery", amount: 1 }],
  },
  {
    id: "produce_plastic", chapterId: "red_matrix", track: "main", title: "合成塑料", description: "用精炼油和高能石墨制作第一批高分子材料。",
    metric: { kind: "produced", itemId: "plastic", target: 1 }, prerequisites: ["refine_oil"], navigation: { kind: "recipe", itemId: "plastic" }, requirements: [{ itemId: "refined_oil", amount: 2 }, { itemId: "energetic_graphite", amount: 1 }], rewards: [{ constructionId: "chemical_plant", amount: 1 }],
  },
  {
    id: "produce_red_matrix", chapterId: "red_matrix", track: "main", title: "产出能量矩阵", description: "完成红色矩阵生产，建立能源与化工的闭环。",
    metric: { kind: "produced", itemId: "energy_matrix", target: 1 }, prerequisites: ["produce_plastic"], navigation: { kind: "recipe", itemId: "energy_matrix" }, requirements: [{ itemId: "energetic_graphite", amount: 2 }, { itemId: "hydrogen", amount: 2 }], rewards: [{ constructionId: "matrix_lab", amount: 1 }],
  },
  {
    id: "deploy_planetary_station", chapterId: "planetary_logistics", track: "main", title: "部署行星物流站", description: "在同一颗星球上建立供需节点，让无人机接管运输。",
    metric: { kind: "building", buildingId: "planetary_logistics_station", target: 1 }, prerequisites: ["produce_red_matrix"], navigation: { kind: "building", buildingId: "planetary_logistics_station" }, rewards: [{ itemId: "logistics_drone", amount: 2 }],
  },
  {
    id: "complete_planetary_trip", chapterId: "planetary_logistics", track: "main", title: "完成首次行星配送", description: "让一趟行星物流运输真正完成。",
    metric: { kind: "station-trips", buildingId: "planetary_logistics_station", target: 1 }, prerequisites: ["deploy_planetary_station"], navigation: { kind: "building", buildingId: "planetary_logistics_station" }, requirements: [{ itemId: "logistics_drone", amount: 1 }], rewards: [{ itemId: "logistics_vessel", amount: 1 }],
  },
  {
    id: "produce_structure_matrix", chapterId: "planetary_logistics", track: "main", title: "产出结构矩阵", description: "把钛与晶体加工成结构矩阵，为星际物流铺路。",
    metric: { kind: "produced", itemId: "structure_matrix", target: 1 }, prerequisites: ["complete_planetary_trip"], navigation: { kind: "recipe", itemId: "structure_matrix" }, requirements: [{ itemId: "titanium_crystal", amount: 1 }, { itemId: "diamond", amount: 1 }], rewards: [{ constructionId: "interstellar_logistics_station", amount: 1 }],
  },
  {
    id: "unlock_borealis", chapterId: "interstellar_logistics", track: "main", title: "解锁下一恒星系", description: "完成一次恒星勘探，获得跨星系工业的落脚点。",
    metric: { kind: "exploration", systemId: "borealis" }, prerequisites: ["produce_structure_matrix"], navigation: { kind: "system", systemId: "borealis" }, requirements: [{ itemId: "space_warper", amount: 1 }], rewards: [{ itemId: "space_warper", amount: 1 }],
  },
  {
    id: "deploy_interstellar_station", chapterId: "interstellar_logistics", track: "main", title: "部署星际物流站", description: "把物流站扩展到跨恒星运输规格。",
    metric: { kind: "building", buildingId: "interstellar_logistics_station", target: 1 }, prerequisites: ["unlock_borealis"], navigation: { kind: "building", buildingId: "interstellar_logistics_station" }, rewards: [{ itemId: "logistics_vessel", amount: 2 }],
  },
  {
    id: "complete_interstellar_trip", chapterId: "interstellar_logistics", track: "main", title: "完成首次星际运输", description: "完成一趟跨恒星物流航次。",
    metric: { kind: "station-trips", buildingId: "interstellar_logistics_station", target: 1 }, prerequisites: ["deploy_interstellar_station"], navigation: { kind: "building", buildingId: "interstellar_logistics_station" }, requirements: [{ itemId: "logistics_vessel", amount: 1 }, { itemId: "space_warper", amount: 1 }], rewards: [{ constructionId: "orbital_collector", amount: 1 }],
  },
  {
    id: "produce_information_matrix", chapterId: "matrix_mastery", track: "main", title: "产出信息矩阵", description: "建立高阶信息生产线，解锁终局科研的中段。",
    metric: { kind: "produced", itemId: "information_matrix", target: 1 }, prerequisites: ["complete_interstellar_trip"], navigation: { kind: "recipe", itemId: "information_matrix" }, requirements: [{ itemId: "particle_broadband", amount: 1 }, { itemId: "processor", amount: 1 }], rewards: [{ constructionId: "miniature_particle_collider", amount: 1 }],
  },
  {
    id: "produce_gravity_matrix", chapterId: "matrix_mastery", track: "main", title: "产出引力矩阵", description: "跨过粒子物理门槛，制造引力矩阵。",
    metric: { kind: "produced", itemId: "gravity_matrix", target: 1 }, prerequisites: ["produce_information_matrix"], navigation: { kind: "recipe", itemId: "gravity_matrix" }, requirements: [{ itemId: "graviton_lens", amount: 1 }, { itemId: "quantum_chip", amount: 1 }], rewards: [{ constructionId: "em_rail_ejector", amount: 1 }],
  },
  {
    id: "produce_universe_matrix", chapterId: "matrix_mastery", track: "main", title: "产出宇宙矩阵", description: "完成六色矩阵闭环，准备恒星级工程。",
    metric: { kind: "produced", itemId: "universe_matrix", target: 1 }, prerequisites: ["produce_gravity_matrix"], navigation: { kind: "recipe", itemId: "universe_matrix" }, requirements: [{ itemId: "antimatter", amount: 1 }, { itemId: "quantum_chip", amount: 1 }], rewards: [{ constructionId: "vertical_launching_silo", amount: 1 }],
  },
  {
    id: "launch_solar_sail", chapterId: "dyson_program", track: "main", title: "发射第一片太阳帆", description: "把太阳帆送入恒星轨道，开启戴森云。",
    metric: { kind: "dyson", measure: "sails", target: 1 }, prerequisites: ["produce_universe_matrix"], navigation: { kind: "recipe", itemId: "solar_sail" }, requirements: [{ itemId: "solar_sail", amount: 1 }], rewards: [{ constructionId: "ray_receiver", amount: 1 }],
  },
  {
    id: "launch_carrier_rocket", chapterId: "dyson_program", track: "main", title: "发射第一枚运载火箭", description: "用运载火箭把戴森球骨架送上轨道。",
    metric: { kind: "dyson", measure: "rockets", target: 1 }, prerequisites: ["launch_solar_sail"], navigation: { kind: "recipe", itemId: "small_carrier_rocket" }, requirements: [{ itemId: "small_carrier_rocket", amount: 1 }], rewards: [{ constructionId: "vertical_launching_silo", amount: 1 }],
  },
  {
    id: "build_dyson_structure", chapterId: "dyson_program", track: "main", title: "完成第一个结构点", description: "让戴森球从规划图变成真正的恒星结构。",
    metric: { kind: "dyson", measure: "structure", target: 1 }, prerequisites: ["launch_carrier_rocket"], navigation: { kind: "dyson", systemId: "helios" }, rewards: [{ constructionId: "artificial_star", amount: 1 }],
  },
  {
    id: "absorb_shell_sail", chapterId: "dyson_program", track: "main", title: "形成首片永久壳面", description: "将太阳帆吸附到框架，完成戴森球的第一片壳面。",
    metric: { kind: "dyson", measure: "shell", target: 1 }, prerequisites: ["build_dyson_structure"], navigation: { kind: "dyson", systemId: "helios" },
  },
  {
    id: "side_storage", chapterId: "foundation", track: "side", title: "建立物流缓存", description: "部署一座仓储设施，减少生产线的手动搬运。",
    metric: { kind: "building", buildingId: "storage_mk1", target: 1 }, navigation: { kind: "building", buildingId: "storage_mk1" }, rewards: [{ constructionId: "conveyor_belt_mk1", amount: 2 }],
  },
  {
    id: "side_stable_power", chapterId: "red_matrix", track: "side", title: "稳定火力电网", description: "让一座有负载的工厂获得完整供电。",
    metric: { kind: "power", target: 1 }, navigation: { kind: "building", buildingId: "thermal_power_plant" }, requirements: [{ itemId: "energetic_graphite", amount: 1 }], rewards: [{ constructionId: "thermal_power_plant", amount: 1 }],
  },
  {
    id: "side_belt_upgrade", chapterId: "planetary_logistics", track: "side", title: "升级高速运输线", description: "将至少一条传送带升级到 Mk.II。",
    metric: { kind: "belt", target: 1, minimumTier: 2 }, navigation: { kind: "construction", constructionId: "conveyor_belt_mk2" }, rewards: [{ constructionId: "conveyor_belt_mk2", amount: 4 }],
  },
  {
    id: "side_rare_resource", chapterId: "interstellar_logistics", track: "side", title: "采集稀有资源", description: "取得一种来自异星环境的稀有资源。",
    metric: { kind: "rare-resource", target: 1 }, navigation: { kind: "planet", planetId: "frost" }, rewards: [{ itemId: "space_warper", amount: 1 }],
  },
  {
    id: "side_spray_coater", chapterId: "matrix_mastery", track: "side", title: "安装首台喷涂机", description: "给生产设备装上喷涂模块，体验增产与加速模式。",
    metric: { kind: "spray-coater", target: 1 }, navigation: { kind: "building", buildingId: "spray_coater" }, rewards: [{ itemId: "proliferator_mk1", amount: 10 }],
  },
  {
    id: "side_blueprint", chapterId: "dyson_program", track: "side", title: "保存第一张蓝图", description: "把一段可复用的生产布局保存下来。",
    metric: { kind: "blueprint", target: 1 },
  },
  {
    id: "endgame_infinite_research", chapterId: "galactic_endgame", track: "main", title: "启动无限科研", description: "完成第一轮无限科技，把宇宙矩阵变成可持续的工业增幅。",
    metric: { kind: "infinite-research", target: 1 }, prerequisites: ["absorb_shell_sail"], navigation: { kind: "galactic" }, requirements: [{ itemId: "universe_matrix", amount: 250 }],
  },
  {
    id: "endgame_export", chapterId: "galactic_endgame", track: "main", title: "完成银河出口", description: "向银河项目交付第一批终局物资，建立长期信用来源。",
    metric: { kind: "exported", target: 100 }, prerequisites: ["endgame_infinite_research"], navigation: { kind: "galactic" },
  },
  {
    id: "endgame_score", chapterId: "galactic_endgame", track: "main", title: "达到银河级评分", description: "通过无限科研与出口项目积累 10,000 点银河评分。",
    metric: { kind: "galactic-score", target: 10_000 }, prerequisites: ["endgame_export"], navigation: { kind: "galactic" },
  },
  {
    id: "endgame_mastery", chapterId: "galactic_endgame", track: "main", title: "完成银河工业协议", description: "让四类出口项目都达到第 1 级，证明生产网络可以长期自运转。",
    metric: { kind: "endgame-mastery", target: 1 }, prerequisites: ["endgame_score"], navigation: { kind: "galactic" },
  },
];

const TASK_BY_ID = new Map(CAMPAIGN_TASKS.map((task) => [task.id, task]));
const CHAPTER_BY_ID = new Map(CAMPAIGN_CHAPTERS.map((chapter) => [chapter.id, chapter]));
const TASK_IDS = new Set<CampaignTaskId>(CAMPAIGN_TASKS.map((task) => task.id));

export function isCampaignTaskId(value: unknown): value is CampaignTaskId {
  return typeof value === "string" && TASK_IDS.has(value as CampaignTaskId);
}

export function isCampaignChapterId(value: unknown): value is CampaignChapterId {
  return typeof value === "string" && CHAPTER_BY_ID.has(value as CampaignChapterId);
}

export function normalizeCampaignState(value: unknown): CampaignState {
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const completedTaskIds = Array.isArray(saved.completedTaskIds)
    ? [...new Set(saved.completedTaskIds.filter(isCampaignTaskId))]
    : [];
  const rewardedTaskIds = Array.isArray(saved.rewardedTaskIds)
    ? [...new Set(saved.rewardedTaskIds.filter(isCampaignTaskId))]
    : [];
  const activeTaskId = isCampaignTaskId(saved.activeTaskId) ? saved.activeTaskId : null;
  const activeTask = activeTaskId ? TASK_BY_ID.get(activeTaskId) : undefined;
  const activeChapterId = isCampaignChapterId(saved.activeChapterId)
    ? saved.activeChapterId
    : activeTask?.chapterId ?? "foundation";
  return { activeChapterId, activeTaskId, completedTaskIds, rewardedTaskIds };
}

function metricValue(state: GameState, metric: CampaignMetric): number {
  switch (metric.kind) {
    case "manual-mined":
      return state.manualMined;
    case "produced":
      return state.totalProduced[metric.itemId] ?? 0;
    case "building":
      return state.entities.reduce((sum, entity) => {
        if (entity.buildingId !== metric.buildingId) return sum;
        return sum + Math.max(1, entity.machineCount || entity.minerCount || 0);
      }, 0);
    case "miner":
      return state.entities.reduce((sum, entity) => sum + entity.minerCount, 0);
    case "belt":
      return state.belts.filter((belt) => metric.minimumTier == null || belt.tier >= metric.minimumTier).length;
    case "research":
      return state.research.completedTechIds.includes(metric.techId) ? 1 : 0;
    case "exploration":
      // 星系个数生成选项：不在本存档星系清单中的恒星系，其勘探任务自动视为完成。
      if (!isStarSystemIncluded(state.galaxy, metric.systemId)) return 1;
      return state.exploration.unlockedSystemIds.includes(metric.systemId) ? 1 : 0;
    case "station-trips":
      return state.entities
        .filter((entity) => entity.buildingId === metric.buildingId)
        .reduce((sum, entity) => sum + (entity.stationTrips ?? 0), 0);
    case "dyson":
      if (metric.measure === "sails") return state.dysonSwarm.totalLaunched;
      if (metric.measure === "rockets") return state.dysonSphere.totalRocketsLaunched;
      if (metric.measure === "structure") return state.dysonSphere.structurePoints;
      return state.dysonSphere.totalSailsAbsorbed;
    case "power":
      return Object.values(state.planetMetrics).some((metrics) => metrics.demandKw > 0 && metrics.powerFactor >= 0.999) ? 1 : 0;
    case "rare-resource":
      return ["fire_ice", "kimberlite_ore", "fractal_silicon", "organic_crystal", "optical_grating_crystal", "spiniform_stalagmite_crystal", "unipolar_magnet"]
        .some((itemId) => (state.totalProduced[itemId as ItemId] ?? 0) >= 1) ? 1 : 0;
    case "spray-coater":
      return state.entities.some((entity) => entity.sprayCoaterInstalled) ? 1 : 0;
    case "blueprint":
      return state.blueprints.length;
    case "infinite-research":
      return Object.values(state.endgame?.infiniteResearch ?? {}).reduce((sum, progress) => sum + Math.max(0, Math.floor(progress.level)), 0);
    case "exported":
      return Math.max(0, Math.floor(state.endgame?.totalExported ?? 0));
    case "galactic-score":
      return Math.max(0, Math.floor(state.endgame?.galacticScore ?? 0));
    case "endgame-mastery":
      {
        const projects = Object.values(state.endgame?.exportProjects ?? {});
        return projects.length >= 4 && projects.every((project) => project.level >= 1) ? 1 : 0;
      }
  }
}

export function getCampaignTaskProgress(state: GameState, task: CampaignTaskDefinition): CampaignTaskProgress {
  const target = Math.max(1, "target" in task.metric ? task.metric.target : 1);
  const current = Math.max(0, Math.min(target, Math.floor(metricValue(state, task.metric))));
  return { current, target, complete: current >= target };
}

export function getCampaignTaskRequirements(task: CampaignTaskDefinition): ItemAmount[] {
  if (task.requirements) return task.requirements;
  if (task.navigation?.kind === "technology") return getTechnology(task.navigation.techId)?.costs ?? [];
  if (task.navigation?.kind === "recipe") {
    const itemId = task.navigation.itemId;
    const recipe = Object.values(RECIPES).find((candidate) => candidate.outputs.some((output) => output.itemId === itemId));
    return recipe?.inputs ?? [];
  }
  return [];
}

export function getNetworkItemStock(state: GameState, itemId: ItemId): number {
  const entityStock = state.entities.reduce((sum, entity) => sum + (entity.inputs[itemId] ?? 0) + (entity.outputs[itemId] ?? 0), 0);
  const trayStock = PLANET_LIST.reduce((sum, planet) => {
    const tray = planet.id === state.activePlanetId ? state.tray : state.planetTrays[planet.id];
    return sum + (tray?.[itemId] ?? 0);
  }, 0);
  const cargoStock = state.cargo?.itemId === itemId ? state.cargo.amount : 0;
  return Math.floor(entityStock + trayStock + cargoStock);
}

export function getCampaignTaskDeficits(state: GameState, task: CampaignTaskDefinition): ItemAmount[] {
  return getCampaignTaskRequirements(task).flatMap((requirement) => {
    const missing = Math.max(0, requirement.amount - getNetworkItemStock(state, requirement.itemId));
    return missing > 0 ? [{ itemId: requirement.itemId, amount: missing }] : [];
  });
}

function prerequisitesMet(completed: Set<CampaignTaskId>, task: CampaignTaskDefinition): boolean {
  return (task.prerequisites ?? []).every((id) => completed.has(id));
}

function cloneCampaignState(state: GameState): GameState {
  return {
    ...state,
    construction: { ...state.construction },
    tray: { ...state.tray },
    planetTrays: Object.fromEntries(Object.entries(state.planetTrays).map(([planetId, tray]) => [planetId, { ...tray }])) as GameState["planetTrays"],
    campaign: { ...normalizeCampaignState(state.campaign) },
  };
}

function canApplyRewards(state: GameState, rewards: CampaignReward[]): boolean {
  const itemTotals = new Map<ItemId, number>();
  for (const reward of rewards) {
    if (!reward.itemId || !(reward.itemId in ITEMS)) continue;
    itemTotals.set(reward.itemId, (itemTotals.get(reward.itemId) ?? 0) + Math.max(0, Math.floor(reward.amount)));
  }
  const rawLimit = state.planetTrayItemLimits?.[state.activePlanetId];
  const limit = Number.isFinite(rawLimit) ? Math.max(1_000, Math.min(100_000_000, Math.floor(rawLimit))) : 1_000_000;
  return [...itemTotals].every(([itemId, amount]) => Math.floor(state.tray[itemId] ?? 0) + amount <= limit);
}

function applyReward(state: GameState, reward: CampaignReward): void {
  if (reward.constructionId) {
    if (!getConstructionDefinition(reward.constructionId)) return;
    state.construction[reward.constructionId] = (state.construction[reward.constructionId] ?? 0) + Math.max(0, Math.floor(reward.amount));
  }
  if (reward.itemId) {
    if (!(reward.itemId in ITEMS)) return;
    const amount = Math.max(0, Math.floor(reward.amount));
    state.tray[reward.itemId] = (state.tray[reward.itemId] ?? 0) + amount;
    state.planetTrays[state.activePlanetId] = { ...state.tray };
  }
}

function firstPendingTask(completed: Set<CampaignTaskId>): CampaignTaskDefinition | undefined {
  const availableMain = CAMPAIGN_TASKS.find((task) => task.track === "main" && !completed.has(task.id) && prerequisitesMet(completed, task));
  if (availableMain) return availableMain;
  const availableSide = CAMPAIGN_TASKS.find((task) => task.track === "side" && !completed.has(task.id) && prerequisitesMet(completed, task));
  if (availableSide) return availableSide;
  return CAMPAIGN_TASKS.find((task) => !completed.has(task.id));
}

export function syncCampaignProgress(state: GameState, options: { grantRewards?: boolean } = {}): GameState {
  const grantRewards = options.grantRewards !== false;
  const campaign = normalizeCampaignState(state.campaign);
  const completed = new Set(campaign.completedTaskIds);
  const rewarded = new Set(campaign.rewardedTaskIds);
  let next: GameState | null = null;
  let changed = false;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const task of CAMPAIGN_TASKS) {
      if (completed.has(task.id)) {
        if (!rewarded.has(task.id)) {
          next ??= cloneCampaignState(state);
          const rewards = task.rewards ?? [];
          if (!grantRewards || canApplyRewards(next, rewards)) {
            if (grantRewards) for (const reward of rewards) applyReward(next, reward);
            rewarded.add(task.id);
            changed = true;
          }
        }
        continue;
      }
      if (!prerequisitesMet(completed, task) || !getCampaignTaskProgress(state, task).complete) continue;
      completed.add(task.id);
      progressed = true;
      changed = true;
      next ??= cloneCampaignState(state);
      const rewards = task.rewards ?? [];
      if (!grantRewards || canApplyRewards(next, rewards)) {
        if (grantRewards) for (const reward of rewards) applyReward(next, reward);
        rewarded.add(task.id);
      }
    }
  }
  const selectedTask = campaign.activeTaskId ? TASK_BY_ID.get(campaign.activeTaskId) : undefined;
  const pending = selectedTask && !completed.has(selectedTask.id) && prerequisitesMet(completed, selectedTask)
    ? selectedTask
    : firstPendingTask(completed);
  const activeTaskId = pending?.id ?? null;
  const activeChapterId = pending?.chapterId ?? campaign.activeChapterId;
  if (campaign.activeTaskId !== activeTaskId || campaign.activeChapterId !== activeChapterId ||
    campaign.completedTaskIds.length !== completed.size || campaign.rewardedTaskIds.length !== rewarded.size) {
    next ??= cloneCampaignState(state);
    changed = true;
  }
  if (!changed) return state;
  next!.campaign = {
    activeChapterId,
    activeTaskId,
    completedTaskIds: [...completed],
    rewardedTaskIds: [...rewarded],
  };
  return next!;
}

export function selectCampaignTask(state: GameState, taskId: CampaignTaskId): GameState {
  const task = TASK_BY_ID.get(taskId);
  if (!task || state.campaign.completedTaskIds.includes(taskId)) return state;
  const completed = new Set(state.campaign.completedTaskIds);
  if (!prerequisitesMet(completed, task)) return state;
  return {
    ...state,
    campaign: {
      ...state.campaign,
      activeChapterId: task.chapterId,
      activeTaskId: task.id,
    },
  };
}

function taskStatus(state: GameState, task: CampaignTaskDefinition): CampaignTaskStatus {
  if (state.campaign.completedTaskIds.includes(task.id) || getCampaignTaskProgress(state, task).complete && prerequisitesMet(new Set(state.campaign.completedTaskIds), task)) return "complete";
  if (!prerequisitesMet(new Set(state.campaign.completedTaskIds), task)) return "locked";
  return state.campaign.activeTaskId === task.id ? "active" : "available";
}

export function getCampaignSnapshot(state: GameState): CampaignSnapshot {
  const completed = new Set(state.campaign.completedTaskIds);
  const chapters = CAMPAIGN_CHAPTERS.map((chapter) => {
    const tasks = chapter.taskIds.flatMap((taskId) => {
      const task = TASK_BY_ID.get(taskId);
      if (!task) return [];
      return [{
        ...task,
        status: taskStatus(state, task),
        progress: getCampaignTaskProgress(state, task),
        requirements: getCampaignTaskRequirements(task),
      } satisfies CampaignTaskView];
    });
    return {
      ...chapter,
      complete: tasks.length > 0 && tasks.every((task) => task.status === "complete"),
      completedCount: tasks.filter((task) => task.status === "complete").length,
      tasks,
    } satisfies CampaignChapterView;
  });
  const allTasks = chapters.flatMap((chapter) => chapter.tasks);
  return {
    chapters,
    activeTask: allTasks.find((task) => task.id === state.campaign.activeTaskId) ?? allTasks.find((task) => task.status === "active") ?? null,
    completedCount: allTasks.filter((task) => task.status === "complete").length,
    totalCount: allTasks.length,
  };
}

export function getCampaignChapter(chapterId: CampaignChapterId): CampaignChapterDefinition | undefined {
  return CHAPTER_BY_ID.get(chapterId);
}

export function getCampaignTask(taskId: CampaignTaskId | undefined): CampaignTaskDefinition | undefined {
  return taskId ? TASK_BY_ID.get(taskId) : undefined;
}

export function getCampaignNavigationLabel(navigation: CampaignNavigation | undefined): string {
  if (!navigation) return "查看任务";
  if (navigation.kind === "recipe") return `查看${ITEMS[navigation.itemId].name}配方`;
  if (navigation.kind === "technology") return `查看${getTechnology(navigation.techId)?.name ?? "科技"}`;
  if (navigation.kind === "building" || navigation.kind === "construction") {
    const id = navigation.kind === "building" ? navigation.buildingId : navigation.constructionId;
    return `定位${(id in BUILDINGS ? getBuilding(id as BuildingId).name : getConstructionDefinition(id as ConstructionId)?.name) ?? "设备"}`;
  }
  if (navigation.kind === "planet") return `前往${getPlanet(navigation.planetId).name}`;
  if (navigation.kind === "system") return `打开${STAR_SYSTEMS[navigation.systemId].name}星图`;
  if (navigation.kind === "galactic") return "打开银河工业控制台";
  return "打开戴森球规划";
}

export function getCampaignTaskRequirementsForRecipe(task: CampaignTaskDefinition): RecipeId | null {
  if (task.navigation?.kind !== "recipe") return null;
  const itemId = task.navigation.itemId;
  const recipe = Object.values(RECIPES).find((candidate) => candidate.outputs.some((output) => output.itemId === itemId));
  return recipe?.id ?? null;
}
