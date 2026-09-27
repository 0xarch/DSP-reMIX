import { expect, test, type Locator, type Page } from "@playwright/test";

const RELEASE_NOTE_ID = "2026-09-22-v1.3.0";
const VISUAL_FIXTURE_SESSION_KEY = "dsp-idle-network.ui-visual-fixture-seeded.v1";

async function seedVisualFactory(page: Page, options: { fontScale?: number; extreme?: boolean } = {}) {
  await page.addInitScript(({ fontScale, extreme, releaseNoteId, fixtureSessionKey }) => {
    const base = {
      planetId: "home",
      minerCount: 0,
      routingCursor: 0,
      progress: 0.35,
      utilization: 0,
      productionRate: 0,
      inputs: {},
      outputs: {},
    };
    const state = {
      version: 35,
      nextId: 20,
      activePlanetId: "home",
      entities: [
        { ...base, id: "visual-iron", kind: "vein", position: { x: -420, y: -120 }, resourceId: "iron_ore", machineCount: 0, minerCount: 1, resourceRemaining: 48_000, resourceCapacity: 50_000, outputs: { iron_ore: 80 } },
        { ...base, id: "visual-smelter", kind: "machine", position: { x: -80, y: -120 }, buildingId: "arc_smelter", recipeId: "iron_ingot", machineCount: 2, inputs: { iron_ore: 30 } },
        { ...base, id: "visual-storage", kind: "storage", position: { x: 260, y: -120 }, buildingId: "storage_mk1", storedItemId: "iron_ingot", machineCount: 3, inputs: { iron_ingot: 20 }, outputs: { iron_ingot: 60 } },
        { ...base, id: "visual-wind", kind: "power", position: { x: -120, y: 220 }, buildingId: "wind_turbine", machineCount: 8 },
      ],
      belts: [
        { id: "visual-belt", planetId: "home", source: "visual-iron", target: "visual-smelter", itemId: "iron_ore", lanes: 2, tier: 1, sorterTier: 1, progress: 0.25, priority: 1, stackSize: 2, monitorEnabled: true, totalTransferred: 120, congestion: 0.1, lastFlow: 12 },
      ],
      construction: { arc_smelter: 3, storage_mk1: 2, wind_turbine: 2, conveyor_belt_mk1: 30 },
      tray: { iron_ore: 3_000, copper_ore: 1_200, stone: 800, iron_ingot: 250 },
      planetTrays: { home: { iron_ore: 3_000, copper_ore: 1_200, stone: 800, iron_ingot: 250 } },
      planetTrayItemLimits: { home: 1_000_000 },
      totalProduced: {},
      manualMined: 1,
      achievements: { unlockedIds: [] },
      research: {
        selectedTechId: null,
        pausedTechId: null,
        queuedTechIds: [],
        progressByTech: {},
        completedTechIds: ["electromagnetism", "basic_smelting", "proliferator_1"],
      },
      exploration: {
        unlockedSystemIds: ["helios"],
        colonizedPlanetIds: ["home"],
        missions: [],
        surveyProgressBySystem: { helios: 1 },
      },
      settings: {
        theme: "dark",
        fontScale,
        simulationSpeed: 1,
        autosaveIntervalSeconds: 30,
        resourceMode: "finite",
      },
      paused: true,
    };
    window.sessionStorage.setItem("dsp-idle-network.test-bypass-menu", "1");
    window.localStorage.setItem("dsp-idle-network.release-notes.seen.v1", releaseNoteId);
    if (window.localStorage.getItem("dsp-idle-network.ui.show-run-log.v1") == null) window.localStorage.setItem("dsp-idle-network.ui.show-run-log.v1", "true");
    window.localStorage.setItem("dsp-idle-network.production-refresh.v1", "classic");
    // Feed the legacy compatibility ingress once. The app migrates this value
    // into its authoritative local save store; re-seeding during page.reload()
    // would correctly look like a second writer and trigger conflict recovery.
    if (window.sessionStorage.getItem(fixtureSessionKey) !== "1") {
      window.localStorage.setItem("dsp-idle-network.save.v1", JSON.stringify({ savedAt: Date.now(), state }));
      window.sessionStorage.setItem(fixtureSessionKey, "1");
    }
    if (extreme) {
      window.localStorage.setItem("dsp-idle-network.endgame-extreme.v1", "true");
      window.localStorage.setItem("dsp-idle-network.ui.canvas-detail.v1", "minimal");
    }
  }, { fontScale: options.fontScale ?? 1, extreme: options.extreme ?? false, releaseNoteId: RELEASE_NOTE_ID, fixtureSessionKey: VISUAL_FIXTURE_SESSION_KEY });
}

