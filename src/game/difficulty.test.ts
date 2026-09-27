import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_DEFINITIONS,
  RESOURCE_MULTIPLIER_EFFECTIVE_INFINITY,
  formatResourceMultiplier,
  getDifficultyDefinition,
  isDifficultyMode,
  normalizeResourceMultiplierSetting,
  resolveFiniteResourceMultiplier,
  resolveResourceMultiplier,
} from "./difficulty";

describe("difficulty presets", () => {
  it("keeps a stable standard fallback for legacy and invalid values", () => {
    expect(getDifficultyDefinition(undefined).id).toBe("standard");
    expect(getDifficultyDefinition("invalid" as never).id).toBe("standard");
    expect(isDifficultyMode("hard")).toBe(true);
    expect(isDifficultyMode("impossible")).toBe(false);
  });

  it("exposes three ordered balance profiles", () => {
    expect(DIFFICULTY_DEFINITIONS.map((definition) => definition.id)).toEqual(["relaxed", "standard", "hard"]);
    expect(DIFFICULTY_DEFINITIONS[0].productionMultiplier).toBeGreaterThan(1);
    expect(DIFFICULTY_DEFINITIONS[2].powerDemandMultiplier).toBeGreaterThan(1);
  });
});

describe("resource multipliers", () => {
  it("resolves the Infinity sentinel and validates the (0.01, 100] range", () => {
    expect(resolveResourceMultiplier("Infinity")).toBe(Number.POSITIVE_INFINITY);
    expect(resolveResourceMultiplier(1)).toBe(1);
    expect(resolveResourceMultiplier(0.01)).toBe(0.01);
    expect(resolveResourceMultiplier(100)).toBe(100);
    expect(resolveResourceMultiplier(0.009)).toBe(1);
    expect(resolveResourceMultiplier(101)).toBe(1);
    expect(resolveResourceMultiplier(null)).toBe(1);
    expect(resolveResourceMultiplier(undefined)).toBe(1);
    expect(normalizeResourceMultiplierSetting("Infinity")).toBe("Infinity");
    expect(normalizeResourceMultiplierSetting(2.345)).toBe(2.35);
    expect(normalizeResourceMultiplierSetting(-1)).toBeNull();
  });

  it("keeps persisted states JSON-safe by folding Infinity into a large finite power value", () => {
    expect(resolveFiniteResourceMultiplier("Infinity")).toBe(RESOURCE_MULTIPLIER_EFFECTIVE_INFINITY);
    expect(Number.isFinite(resolveFiniteResourceMultiplier("Infinity"))).toBe(true);
    expect(resolveFiniteResourceMultiplier(2)).toBe(2);
    expect(formatResourceMultiplier("Infinity")).toBe("∞");
    expect(formatResourceMultiplier(1.5)).toBe("1.5×");
  });
});
