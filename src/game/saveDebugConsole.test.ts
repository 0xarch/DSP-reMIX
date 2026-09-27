import { describe, expect, it } from "vitest";
import { createInitialState } from "./engine";
import { createSaveDump, installSaveDebugConsole, summarizeSaveState } from "./saveDebugConsole";

describe("save debug console", () => {
  it("summarizes counts, settings, galaxy generation and research from the live state", () => {
    const state = createInitialState(240_721, false, {
      galaxyOptions: { systemCount: 20, distanceCoefficient: 2 },
      veinMultiplier: "Infinity",
      powerGenerationMultiplier: 3,
    });
    const summary = summarizeSaveState(state);
    expect(summary.version).toBe(state.version);
    expect(summary.galaxySeed).toBe(240_721);
    expect(summary.galaxyGeneration).toEqual({ systemCount: 20, distanceCoefficient: 2 });
    expect(summary.settings.veinMultiplier).toBe("Infinity");
    expect(summary.counts.infiniteVeins).toBe(state.entities.filter((entity) => entity.resourceInfinite === true).length);
    expect(summary.counts.entities).toBe(state.entities.length);
    expect(summary.research.completedTechCount).toBe(0);
  });

  it("installs __DSP_DUMP_SAVE__ on the target window and removes it on uninstall", () => {
    const state = createInitialState();
    const target = { __DSP_DUMP_SAVE__: undefined } as unknown as Window & { __DSP_DUMP_SAVE__?: () => ReturnType<typeof createSaveDump> };
    const uninstall = installSaveDebugConsole(() => state, target);
    expect(typeof target.__DSP_DUMP_SAVE__).toBe("function");
    const dump = target.__DSP_DUMP_SAVE__!();
    expect(dump.summary.galaxySeed).toBe(state.galaxy.seed);
    expect(dump.state).toBe(state);
    uninstall();
    expect(target.__DSP_DUMP_SAVE__).toBeUndefined();
  });
});