async function openFactory(page: Page) {
  await page.goto("/");
  const releaseNotes = page.locator(".release-notes-backdrop");
  if (await releaseNotes.isVisible().catch(() => false)) await releaseNotes.locator(".release-notes-footer button").click();
  const onboarding = page.getByRole("button", { name: /^(?:关闭|跳过)启动引导$/ });
  await expect(page.locator(".factory-canvas")).toBeVisible();
  await page.locator(".onboarding-coach").waitFor({ state: "visible", timeout: 1_000 }).catch(() => undefined);
  if (await onboarding.isVisible().catch(() => false)) await onboarding.first().click();
}

function luminance(value: string): number {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  return channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

async function expectDarkSurface(locator: Locator, maximum = 90) {
  await expect(locator).toBeVisible();
  expect(luminance(await locator.evaluate((element) => getComputedStyle(element).backgroundColor))).toBeLessThan(maximum);
}

async function assertEndgameSettingsGeometry(page: Page) {
  const group = page.locator(".settings-endgame-extreme");
  await expect(group).toBeVisible();
  const geometry = await group.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const rows = [...element.querySelectorAll<HTMLElement>(".setting-row")].map((row) => {
      const rowBounds = row.getBoundingClientRect();
      const labelBounds = row.querySelector<HTMLElement>("span")?.getBoundingClientRect();
      return {
        left: rowBounds.left,
        right: rowBounds.right,
        width: rowBounds.width,
        labelWidth: labelBounds?.width ?? 0,
      };
    });
    return {
      width: bounds.width,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      rows,
    };
  });
  expect(geometry.rows.length).toBeGreaterThanOrEqual(9);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  for (const row of geometry.rows) {
    expect(row.width).toBeGreaterThan(geometry.width * 0.9);
    expect(row.labelWidth).toBeGreaterThan(Math.min(110, geometry.width * 0.32));
  }
}

