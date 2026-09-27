import type { ItemId } from "../../game/types";

export const FUEL_ENERGY_MJ: Partial<Record<ItemId, number>> = {
  coal: 2.7,
  fire_ice: 4.8,
  crude_oil: 4,
  energetic_graphite: 6.3,
  refined_oil: 4.4,
  hydrogen: 8,
  hydrogen_fuel_rod: 54,
  deuteron_fuel_rod: 600,
  antimatter_fuel_rod: 7200,
};
