import { expect, test, type Page } from "@playwright/test";

async function closeReleaseNotes(page: Page) {
  const dialog = page.getByRole("dialog", { name: /版本|更新/ });
  await dialog.waitFor({ state: "visible", timeout: 1_500 }).catch(() => undefined);
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /关闭|知道了|开始/ }).first().click();
    await expect(dialog).toBeHidden();
  }
}

test("nightly browsers preserve the core factory and modal keyboard journey", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("dsp-idle-network.test-bypass-menu", "1");
    localStorage.setItem("dsp-idle-network.onboarding.v1", "dismissed");
    const state = {
      version: 2,
      entities: [],
      belts: [],
      construction: { thermal_power_plant: 1, storage_mk1: 1 },
      tray: { coal: 5 },
      totalProduced: {},
      research: {
        selectedTechId: null,
        progressByTech: {},
        completedTechIds: ["basic_logistics", "thermal_power"],
      },
      paused: true,
    };
    localStorage.setItem("dsp-idle-network.save.v1", JSON.stringify({ savedAt: Date.now(), state }));
  });

  await page.goto("/");
  await closeReleaseNotes(page);
  await expect(page.locator(".game-shell")).toBeVisible();

  const trigger = page.getByLabel("打开命令面板");
  await trigger.click();
  const palette = page.getByRole("dialog", { name: "命令面板" });
  await expect(palette).toBeVisible();
  await expect(palette.getByLabel("搜索命令")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.getByLabel("打开设置").click();
  const settings = page.getByRole("dialog", { name: "运营中心" });
  await expect(settings).toBeVisible();
  await settings.getByRole("tab", { name: "设置" }).click();
  await settings.locator(".settings-category-overview").getByRole("button", { name: "画面与显示" }).click();
  await settings.getByLabel("字体大小").getByRole("button", { name: "200%" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--ui-font-scale"))).toBe("2");
  await expect.poll(() => settings.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();

  await page.getByLabel("打开科技树").click();
  await expect(page.getByRole("dialog", { name: /科技树/ })).toBeVisible();
});
