import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
/** 应用显示名来自 package.json（名称统一配置的权威来源），断言随之动态读取。 */
const APP_DISPLAY_NAME = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).displayName as string;
const APP_DISPLAY_NAME_EN = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).displayNameEn as string;


const CACHE_NAMESPACE = "dsp-idle-pwa-v2::";
const SHELL_PREFIX = `${CACHE_NAMESPACE}shell::root::`;

async function waitForRootWorker(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false;
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  }, undefined, { timeout: 30_000 });
}

async function activateSyntheticUpgrade(page: Page, buildId: string): Promise<void> {
  await page.evaluate(async (nextBuildId) => {
    const scriptUrl = `/sw.js?v=${encodeURIComponent(nextBuildId)}&route=root&base=%2F`;
    const previousController = navigator.serviceWorker.controller;
    const registration = await navigator.serviceWorker.register(scriptUrl, { scope: "/", updateViaCache: "none" });

    const waitForInstalled = (worker: ServiceWorker): Promise<void> => {
      if (worker.state === "installed") return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const onStateChange = () => {
          if (worker.state === "installed") {
            worker.removeEventListener("statechange", onStateChange);
            resolve();
          } else if (worker.state === "redundant") {
            worker.removeEventListener("statechange", onStateChange);
            reject(new Error("Synthetic PWA upgrade became redundant before installation"));
          }
        };
        worker.addEventListener("statechange", onStateChange);
      });
    };

    let candidate = registration.installing ?? registration.waiting;
    if (!candidate && registration.active?.scriptURL !== new URL(scriptUrl, location.href).href) {
      await registration.update();
      candidate = registration.installing ?? registration.waiting;
    }
    if (!candidate) throw new Error("Synthetic PWA upgrade did not produce a candidate worker");
    await waitForInstalled(candidate);

    const changed = new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller !== previousController) {
        resolve();
        return;
      }
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
    candidate.postMessage({ type: "SKIP_WAITING" });
    await changed;
  }, buildId);
}

