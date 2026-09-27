import { describe, expect, it } from "vitest";
import {
  createGalaxyState,
  createGalaxySeedFromText,
  createVeinReserve,
  isStarSystemIncluded,
  normalizeGalaxyGenerationOptions,
  GALAXY_SYSTEM_COUNT_MIN,
  includedStarSystemCount,
  getPlanetSolarPowerMultiplier,
  getPlanetDisplayName,
  getPlanetSearchText,
  getRecommendedPlanetRole,
  getStarSystemDisplayName,
  getSystemDistanceLy,
  isInfiniteResource,
  normalizeGalaxyState,
  specializationApplies,
} from "./galaxy";
import { PLANET_LIST, STAR_SYSTEM_LIST } from "./content";
import { createInitialState } from "./engine";
import { PLANET_TEMPLATES, STAR_CLASS_TEMPLATES } from "./galaxyCatalog";

describe("planet industrial profiles", () => {
  it("derives deterministic profiles and finite reserves from the persisted seed", () => {
    const first = createGalaxyState(73_041);
    const second = createGalaxyState(73_041);
    expect(second).toEqual(first);
    expect(STAR_SYSTEM_LIST).toHaveLength(8);
    expect(PLANET_LIST).toHaveLength(22);
    expect(Object.keys(PLANET_TEMPLATES)).toHaveLength(16);
    expect(Object.keys(STAR_CLASS_TEMPLATES)).toHaveLength(8);
    expect(new Set(Object.values(first.profiles).map((profile) => profile.templateId)).size).toBeGreaterThanOrEqual(12);
    expect(Object.values(createGalaxyState(73_042).profiles).map((profile) => profile.templateId))
      .not.toEqual(Object.values(first.profiles).map((profile) => profile.templateId));
    expect(createGalaxyState(73_042).profiles.home.reserveScale).not.toBe(first.profiles.home.reserveScale);
    expect(createVeinReserve(first, "ashen", "iron_ore", "shared_iron"))
      .toBe(createVeinReserve(second, "ashen", "iron_ore", "shared_iron"));
    expect(createVeinReserve(first, "ashen", "iron_ore", "shared_iron"))
      .toBeGreaterThan(createVeinReserve(first, "magnetar", "iron_ore", "shared_iron"));
  });

  it("makes oceans, tidal locking, stellar luminosity and two-dimensional distance mechanical", () => {
    const galaxy = createGalaxyState(240_721, true);
    expect(isInfiniteResource("water", "home", "finite", galaxy)).toBe(true);
    expect(isInfiniteResource("water", "frost", "finite", galaxy)).toBe(false);
    expect(isInfiniteResource("sulfuric_acid", "ashen", "finite", galaxy)).toBe(true);
    expect(getPlanetSolarPowerMultiplier({ galaxy }, "home")).toBe(1);
    expect(getPlanetSolarPowerMultiplier({ galaxy }, "frost")).toBe(0.5);
    expect(getPlanetSolarPowerMultiplier({ galaxy }, "magnetar")).toBe(0.19);
    expect(getSystemDistanceLy({ galaxy }, "aurora", "white_dwarf"))
      .toBe(getSystemDistanceLy({ galaxy }, "white_dwarf", "aurora"));
    expect(getSystemDistanceLy({ galaxy }, "aurora", "white_dwarf")).toBeGreaterThan(0);
  });

  it("restores persisted environment multipliers without first-reload drift", () => {
    const baseline = createGalaxyState(240_721, true);
    baseline.planetRoles.ashen = "smelting";
    expect(normalizeGalaxyState(JSON.parse(JSON.stringify(baseline)))).toEqual(baseline);
  });

  it("normalizes display metadata without changing internal galaxy ids", () => {
    const baseline = createGalaxyState(240_721, true);
    const normalized = normalizeGalaxyState({
      ...baseline,
      planetMetadata: { home: { customName: "  我的母星  ", note: "主产线", tags: ["出口", "出口", ""].concat(Array(20).fill("x")) } },
      systemMetadata: { helios: { customName: "  曙光庭  " } },
    });
    expect(getPlanetDisplayName({ galaxy: normalized }, "home")).toBe("我的母星");
    expect(getStarSystemDisplayName({ galaxy: normalized }, "helios")).toBe("曙光庭");
    expect(normalized.profiles.home.planetId).toBe("home");
    expect(normalized.planetMetadata.home?.tags).toEqual(["出口", "x"]);
    expect(getPlanetSearchText({ galaxy: normalized }, "home")).toContain("主产线");
    expect(getPlanetSearchText({ galaxy: normalized }, "home")).toContain("我的母星");
  });

  it("maps environmental specializations to concrete planning roles and equipment", () => {
    const galaxy = createGalaxyState(240_721, true);
    expect(getRecommendedPlanetRole({ galaxy }, "ashen")).toBe("smelting");
    expect(getRecommendedPlanetRole({ galaxy }, "frost")).toBe("chemical");
    expect(getRecommendedPlanetRole({ galaxy }, "giant")).toBe("logistics");
    expect(specializationApplies(galaxy.profiles.ashen, "smelter", "arc_smelter")).toBe(true);
    expect(specializationApplies(galaxy.profiles.ashen, "assembler", "assembling_machine_mk1")).toBe(false);
  });
});

