import type { ItemId } from "../../game/types";
import { getItem } from "../../game/content";

/**
 * 物品图标解析（与 src/content/dsp 的扩展包结构配套）。
 *
 * 两种方式并存：
 * 1. 文本方式 —— ItemDefinition.symbol（既有行为，无图标的物品继续使用）。
 * 2. 图片方式 —— 图标文件按约定放在 `assets/item-icons/<itemId>.<ext>`，
 *    由 import.meta.glob 自动收集；非约定文件名（如测试图标 `Ore.Fe.png`）
 *    在 ITEM_ICON_ALIASES 登记别名。ItemDefinition.icon 可显式覆盖。
 *
 * 未来扩展包只需按同样方式追加自己的图标目录模式。
 */

// 注意：Vite 要求 glob 模式为字面量，扩展包图标目录在此追加。
const IMAGE_MODULES = import.meta.glob<string>(
  [
    "../../../assets/item-icons/*.{png,jpg,jpeg,webp,avif,svg}",
    "../../../assets/*.{png,jpg,jpeg,webp,avif,svg}",
  ],
  { eager: true, query: "?url", import: "default" },
);

/** 非约定文件名 → itemId 的登记表。 */
const ITEM_ICON_ALIASES: Partial<Record<ItemId, string>> = {
  iron_ore: "Ore.Fe",
};

const URL_BY_KEY = new Map<string, string>();
for (const [path, url] of Object.entries(IMAGE_MODULES)) {
  const fileName = path.split("/").pop() ?? "";
  const key = fileName.replace(/\.[^.]+$/, "").toLocaleLowerCase("en-US");
  if (!URL_BY_KEY.has(key)) URL_BY_KEY.set(key, url);
}

export function getItemIconUrl(itemId: ItemId): string | undefined {
  const explicit = getItem(itemId).icon;
  if (explicit) return explicit;
  const alias = ITEM_ICON_ALIASES[itemId];
  if (alias) {
    const aliased = URL_BY_KEY.get(alias.toLocaleLowerCase("en-US"));
    if (aliased) return aliased;
  }
  return URL_BY_KEY.get(itemId);
}