test("production PWA isolates caches, upgrades atomically and reopens offline", async ({ page, context }) => {
  test.skip(process.env.DSP_E2E_USE_PREVIEW !== "1", "PWA lifecycle requires a production preview build");
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));

  // Establish the origin without executing the application, then create a
  // cache owned by another same-origin application before DSPidle activates.
  await page.goto("/icon.svg");
  await page.evaluate(async () => {
    const cache = await caches.open("unrelated-pwa-e2e-cache");
    await cache.put("/unrelated-pwa-e2e-entry", new Response("preserve-me"));
  });

  await page.goto("/");
  await waitForRootWorker(page);

  const initial = await page.evaluate(async ({ namespace, shellPrefix }) => {
    const keys = await caches.keys();
    const shell = keys.find((key) => key.startsWith(shellPrefix));
    const shellEntries = shell ? await (await caches.open(shell)).keys() : [];
    return {
      keys,
      shell,
      shellEntries: shellEntries.map((request) => new URL(request.url).pathname),
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      owned: keys.filter((key) => key.startsWith(namespace)),
    };
  }, { namespace: CACHE_NAMESPACE, shellPrefix: SHELL_PREFIX });

  expect(initial.controller).toContain("/sw.js?");
  expect(initial.keys).toContain("unrelated-pwa-e2e-cache");
  expect(initial.shell).toBeTruthy();
  expect(initial.shellEntries).toContain("/index.html");
  expect(initial.shellEntries.some((pathname) => /^\/assets\/.+\.[cm]?js$/.test(pathname))).toBe(true);
  expect(initial.owned.length).toBeGreaterThanOrEqual(3);

  const nextBuildId = `e2e-next-${Date.now()}`;
  await activateSyntheticUpgrade(page, nextBuildId);

    const upgraded = await page.evaluate(async ({ shellPrefix, nextBuildId: expectedBuild }) => {
      const keys = await caches.keys();
      const shells = keys.filter((key) => key.startsWith(shellPrefix));
      const unrelated = await (await caches.open("unrelated-pwa-e2e-cache")).match("/unrelated-pwa-e2e-entry");
      const current = shells.find((key) => key.endsWith(expectedBuild));
      const currentCache = current ? await caches.open(current) : null;
      const entryRequest = currentCache
        ? (await currentCache.keys()).find((request) => /^\/assets\/index-.+\.js$/.test(new URL(request.url).pathname))
        : null;
      const entry = currentCache && entryRequest ? await currentCache.match(entryRequest) : null;
      return {
        shells,
        hasNext: shells.some((key) => key.endsWith(expectedBuild)),
        unrelatedBody: unrelated ? await unrelated.text() : null,
        controller: navigator.serviceWorker.controller?.scriptURL ?? null,
        entry: entry ? { status: entry.status, type: entry.type, contentType: entry.headers.get("Content-Type") } : null,
      };
  }, { shellPrefix: SHELL_PREFIX, nextBuildId });

  expect(upgraded.shells).toHaveLength(2);
  expect(upgraded.hasNext).toBe(true);
  expect(upgraded.unrelatedBody).toBe("preserve-me");
  expect(upgraded.controller).toContain(encodeURIComponent(nextBuildId));
  expect(upgraded.entry).toEqual({ status: 200, type: "basic", contentType: "text/javascript" });

  await context.setOffline(true);
  try {
    const versionFallback = await page.evaluate(async () => {
      const response = await fetch(`/version.json?offline=${Date.now()}`, { cache: "no-store" });
      return {
        status: response.status,
        fallback: response.headers.get("X-DSP-PWA-Fallback"),
        pwaStatus: response.headers.get("X-DSP-PWA-Status"),
        payload: await response.json(),
      };
    });
    expect(versionFallback).toMatchObject({
      status: 200,
      fallback: "last-known-version",
      pwaStatus: "network-unavailable",
    });
    expect(versionFallback.payload).toEqual(expect.objectContaining({
      version: expect.any(String),
      buildId: expect.any(String),
    }));

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(APP_DISPLAY_NAME);
    await page.waitForTimeout(3_000);
    const offlineDiagnostics = await page.evaluate(async (shellPrefix) => {
      const keys = await caches.keys();
      const shell = keys.find((key) => key.startsWith(shellPrefix) && key.includes("e2e-next-"));
      const entries = shell ? await (await caches.open(shell)).keys() : [];
      return {
        childCount: document.querySelector("#root")?.childElementCount ?? -1,
        bodyText: document.body.innerText.slice(0, 500),
        shell,
        entries: entries.map((request) => new URL(request.url).pathname),
      };
    }, SHELL_PREFIX);
    expect(
      offlineDiagnostics.childCount,
      JSON.stringify({ offlineDiagnostics, browserErrors, failedRequests }, null, 2),
    ).toBeGreaterThan(0);

    // Remove only the current immutable entry point. The retained previous
    // shell must remain independently bootable and report the fallback.
    await context.setOffline(false);
    await context.addInitScript(() => {
      navigator.serviceWorker?.addEventListener("message", (event) => {
        if (event.data?.type === "DSP_PWA_STATUS") {
          sessionStorage.setItem("dsp-e2e-pwa-status", JSON.stringify(event.data));
        }
      });
    });
    await page.evaluate(async ({ shellPrefix, nextBuildId: expectedBuild }) => {
      sessionStorage.removeItem("dsp-e2e-pwa-status");
      const shell = (await caches.keys()).find((key) => key.startsWith(shellPrefix) && key.endsWith(expectedBuild));
      if (!shell) throw new Error("Current synthetic PWA shell is missing");
      await (await caches.open(shell)).delete("/index.html", { ignoreVary: true });
    }, { shellPrefix: SHELL_PREFIX, nextBuildId });
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#root > *").first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => navigator.serviceWorker.controller?.postMessage({ type: "GET_PWA_STATUS" }));
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("dsp-e2e-pwa-status"))).not.toBeNull();
    const fallbackStatus = await page.evaluate(() => JSON.parse(sessionStorage.getItem("dsp-e2e-pwa-status") ?? "null"));
    expect(fallbackStatus).toMatchObject({
      type: "DSP_PWA_STATUS",
      status: "stable-fallback",
      previousStable: true,
    });
  } finally {
    await context.setOffline(false);
  }
});