test("large-font settings stay in one readable column across desktop and mobile", async ({ page }) => {
  await seedVisualFactory(page, { fontScale: 2 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFactory(page);
  await page.getByLabel("打开设置").click();
  const operations = page.getByRole("dialog", { name: "运营中心" });
  await operations.locator(".settings-category-overview").getByRole("button", { name: /终局性能/ }).click();

  for (const scale of [80, 100, 125, 150, 200]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.uiFontScale = String(value);
      document.documentElement.style.setProperty("--ui-font-scale", String(value / 100));
    }, scale);
    await assertEndgameSettingsGeometry(page);
  }
  await page.screenshot({ path: "artifacts/qa/ui-2026-08-04/A1-settings-large-font-after.png", fullPage: true });

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await assertEndgameSettingsGeometry(page);
    await expect.poll(() => operations.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    if (viewport.width === 1024 && viewport.height === 768) {
      await page.screenshot({ path: "artifacts/qa/ui-2026-08-04/A1-settings-tablet-200-after.png", fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: "artifacts/qa/ui-2026-08-04/A2-settings-large-font-after.png", fullPage: true });
});

test("release history supports direct paging and technology wheel stays horizontal", async ({ page }) => {
  await seedVisualFactory(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFactory(page);

  await page.getByLabel("打开科技树").click();
  const technologyTree = page.locator(".technology-tree");
  const wheelBaseline = await technologyTree.evaluate((element) => {
    element.scrollLeft = 0;
    element.scrollTop = Math.min(24, Math.max(0, element.scrollHeight - element.clientHeight));
    return {
      top: element.scrollTop,
      pageTop: window.scrollY,
      horizontallyScrollable: element.scrollWidth > element.clientWidth,
    };
  });
  expect(wheelBaseline.horizontallyScrollable).toBe(true);
  await technologyTree.dispatchEvent("wheel", { deltaX: 0, deltaY: 180, bubbles: true, cancelable: true });
  await expect.poll(() => technologyTree.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect.poll(() => technologyTree.evaluate((element) => element.scrollTop)).toBe(wheelBaseline.top);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(wheelBaseline.pageTop);
  await page.getByLabel("科技树已打开，再次点击返回工厂").click();

  await page.getByLabel("打开设置").click();
  const operations = page.getByRole("dialog", { name: "运营中心" });
  await operations.locator(".settings-category-overview").getByRole("button", { name: /教程、版本与其他/ }).click();
  await operations.locator(".settings-release-notes > button").click();
  const releaseDialog = page.locator(".release-notes-dialog");
  await releaseDialog.getByRole("button", { name: "查看历史版本" }).click();
  await expect(releaseDialog.locator(".release-notes-history-list > button")).toHaveCount(3);
  const pageSelect = releaseDialog.getByLabel("跳转页码");
  const oldestPage = await pageSelect.locator("option").last().getAttribute("value");
  expect(oldestPage).not.toBeNull();
  await pageSelect.selectOption(oldestPage!);
  await expect(releaseDialog.locator(".release-notes-history-list")).toContainText("1.0.0");
  await releaseDialog.locator(".release-notes-history-list").getByRole("button", { name: /1\.0\.0/ }).click();
  const releaseHeading = releaseDialog.getByRole("heading", { name: "公开测试版首发" });
  await expect(releaseHeading).toBeVisible();
  expect(luminance(await releaseHeading.evaluate((element) => getComputedStyle(element).color))).toBeLessThan(160);
  await expectDarkSurface(releaseDialog.locator(".release-notes-scroll li > i").first(), 90);
  await releaseDialog.getByRole("button", { name: "查看历史版本" }).click();
  await expect(pageSelect).toHaveValue(oldestPage!);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => releaseDialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: "artifacts/qa/ui-2026-08-04/G1-release-history-pagination-after.png", fullPage: true });
});

test("extreme LOD compact labels and side panels preserve selection", async ({ page }) => {
  await seedVisualFactory(page, { extreme: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFactory(page);
  const compactSmelter = page.locator('.react-flow__node[data-id="visual-smelter"] .factory-node-compact');
  await expect(compactSmelter).toBeVisible();
  await expect(compactSmelter).toHaveAttribute("data-node-lod", "compact");
  await expect(compactSmelter).toHaveAttribute("title", "配方：铁块；产物：铁块；数量 2");
  await expect(compactSmelter).toHaveAttribute("aria-label", /配方：铁块；产物：铁块/);
  await expect(compactSmelter.locator("strong")).toHaveText("铁块");
  await page.screenshot({ path: "artifacts/qa/ui-2026-08-04/E1-endgame-node-title-after.png", fullPage: true });

  await page.locator('.react-flow__node[data-id="visual-smelter"]').evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  });
  await page.getByRole("button", { name: "边缘按钮：收起左侧物资面板" }).click();
  await page.getByRole("button", { name: "边缘按钮：收起右侧检查器面板" }).click();
  await expect(page.locator(".game-shell")).toHaveClass(/sidebar-left-collapsed/);
  await expect(page.locator(".game-shell")).toHaveClass(/sidebar-right-collapsed/);
  await expect(page.locator('.react-flow__node[data-id="visual-smelter"] .factory-node')).toHaveClass(/factory-node--selected/);
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(window.localStorage.getItem("dsp-idle-network.sidebar-preferences.v1") ?? "{}"))).left).toBe(true);
  await page.screenshot({ path: "artifacts/qa/ui-2026-08-04/F1-side-panels-collapsed-after.png", fullPage: true });

  await page.getByRole("button", { name: "边缘按钮：展开左侧物资面板" }).click();
  await page.getByRole("button", { name: "边缘按钮：展开右侧检查器面板" }).click();
  await expect(page.locator(".inspector-panel")).toContainText("熔炉");
  await expect(page.locator('.react-flow__node[data-id="visual-smelter"] .factory-node')).toHaveClass(/factory-node--selected/);
});