describe("galaxy generation options", () => {
  it("normalizes system count and distance coefficient into the configured ranges", () => {
    expect(normalizeGalaxyGenerationOptions(undefined)).toEqual({ systemCount: GALAXY_SYSTEM_COUNT_MIN, distanceCoefficient: 1 });
    expect(normalizeGalaxyGenerationOptions({ systemCount: 2, distanceCoefficient: 99 }).systemCount).toBe(8);
    expect(normalizeGalaxyGenerationOptions({ systemCount: 99 }).systemCount).toBe(32);
    expect(normalizeGalaxyGenerationOptions({ distanceCoefficient: 0.1 }).distanceCoefficient).toBe(0.5);
    expect(normalizeGalaxyGenerationOptions({ distanceCoefficient: 40 }).distanceCoefficient).toBe(10);
  });

  it("scales stellar positions by the distance coefficient and keeps helios at the origin", () => {
    const baseline = createGalaxyState(240_721, true);
    const stretched = createGalaxyState(240_721, true, { distanceCoefficient: 2 });
    for (const system of STAR_SYSTEM_LIST) {
      const baseProfile = baseline.systemProfiles[system.id];
      const scaledProfile = stretched.systemProfiles[system.id];
      if (system.id === "helios") {
        expect(scaledProfile.positionX).toBe(0);
        expect(scaledProfile.positionY).toBe(0);
        continue;
      }
      expect(scaledProfile.positionX).toBe(Math.round(baseProfile.positionX * 2 * 100) / 100);
      expect(scaledProfile.distanceFromOriginLy).toBe(Math.round(Math.hypot(scaledProfile.positionX, scaledProfile.positionY) * 100) / 100);
    }
  });

  it("keeps the migrated 8 systems present at the minimum system count", () => {
    const galaxy = createGalaxyState(240_721, false, { systemCount: 8 });
    expect(galaxy.generatedSystems).toEqual([]);
    for (const system of STAR_SYSTEM_LIST.slice(0, 8)) {
      expect(isStarSystemIncluded(galaxy, system.id)).toBe(true);
    }
  });

  it("keeps legacy saves on the full catalog and round-trips generation options", () => {
    const legacy = normalizeGalaxyState({ seed: 240_721 });
    expect(legacy.generation).toEqual({ systemCount: GALAXY_SYSTEM_COUNT_MIN, distanceCoefficient: 1 });
    const generated = createInitialState(240_721, false, {
      galaxyOptions: { systemCount: 12, distanceCoefficient: 1.5 },
      veinMultiplier: 2,
      powerGenerationMultiplier: "Infinity",
    });
    expect(generated.galaxy.generation).toEqual({ systemCount: 12, distanceCoefficient: 1.5 });
    expect(generated.settings.veinMultiplier).toBe(2);
    expect(generated.settings.powerGenerationMultiplier).toBe("Infinity");
  });

  it("parses numeric and textual seeds deterministically and randomizes blanks", () => {
    expect(createGalaxySeedFromText("  12345 ")).toBe(12345);
    expect(createGalaxySeedFromText("北冕座")).toBe(createGalaxySeedFromText("北冕座"));
    expect(createGalaxySeedFromText("北冕座")).not.toBe(createGalaxySeedFromText("蔚蓝王座"));
    expect(createGalaxySeedFromText("")).toBeGreaterThanOrEqual(1);
  });
});

describe("vein multiplier", () => {
  it("scales initial vein reserves and marks Infinity veins as infinite", () => {
    const doubled = createInitialState(240_721, false, { veinMultiplier: 2 });
    const baseline = createInitialState(240_721, false);
    const sample = doubled.entities.find((entity) => entity.kind === "vein" && entity.resourceId === "iron_ore" && entity.planetId === "home")!;
    const baselineVein = baseline.entities.find((entity) => entity.id === sample.id)!;
    expect(sample.resourceRemaining).toBe((baselineVein.resourceRemaining ?? 0) * 2);
    expect(sample.resourceInfinite).toBeUndefined();

    const infinite = createInitialState(240_721, false, { veinMultiplier: "Infinity" });
    const infiniteVein = infinite.entities.find((entity) => entity.kind === "vein" && entity.resourceId === "iron_ore" && entity.planetId === "home")!;
    expect(infiniteVein.resourceInfinite).toBe(true);
    expect(infiniteVein.resourceRemaining).toBe(baselineVein.resourceRemaining);
    JSON.stringify(infinite);
  });
});

