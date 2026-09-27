import type { ItemId, ProliferatorTier, TechId } from "../../game/types";

export interface ProliferatorDefinition {
  tier: ProliferatorTier;
  itemId: ItemId;
  sprayPoints: number;
  extraProductBonus: number;
  speedBonus: number;
  powerMultiplier: number;
  requiredTechId: TechId;
}

export const PROLIFERATORS: Record<ProliferatorTier, ProliferatorDefinition> = {
  1: { tier: 1, itemId: "proliferator_mk1", sprayPoints: 12, extraProductBonus: 0.125, speedBonus: 0.25, powerMultiplier: 1.3, requiredTechId: "proliferator_1" },
  2: { tier: 2, itemId: "proliferator_mk2", sprayPoints: 24, extraProductBonus: 0.2, speedBonus: 0.5, powerMultiplier: 1.7, requiredTechId: "proliferator_2" },
  3: { tier: 3, itemId: "proliferator_mk3", sprayPoints: 60, extraProductBonus: 0.25, speedBonus: 1, powerMultiplier: 2.5, requiredTechId: "proliferator_3" },
};

