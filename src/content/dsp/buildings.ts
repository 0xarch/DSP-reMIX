import type { BuildingDefinition, BuildingId } from "../../game/types";

export const BUILDINGS: Record<BuildingId, BuildingDefinition> = {
  wind_turbine: {
    id: "wind_turbine", name: "风力涡轮机", shortName: "风机", kind: "power",
    powerGenerationKw: 300, speed: 1, inputCapacity: 0, outputCapacity: 0,
    description: "向当前星球电网提供 300 kW 电力。",
  },
  solar_panel: {
    id: "solar_panel", name: "太阳能板", shortName: "太阳能板", kind: "power",
    powerGenerationKw: 360, speed: 1, inputCapacity: 0, outputCapacity: 0,
    description: "将恒星辐射直接送入行星电网，烬原 II 的高日照环境可提升 50% 出力。",
  },
  geothermal_power_station: {
    id: "geothermal_power_station", name: "地热发电站", shortName: "地热站", kind: "power",
    powerGenerationKw: 4800, speed: 1, inputCapacity: 0, outputCapacity: 0,
    description: "只能部署在烬原 II，利用熔岩地热持续提供 4.8 MW 稳定电力。",
  },
  thermal_power_plant: {
    id: "thermal_power_plant", name: "火力发电厂", shortName: "火电厂", kind: "power",
    powerGenerationKw: 2160, speed: 1, inputCapacity: 120, outputCapacity: 0,
    description: "按电网缺口燃烧燃料，额定输出 2.16 MW，热能转换效率为 80%。",
  },
  mini_fusion_power_plant: {
    id: "mini_fusion_power_plant", name: "微型聚变发电站", shortName: "聚变站", kind: "power",
    powerGenerationKw: 15000, speed: 1, inputCapacity: 120, outputCapacity: 0,
    description: "消耗氘核燃料棒按电网缺口提供最高 15 MW 聚变电力。",
  },
  artificial_star: {
    id: "artificial_star", name: "人造恒星", shortName: "人造恒星", kind: "power",
    powerGenerationKw: 72000, speed: 1, inputCapacity: 30, outputCapacity: 0,
    description: "以反物质燃料棒维持湮灭反应，按电网缺口提供最高 72 MW 电力。",
  },
  accumulator: {
    id: "accumulator", name: "蓄电器", shortName: "蓄电器", kind: "power",
    powerGenerationKw: 900, powerChargeKw: 900, energyCapacityMj: 90,
    speed: 1, inputCapacity: 0, outputCapacity: 0,
    description: "内置 90 MJ 储能，电网富余时自动充电，供电不足时自动放电。",
  },
  energy_exchanger: {
    id: "energy_exchanger", name: "能量枢纽", shortName: "能量枢纽", kind: "power",
    powerGenerationKw: 45000, powerChargeKw: 45000, energyCapacityMj: 90,
    speed: 1, inputCapacity: 120, outputCapacity: 120,
    description: "以 45 MW 功率在空蓄电器与满蓄电器之间转换，形成可运输的跨行星储能闭环。",
  },
  mining_machine: {
    id: "mining_machine", name: "采矿机", shortName: "采矿机", kind: "miner",
    powerDemandKw: 420, speed: 0.5, inputCapacity: 0, outputCapacity: 180,
    description: "安装在矿脉上，持续把矿物送入节点输出缓存。",
  },
  arc_smelter: {
    id: "arc_smelter", name: "电弧熔炉", shortName: "熔炉", kind: "machine",
    powerDemandKw: 360, speed: 1, inputCapacity: 120, outputCapacity: 120, tier: 1, family: "smelter",
    description: "处理矿石、磁铁和基础建材。",
  },
  plane_smelter: {
    id: "plane_smelter", name: "位面熔炉", shortName: "位面熔炉", kind: "machine",
    powerDemandKw: 1440, speed: 2, inputCapacity: 240, outputCapacity: 240, tier: 2, family: "smelter",
    description: "以双倍配方速度处理全部熔炼配方，适合高吞吐冶金产线。",
  },
  assembling_machine_mk1: {
    id: "assembling_machine_mk1", name: "制造台 Mk.I", shortName: "制造台", kind: "machine",
    powerDemandKw: 270, speed: 0.75, inputCapacity: 120, outputCapacity: 120, tier: 1, family: "assembler",
    description: "以 0.75 倍配方速度组装基础零件。",
  },
  assembling_machine_mk2: {
    id: "assembling_machine_mk2", name: "制造台 Mk.II", shortName: "制造台 Mk.II", kind: "machine",
    powerDemandKw: 540, speed: 1, inputCapacity: 180, outputCapacity: 180, tier: 2, family: "assembler",
    description: "以标准配方速度组装物品，在相同节点规模下提供更高吞吐。",
  },
  assembling_machine_mk3: {
    id: "assembling_machine_mk3", name: "制造台 Mk.III", shortName: "制造台 Mk.III", kind: "machine",
    powerDemandKw: 1080, speed: 1.5, inputCapacity: 240, outputCapacity: 240, tier: 3, family: "assembler",
    description: "以 1.5 倍配方速度进行量子级装配，是最高等级的通用制造设备。",
  },
  spray_coater: {
    id: "spray_coater", name: "喷涂机", shortName: "喷涂模块", kind: "machine",
    powerDemandKw: 90, speed: 1, inputCapacity: 600, outputCapacity: 0,
    description: "作为生产节点的内联模块消耗增产剂，为当前配方提供额外产出或生产加速。",
  },
  matrix_lab: {
    id: "matrix_lab", name: "矩阵研究站", shortName: "研究站", kind: "machine",
    powerDemandKw: 480, speed: 1, inputCapacity: 120, outputCapacity: 120,
    description: "生产并研究科学矩阵。",
  },
  oil_extractor: {
    id: "oil_extractor", name: "原油萃取站", shortName: "萃取站", kind: "miner",
    powerDemandKw: 840, speed: 1, inputCapacity: 0, outputCapacity: 300,
    description: "安装在原油涌泉上，持续萃取原油。",
  },
  oil_refinery: {
    id: "oil_refinery", name: "原油精炼厂", shortName: "精炼厂", kind: "machine",
    powerDemandKw: 960, speed: 1, inputCapacity: 240, outputCapacity: 240,
    description: "执行原油精炼和 X 射线裂解等多产物配方。",
  },
  water_pump: {
    id: "water_pump", name: "抽水站", shortName: "抽水站", kind: "miner",
    powerDemandKw: 300, speed: 1, inputCapacity: 0, outputCapacity: 300,
    description: "部署在水或硫酸海洋上，以每秒 1 单位的基础速度抽取流体。",
  },
  chemical_plant: {
    id: "chemical_plant", name: "化工厂", shortName: "化工厂", kind: "machine",
    powerDemandKw: 720, speed: 1, inputCapacity: 240, outputCapacity: 240, tier: 1, family: "chemical",
    description: "执行塑料、有机晶体等高分子化工配方。",
  },
  quantum_chemical_plant: {
    id: "quantum_chemical_plant", name: "量子化工厂", shortName: "量子化工厂", kind: "machine",
    powerDemandKw: 2160, speed: 2, inputCapacity: 480, outputCapacity: 480, tier: 2, family: "chemical",
    description: "以双倍配方速度执行全部化工配方，可由普通化工厂原地升级。",
  },
  fractionator: {
    id: "fractionator", name: "分馏塔", shortName: "分馏塔", kind: "machine",
    powerDemandKw: 720, speed: 1, inputCapacity: 240, outputCapacity: 240,
    description: "循环处理氢并稳定分离氘，输出剩余氢形成可闭环的分馏物流。",
  },
  miniature_particle_collider: {
    id: "miniature_particle_collider", name: "微型粒子对撞机", shortName: "对撞机", kind: "machine",
    powerDemandKw: 12000, speed: 1, inputCapacity: 600, outputCapacity: 600,
    description: "消耗大量电力进行氘富集与奇异物质制造。",
  },
  em_rail_ejector: {
    id: "em_rail_ejector", name: "电磁轨道弹射器", shortName: "轨道弹射器", kind: "machine",
    powerDemandKw: 1800, speed: 1, inputCapacity: 180, outputCapacity: 0,
    description: "消耗太阳帆并将其发射到恒星轨道，持续扩充戴森云。",
  },
  ray_receiver: {
    id: "ray_receiver", name: "射线接收站", shortName: "接收站", kind: "machine",
    speed: 1, inputCapacity: 0, outputCapacity: 120,
    description: "共享戴森云恒星能，可切换电力输出或临界光子生成模式。",
  },
  vertical_launching_silo: {
    id: "vertical_launching_silo", name: "垂直发射井", shortName: "发射井", kind: "machine",
    powerDemandKw: 18000, speed: 1, inputCapacity: 180, outputCapacity: 0,
    description: "消耗小型运载火箭，在恒星轨道持续建设戴森球永久结构。",
  },
  planetary_logistics_station: {
    id: "planetary_logistics_station", name: "行星物流站", shortName: "行星站", kind: "station",
    powerDemandKw: 600, speed: 1, inputCapacity: 600, outputCapacity: 600, accepts: "any",
    description: "在同一行星内与异向站点自动配对，由需求站调度物流运输机完成无线货运。",
  },
  interstellar_logistics_station: {
    id: "interstellar_logistics_station", name: "星际物流站", shortName: "星际站", kind: "station",
    powerDemandKw: 1200, speed: 1, inputCapacity: 1000, outputCapacity: 1000, accepts: "any",
    description: "与另一行星的异向站点自动配对，由需求站调度已装载的运输船执行跨行星货运。",
  },
  orbital_collector: {
    id: "orbital_collector", name: "轨道采集器", shortName: "轨道采集器", kind: "station",
    speed: 1, inputCapacity: 0, outputCapacity: 2000, accepts: "any",
    description: "只能部署在气态巨星，持续采集氢、氘或可燃冰，并作为星际物流系统的远程供应端。",
  },
  storage_mk1: {
    id: "storage_mk1", name: "小型储物仓", shortName: "储物仓", kind: "storage",
    speed: 1, inputCapacity: 600, outputCapacity: 600, accepts: "solid",
    description: "缓存一种固体物品，并向后续物流线路持续供货。",
  },
  material_delivery_hub: {
    id: "material_delivery_hub", name: "物资配送枢纽", shortName: "配送枢纽", kind: "storage",
    speed: 1, inputCapacity: 900, outputCapacity: 0, accepts: "any",
    description: "提供 3 个独立输入接口，送达的物品会立即进入所在行星的物资托盘。",
  },
  orbital_cargo_terminal: {
    id: "orbital_cargo_terminal", name: "轨道货运终端", shortName: "轨道终端", kind: "storage",
    powerDemandKw: 50_000, speed: 1, inputCapacity: 1_000_000, outputCapacity: 0, accepts: "any", megastructure: true,
    description: "全星系空间站的行星物资入口。四个稳定输入口共享每分钟 20,000 件上传能力，每颗已殖民行星最多一座。",
  },
  storage_tank: {
    id: "storage_tank", name: "储液罐", shortName: "储液罐", kind: "storage",
    speed: 1, inputCapacity: 1200, outputCapacity: 1200, accepts: "fluid",
    description: "缓存原油、精炼油、氢或氘等流体资源。",
  },
  splitter_4way: {
    id: "splitter_4way", name: "四向分流器", shortName: "分流器", kind: "splitter",
    speed: 1, inputCapacity: 24, outputCapacity: 24, accepts: "any",
    description: "在多条输出运输线之间均分物资，并支持优先线路。",
  },
  construction_center: {
    id: "construction_center", name: "建筑制造中心", shortName: "制造中心", kind: "machine",
    powerDemandKw: 12000, speed: 1, inputCapacity: 0, outputCapacity: 0, megastructure: true,
    description: "巨构级建筑补给设施，从所在行星物资托盘取料并按目标库存持续补足施工设备。",
  },
  galactic_material_exporter: {
    id: "galactic_material_exporter", name: "超大型物资出口", shortName: "银河出口", kind: "machine",
    powerDemandKw: 24000, speed: 1, inputCapacity: 1_000_000, outputCapacity: 0, accepts: "any", megastructure: true,
    description: "银河终局工程的实体交付设施，通过四个专用输入端口接收宇宙矩阵、太阳帆、小型运载火箭和反物质燃料棒。",
  },
  micro_black_hole_connector: {
    id: "micro_black_hole_connector", name: "微型黑洞连接装置", shortName: "黑洞连接器", kind: "machine",
    speed: 1, inputCapacity: 0, outputCapacity: 0, accepts: "any", megastructure: true,
    description: "通过三个独立通用输入口永久销毁传送带送达的物资，并以十进制精确记录累计销毁量。",
  },
  time_warp_device: {
    id: "time_warp_device", name: "时间扭曲装置", shortName: "时间扭曲", kind: "machine",
    speed: 1, inputCapacity: 0, outputCapacity: 0, megastructure: true,
    description: "消耗所在电网的剩余功率加速全存档实时模拟；离线收益和活动墙钟不受影响。",
  },
  space_station_construction_launcher: {
    id: "space_station_construction_launcher", name: "空间站施工发射平台", shortName: "空间站平台", kind: "station",
    powerDemandKw: 10000, speed: 1, inputCapacity: 4000, outputCapacity: 0, accepts: "any", megastructure: true,
    description: "将所在行星的终局材料真实送入本恒星系空间站工地。每颗行星最多建设一座。",
  },
};