describe("procedural star systems", () => {
  it("generates deterministic, uniquely named systems with the requested count", () => {
    const first = createGalaxyState(73_041, false, { systemCount: 20 });
    const second = createGalaxyState(73_041, false, { systemCount: 20 });
    expect(first.generatedSystems.length).toBe(20 - 8);
    expect(JSON.stringify(first.generatedSystems)).toBe(JSON.stringify(second.generatedSystems));
    expect(JSON.stringify(first.generatedPlanets)).toBe(JSON.stringify(second.generatedPlanets));
    const ids = new Set(first.generatedSystems.map((system) => system.systemId));
    expect(ids.size).toBe(first.generatedSystems.length);
    for (const system of first.generatedSystems) {
      expect(system.displayName).toBe(system.displayName.trim());
      expect(system.temperature).toBeGreaterThanOrEqual(0);
      expect(system.temperature).toBeLessThanOrEqual(1);
    }
  });

  it("follows the ring and large-planet constraints per star system type", () => {
    const galaxy = createGalaxyState(9_001, false, { systemCount: 32 });
    expect(galaxy.generatedSystems.length).toBe(24);
    for (const system of galaxy.generatedSystems) {
      expect(system.rings).toBeGreaterThanOrEqual(1);
      expect(system.largePlanets.length).toBeLessThanOrEqual(Math.max(0, system.rings - 2));
      const systemPlanets = galaxy.generatedPlanets.filter((planet) => planet.systemId === system.systemId);
      expect(systemPlanets.length).toBeGreaterThan(0);
      const typeKeys = systemPlanets.map((planet) => planet.typeCode);
      expect(new Set(typeKeys).size).toBe(typeKeys.length);
      for (const planet of systemPlanets) {
        expect(planet.planetId).toBe(`${system.systemId}-${planet.typeCode}`);
      }
    }
  });

  it("chains generated systems for exploration after the catalog tail", () => {
    const galaxy = createGalaxyState(5_432, false, { systemCount: 12 });
    const catalog = createGalaxyState(5_432, false, { systemCount: 12 });
    void catalog;
    const generated = galaxy.generatedSystems;
    expect(generated.length).toBe(4);
    expect(generated[0].explorationCost.length).toBeGreaterThan(0);
  });

  it("rolls planet resources within the planet type probability table", async () => {
    const { PLANET_TYPES } = await import("../content/dsp/starSystems");
    const galaxy = createGalaxyState(777, false, { systemCount: 16 });
    for (const planet of galaxy.generatedPlanets) {
      const type = PLANET_TYPES[planet.typeCode];
      const profile = galaxy.profiles[planet.planetId];
      expect(profile).toBeDefined();
      if (!planet.large) {
        for (const resourceId of profile.resourceIds) {
          expect(resourceId in type.resources || type.resources[resourceId] !== undefined).toBe(true);
        }
        expect(profile.resourceIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("feeds generated planets into the content catalog and initial state", async () => {
    const { PLANETS, PLANET_LIST, STAR_SYSTEMS, STAR_SYSTEM_LIST } = await import("./content");
    const { createInitialState } = await import("./engine");
    const state = createInitialState(4_242, false, { galaxyOptions: { systemCount: 12 } });
    expect(state.galaxy.generatedPlanets.length).toBeGreaterThan(0);
    for (const planet of state.galaxy.generatedPlanets) {
      expect(PLANETS[planet.planetId]).toBeDefined();
      expect(PLANET_LIST.some((entry) => entry.id === planet.planetId)).toBe(true);
    }
    for (const system of state.galaxy.generatedSystems) {
      expect(STAR_SYSTEMS[system.systemId]).toBeDefined();
      expect(STAR_SYSTEM_LIST.some((entry) => entry.id === system.systemId)).toBe(true);
    }
    const generatedPlanetId = state.galaxy.generatedPlanets.find((planet) => !planet.large)!.planetId;
    expect(state.entities.some((entity) => entity.kind === "vein" && entity.planetId === generatedPlanetId)).toBe(true);
    expect(state.planetTrays[generatedPlanetId]).toBeDefined();
    expect(state.planetViewports[generatedPlanetId]).toBeDefined();
    expect(includedStarSystemCount(state.galaxy)).toBe(12);
  });
});
