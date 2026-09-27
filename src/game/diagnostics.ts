import type { AutomaticPerformanceReport } from "./benchmark";
import type { GameState } from "./types";
import { exportTextFile } from "./fileExport";

export const CLIENT_ERROR_STORAGE_KEY = "dsp-idle-network.client-errors.v1";

export interface ClientErrorRecord {
  id: string;
  kind: "error" | "rejection" | "long-task";
  message: string;
  stack?: string;
  occurredAt: number;
  location?: string;
}

function loadRecords(): ClientErrorRecord[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(CLIENT_ERROR_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((entry): entry is ClientErrorRecord => Boolean(entry && typeof entry === "object" && "message" in entry)).slice(-50) : [];
  } catch {
    return [];
  }
}

export function getClientErrors(): ClientErrorRecord[] {
  return loadRecords();
}

export function clearClientErrors(): void {
  try { window.localStorage.removeItem(CLIENT_ERROR_STORAGE_KEY); } catch { /* optional diagnostics */ }
}

function createClientErrorRecord(record: Omit<ClientErrorRecord, "id" | "occurredAt">): ClientErrorRecord {
  return {
    ...record,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `error_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: Date.now(),
  };
}

/** Persist several diagnostics in one synchronous storage write. */
export function recordClientErrors(records: Array<Omit<ClientErrorRecord, "id" | "occurredAt">>): ClientErrorRecord[] {
  if (records.length === 0) return [];
  const entries = records.map(createClientErrorRecord);
  try { window.localStorage.setItem(CLIENT_ERROR_STORAGE_KEY, JSON.stringify([...loadRecords(), ...entries].slice(-50))); } catch { /* optional diagnostics */ }
  return entries;
}

export function recordClientError(record: Omit<ClientErrorRecord, "id" | "occurredAt">): ClientErrorRecord {
  return recordClientErrors([record])[0];
}

export function collectClientDiagnostics(game?: GameState, performanceReport?: AutomaticPerformanceReport | null): Record<string, unknown> {
  const memory = "memory" in performance ? (performance as Performance & { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } }).memory : undefined;
  return {
    generatedAt: Date.now(),
    application: {
      name: __APP_DISPLAY_NAME__,
      version: __APP_VERSION__,
      build: __BUILD_ID__,
      url: window.location.href.replace(/[?#].*$/, ""),
      displayMode: window.matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser",
    },
    environment: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      memory: memory ? { used: memory.usedJSHeapSize ?? null, limit: memory.jsHeapSizeLimit ?? null } : null,
    },
    factory: game ? {
      stateVersion: game.version,
      elapsedSeconds: game.elapsedSeconds,
      activePlanetId: game.activePlanetId,
      entities: game.entities.length,
      belts: game.belts.length,
      completedTechnologies: game.research.completedTechIds.length,
      paused: game.paused,
      settings: game.settings,
    } : null,
    performanceReport: performanceReport ? {
      generatedAt: performanceReport.generatedAt,
      deterministic: performanceReport.benchmark.deterministic,
      benchmarkMs: performanceReport.benchmark.durationMs,
      idleSuiteMs: performanceReport.idleSuite.durationMs,
      idleIntegrity: performanceReport.idleSuite.integrityPassed,
      recommendedPerformanceMode: performanceReport.recommendedPerformanceMode,
    } : null,
    recentErrors: loadRecords(),
  };
}

export async function downloadDiagnostics(diagnostics: Record<string, unknown>): Promise<void> {
  await exportTextFile({
    contents: JSON.stringify(diagnostics, null, 2),
    fileName: `dsp-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    title: "导出客户端诊断",
  });
}
