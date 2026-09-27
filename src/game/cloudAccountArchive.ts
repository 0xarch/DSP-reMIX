import {
  WEB_SESSION_CSRF_HEADER,
  WEB_SESSION_MODE_COOKIE,
  WEB_SESSION_MODE_HEADER,
} from "./webSessionMigration";

export const CLOUD_QUOTA_VERSION = "cloud-quota-v1" as const;
export const CLOUD_ACCOUNT_ARCHIVE_VERSION = 2 as const;
export const CLOUD_ACCOUNT_ARCHIVE_CONTENT_TYPE = "application/vnd.dspidle.account-archive+zip";
export const DEFAULT_ARCHIVE_BLOB_FALLBACK_LIMIT_BYTES = 128 * 1024 * 1024;

const ERROR_BODY_LIMIT_BYTES = 64 * 1024;
const ARCHIVE_SUFFIX = ".dspaccount.zip";
const CLOUD_SAVE_MODES = ["normal", "speedrun"] as const;
const CLOUD_SAVE_SLOTS = ["main", "1", "2", "3"] as const;

export type CloudQuotaMode = typeof CLOUD_SAVE_MODES[number];
export type CloudQuotaSlot = typeof CLOUD_SAVE_SLOTS[number];

export interface CloudQuotaLimits {
  revisionBytes: number;
  slotBytes: number;
  modeBytes: number;
  accountBytes: number;
  historyRevisions: number;
}

export interface CloudQuotaUsage {
  logicalBytes: number;
  uniquePayloadBytes: number;
  revisionCount: number;
  remainingBytes: number;
}

export interface CloudQuotaModeUsage extends CloudQuotaUsage {
  slots: Record<CloudQuotaSlot, CloudQuotaUsage>;
}

export interface CloudQuotaSnapshot {
  version: typeof CLOUD_QUOTA_VERSION;
  limits: CloudQuotaLimits;
  usage: CloudQuotaUsage & {
    modes: Record<CloudQuotaMode, CloudQuotaModeUsage>;
  };
}

export type CloudQuotaPlanReason =
  | "revisionBytes"
  | "historyRevisions"
  | "slotBytes"
  | "modeBytes"
  | "accountBytes"
  | "invalidTarget"
  | null;

export interface CloudQuotaPlan {
  accepted: boolean;
  reason: CloudQuotaPlanReason;
  code: string | null;
  target: { mode: CloudQuotaMode; slot: CloudQuotaSlot } | null;
  limits: CloudQuotaLimits;
  usage: CloudQuotaSnapshot["usage"];
  incoming: { bytes: number; checksum: string | null };
  prune: { revisionCount: number; logicalBytes: number; revisions: number[] };
  projected: {
    accountLogicalBytes: number;
    modeLogicalBytes: number;
    slotLogicalBytes: number;
    slotRevisionCount: number;
    accountRemainingBytes: number;
    modeRemainingBytes: number;
    slotRemainingBytes: number;
  } | null;
}

export interface CloudQuotaPreflightInput {
  mode: CloudQuotaMode;
  slot: CloudQuotaSlot;
  size: number;
  checksum?: string | null;
}

export type CloudAccountRequestPreparer = (
  init: RequestInit,
) => RequestInit | Promise<RequestInit>;

export interface CloudAccountClientOptions {
  apiBase: string;
  authToken?: string | null;
  getAuthToken?: () => string | null | Promise<string | null>;
  prepareAuthenticatedRequest?: CloudAccountRequestPreparer;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

interface FileSystemWritableFileStreamLike extends WritableStream<Uint8Array> {
  abort(reason?: unknown): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStreamLike>;
}

type ShowSaveFilePickerLike = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
  excludeAcceptAllOption?: boolean;
}) => Promise<FileSystemFileHandleLike>;

export interface CloudAccountArchiveDownloadOptions extends CloudAccountClientOptions {
  showSaveFilePicker?: ShowSaveFilePickerLike | null;
  blobFallbackLimitBytes?: number;
  saveBlob?: (blob: Blob, fileName: string) => void | Promise<void>;
}

export interface CloudAccountArchiveImportPreview {
  version: 1;
  guard: string;
  confirmation: string;
  replaces: { modes: CloudQuotaMode[]; slots: CloudQuotaSlot[] };
  preserves: string[];
  cloudQuota: CloudQuotaSnapshot;
}

export interface CloudAccountArchiveImportResult {
  imported: true;
  revisionCount: number;
  logicalBytes: number;
  guard: string;
  modes: Record<CloudQuotaMode, Record<CloudQuotaSlot, unknown>>;
  leaderboardRevalidationRequired: Record<CloudQuotaMode, boolean>;
}

export interface CloudAccountArchiveDownloadResult {
  method: "file-system" | "blob";
  fileName: string;
  bytesWritten: number;
  archiveVersion: typeof CLOUD_ACCOUNT_ARCHIVE_VERSION;
}

export class CloudAccountArchiveError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 0,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "CloudAccountArchiveError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidResponse(`${label} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function safeInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw invalidResponse(`${label} 必须是大于等于 ${minimum} 的安全整数`);
  }
  return value as number;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 160) {
    throw invalidResponse(`${label} 必须是非空短字符串`);
  }
  return value;
}

function invalidResponse(message: string): CloudAccountArchiveError {
  return new CloudAccountArchiveError(message, "CLOUD_RESPONSE_INVALID");
}

function normalizeLimits(value: unknown): CloudQuotaLimits {
  const source = record(value, "云容量限制");
  const limits = {
    revisionBytes: safeInteger(source.revisionBytes, "revisionBytes", 1),
    slotBytes: safeInteger(source.slotBytes, "slotBytes", 1),
    modeBytes: safeInteger(source.modeBytes, "modeBytes", 1),
    accountBytes: safeInteger(source.accountBytes, "accountBytes", 1),
    historyRevisions: safeInteger(source.historyRevisions, "historyRevisions", 1),
  };
  if (limits.slotBytes < limits.revisionBytes
    || limits.modeBytes < limits.slotBytes
    || limits.accountBytes < limits.modeBytes) {
    throw invalidResponse("云容量限制层级无效");
  }
  return limits;
}

function normalizeUsage(value: unknown, label: string): CloudQuotaUsage {
  const source = record(value, label);
  return {
    logicalBytes: safeInteger(source.logicalBytes, `${label}.logicalBytes`),
    uniquePayloadBytes: safeInteger(source.uniquePayloadBytes, `${label}.uniquePayloadBytes`),
    revisionCount: safeInteger(source.revisionCount, `${label}.revisionCount`),
    remainingBytes: safeInteger(source.remainingBytes, `${label}.remainingBytes`),
  };
}

function normalizeQuotaUsage(value: unknown): CloudQuotaSnapshot["usage"] {
  const source = record(value, "云容量用量");
  const base = normalizeUsage(source, "云容量用量");
  const modesSource = record(source.modes, "云容量模式用量");
  const modes = Object.fromEntries(CLOUD_SAVE_MODES.map((mode) => {
    const modeSource = record(modesSource[mode], `${mode} 模式用量`);
    const slotsSource = record(modeSource.slots, `${mode} 模式槽位用量`);
    const slots = Object.fromEntries(CLOUD_SAVE_SLOTS.map((slot) => [
      slot,
      normalizeUsage(slotsSource[slot], `${mode}/${slot} 槽位用量`),
    ])) as Record<CloudQuotaSlot, CloudQuotaUsage>;
    return [mode, { ...normalizeUsage(modeSource, `${mode} 模式用量`), slots }];
  })) as Record<CloudQuotaMode, CloudQuotaModeUsage>;
  return { ...base, modes };
}

export function normalizeCloudQuotaSnapshot(value: unknown): CloudQuotaSnapshot {
  const source = record(value, "云容量快照");
  if (source.version !== CLOUD_QUOTA_VERSION) throw invalidResponse("云容量快照版本无效");
  return {
    version: CLOUD_QUOTA_VERSION,
    limits: normalizeLimits(source.limits),
    usage: normalizeQuotaUsage(source.usage),
  };
}

function normalizeMode(value: unknown, label: string): CloudQuotaMode {
  if (value !== "normal" && value !== "speedrun") throw invalidResponse(`${label} 无效`);
  return value;
}

function normalizeSlot(value: unknown, label: string): CloudQuotaSlot {
  if (value !== "main" && value !== "1" && value !== "2" && value !== "3") throw invalidResponse(`${label} 无效`);
  return value;
}

function normalizeChecksum(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw invalidResponse(`${label} 无效`);
  return value;
}

export function normalizeCloudQuotaPlan(value: unknown): CloudQuotaPlan {
  const source = record(value, "云容量预检");
  if (typeof source.accepted !== "boolean") throw invalidResponse("云容量预检 accepted 无效");
  const allowedReasons: CloudQuotaPlanReason[] = [
    null, "revisionBytes", "historyRevisions", "slotBytes", "modeBytes", "accountBytes", "invalidTarget",
  ];
  if (!allowedReasons.includes(source.reason as CloudQuotaPlanReason)) throw invalidResponse("云容量预检 reason 无效");
  const code = source.code === null ? null : nonEmptyString(source.code, "云容量预检 code");
  const incomingSource = record(source.incoming, "云容量预检 incoming");
  const pruneSource = record(source.prune, "云容量预检 prune");
  if (!Array.isArray(pruneSource.revisions)) throw invalidResponse("云容量预检 prune.revisions 无效");
  const revisions = pruneSource.revisions.map((revision, index) => safeInteger(revision, `prune.revisions[${index}]`, 1));
  const targetSource = source.target == null ? null : record(source.target, "云容量预检 target");
  const projectedSource = source.projected == null ? null : record(source.projected, "云容量预检 projected");
  const target = targetSource ? {
    mode: normalizeMode(targetSource.mode, "云容量预检模式"),
    slot: normalizeSlot(targetSource.slot, "云容量预检槽位"),
  } : null;
  const projected = projectedSource ? {
    accountLogicalBytes: safeInteger(projectedSource.accountLogicalBytes, "projected.accountLogicalBytes"),
    modeLogicalBytes: safeInteger(projectedSource.modeLogicalBytes, "projected.modeLogicalBytes"),
    slotLogicalBytes: safeInteger(projectedSource.slotLogicalBytes, "projected.slotLogicalBytes"),
    slotRevisionCount: safeInteger(projectedSource.slotRevisionCount, "projected.slotRevisionCount"),
    accountRemainingBytes: safeInteger(projectedSource.accountRemainingBytes, "projected.accountRemainingBytes"),
    modeRemainingBytes: safeInteger(projectedSource.modeRemainingBytes, "projected.modeRemainingBytes"),
    slotRemainingBytes: safeInteger(projectedSource.slotRemainingBytes, "projected.slotRemainingBytes"),
  } : null;
  if (source.accepted && (!target || !projected || source.reason !== null || code !== null)) {
    throw invalidResponse("已接受的云容量预检缺少目标或预计用量");
  }
  return {
    accepted: source.accepted,
    reason: source.reason as CloudQuotaPlanReason,
    code,
    target,
    limits: normalizeLimits(source.limits),
    usage: normalizeQuotaUsage(source.usage),
    incoming: {
      bytes: safeInteger(incomingSource.bytes, "incoming.bytes"),
      checksum: incomingSource.checksum == null ? null : normalizeChecksum(incomingSource.checksum, "incoming.checksum"),
    },
    prune: {
      revisionCount: safeInteger(pruneSource.revisionCount, "prune.revisionCount"),
      logicalBytes: safeInteger(pruneSource.logicalBytes, "prune.logicalBytes"),
      revisions,
    },
    projected,
  };
}

function normalizeApiBase(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized || /[\r\n]/.test(normalized)) {
    throw new CloudAccountArchiveError("云服务地址无效", "CLOUD_CLIENT_CONFIGURATION_INVALID");
  }
  return normalized;
}

type CloudAccountAuthentication =
  | { kind: "bearer"; token: string }
  | { kind: "prepared"; prepare: CloudAccountRequestPreparer };

async function requestContext(options: CloudAccountClientOptions): Promise<{
  base: string;
  fetch: typeof globalThis.fetch;
  authentication: CloudAccountAuthentication;
}> {
  const prepare = options.prepareAuthenticatedRequest;
  let authentication: CloudAccountAuthentication;
  if (prepare !== undefined) {
    if (typeof prepare !== "function") {
      throw new CloudAccountArchiveError("云账户请求准备器无效", "CLOUD_CLIENT_CONFIGURATION_INVALID");
    }
    if (options.getAuthToken !== undefined || options.authToken !== undefined && options.authToken !== null) {
      throw new CloudAccountArchiveError(
        "Cookie 会话不得与 Bearer 认证同时配置",
        "CLOUD_CLIENT_CONFIGURATION_INVALID",
      );
    }
    authentication = { kind: "prepared", prepare };
  } else {
    const token = options.getAuthToken ? await options.getAuthToken() : options.authToken;
    if (typeof token !== "string" || token.length === 0 || token.length > 4096 || /[\r\n]/.test(token)) {
      throw new CloudAccountArchiveError("请先登录云账户", "CLOUD_AUTH_REQUIRED", 401);
    }
    authentication = { kind: "bearer", token };
  }
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new CloudAccountArchiveError("当前环境不支持云服务请求", "CLOUD_FETCH_UNAVAILABLE");
  }
  return { base: normalizeApiBase(options.apiBase), fetch: fetchImplementation, authentication };
}

function requestMethod(init: RequestInit): string {
  const method = (init.method ?? "GET").toUpperCase();
  if (!/^[A-Z]{3,16}$/.test(method)) {
    throw new CloudAccountArchiveError("云账户请求方法无效", "CLOUD_CLIENT_CONFIGURATION_INVALID");
  }
  return method;
}

function isSameOriginRequest(url: string): boolean {
  try {
    const location = globalThis.location;
    if (!location?.href || !location.origin || location.origin === "null") return false;
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

function configurationError(message: string): CloudAccountArchiveError {
  return new CloudAccountArchiveError(message, "CLOUD_CLIENT_CONFIGURATION_INVALID");
}

function headersRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, name) => { result[name] = value; });
  return result;
}

async function authenticatedRequestInit(
  context: Awaited<ReturnType<typeof requestContext>>,
  url: string,
  init: RequestInit,
): Promise<RequestInit> {
  const method = requestMethod(init);
  const requiredHeaders = new Headers(init.headers);
  if (context.authentication.kind === "bearer") {
    requiredHeaders.set("authorization", `Bearer ${context.authentication.token}`);
    // Preserve the legacy fetch-init shape as well as its Bearer semantics.
    return { ...init, method, headers: headersRecord(requiredHeaders) };
  }

  if (!isSameOriginRequest(url)) {
    throw configurationError("Web Cookie 会话只能用于同源云服务请求");
  }
  const candidate = await context.authentication.prepare({
    ...init,
    method,
    headers: new Headers(requiredHeaders),
  });
  if (!candidate || typeof candidate !== "object") {
    throw configurationError("云账户请求准备器没有返回有效的 RequestInit");
  }
  const preparedMethod = requestMethod(candidate);
  if (preparedMethod !== method) throw configurationError("云账户请求准备器不得修改请求方法");
  if (candidate.body !== undefined && candidate.body !== init.body) {
    throw configurationError("云账户请求准备器不得修改请求正文");
  }
  if (candidate.signal !== undefined && candidate.signal !== init.signal) {
    throw configurationError("云账户请求准备器不得替换取消信号");
  }

  const headers = new Headers(candidate.headers ?? requiredHeaders);
  let requiredHeaderChanged = false;
  requiredHeaders.forEach((value, name) => {
    if (headers.get(name) !== value) requiredHeaderChanged = true;
  });
  if (requiredHeaderChanged) throw configurationError("云账户请求准备器不得删除或修改业务请求头");
  if (headers.has("authorization")) {
    throw configurationError("Web Cookie 会话不得混用 Authorization");
  }
  if (headers.has("cookie")) {
    throw configurationError("Web Cookie 会话必须由浏览器凭据策略发送，不能手工设置 Cookie");
  }
  if (candidate.credentials !== "include" || headers.get(WEB_SESSION_MODE_HEADER) !== WEB_SESSION_MODE_COOKIE) {
    throw configurationError("Web Cookie 会话缺少安全凭据或会话模式标记");
  }
  const csrfToken = headers.get(WEB_SESSION_CSRF_HEADER);
  const safeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (safeMethod && csrfToken !== null) {
    throw configurationError("只读 Web Cookie 请求不得携带 CSRF token");
  }
  if (!safeMethod && (csrfToken === null || !/^[A-Za-z0-9_-]{32}$/.test(csrfToken))) {
    throw configurationError("Web Cookie 写请求缺少有效的 CSRF token");
  }
  return {
    ...init,
    ...candidate,
    method,
    body: init.body,
    signal: init.signal,
    headers,
  };
}

function abortError(message = "账号归档下载已取消"): DOMException {
  return new DOMException(message, "AbortError");
}

async function readErrorBody(response: Response): Promise<{ message: string | null; code: string | null; truncated: boolean }> {
  if (!response.body) return { message: null, code: null, truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const remaining = ERROR_BODY_LIMIT_BYTES - total;
      if (remaining <= 0) {
        truncated = true;
        await reader.cancel("error response limit reached").catch(() => undefined);
        break;
      }
      const chunk = result.value.subarray(0, remaining);
      chunks.push(chunk);
      total += chunk.byteLength;
      if (chunk.byteLength < result.value.byteLength || total >= ERROR_BODY_LIMIT_BYTES) {
        truncated = true;
        await reader.cancel("error response limit reached").catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const parsed = JSON.parse(text) as unknown;
    const body = record(parsed, "云服务错误响应");
    return {
      message: typeof body.error === "string" ? body.error.slice(0, ERROR_BODY_LIMIT_BYTES) : null,
      code: typeof body.code === "string" ? body.code.slice(0, 160) : null,
      truncated,
    };
  } catch {
    return { message: text ? text.slice(0, 1024) : null, code: null, truncated };
  }
}

async function throwHttpError(response: Response, unsupportedArchive = false): Promise<never> {
  const errorBody = await readErrorBody(response);
  if (unsupportedArchive && (response.status === 404 || response.status === 501)) {
    throw new CloudAccountArchiveError(
      "当前云服务不支持流式账号归档；可由界面明确选择旧版 JSON 导出",
      "ARCHIVE_UNSUPPORTED",
      response.status,
      { serverCode: errorBody.code, truncated: errorBody.truncated },
    );
  }
  throw new CloudAccountArchiveError(
    errorBody.message ?? `云服务返回 ${response.status}`,
    errorBody.code ?? "CLOUD_HTTP_ERROR",
    response.status,
    { truncated: errorBody.truncated },
  );
}

async function fetchJson(options: CloudAccountClientOptions, path: string, init: RequestInit): Promise<unknown> {
  const context = await requestContext(options);
  if (options.signal?.aborted) throw abortError("云容量请求已取消");
  const url = `${context.base}${path}`;
  const request = await authenticatedRequestInit(context, url, {
    ...init,
    signal: options.signal,
    headers: {
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...(init.headers ?? {}),
    },
  });
  if (options.signal?.aborted) throw abortError("云容量请求已取消");
  let response: Response;
  try {
    response = await context.fetch(url, request);
  } catch (error) {
    if (options.signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw abortError("云容量请求已取消");
    throw new CloudAccountArchiveError("无法连接云服务", "CLOUD_NETWORK_ERROR");
  }
  if (!response.ok) return throwHttpError(response);
  try {
    return await response.json();
  } catch {
    throw invalidResponse("云服务返回的 JSON 无效");
  }
}

export async function fetchCloudQuota(options: CloudAccountClientOptions): Promise<CloudQuotaSnapshot> {
  const payload = record(await fetchJson(options, "/cloud-save/quota", { method: "GET" }), "云容量响应");
  return normalizeCloudQuotaSnapshot(payload.cloudQuota);
}

export async function preflightCloudQuota(
  input: CloudQuotaPreflightInput,
  options: CloudAccountClientOptions,
): Promise<CloudQuotaPlan> {
  const mode = normalizeMode(input.mode, "云存档模式");
  const slot = normalizeSlot(input.slot, "云存档槽位");
  const size = safeInteger(input.size, "云存档大小");
  const checksum = input.checksum == null ? null : normalizeChecksum(input.checksum, "云存档 checksum");
  const payload = record(await fetchJson(options, "/cloud-save/quota", {
    method: "POST",
    body: JSON.stringify({ mode, slot, size, ...(checksum ? { checksum } : {}) }),
  }), "云容量预检响应");
  return normalizeCloudQuotaPlan(payload.plan);
}

function normalizedImportPreview(value: unknown): CloudAccountArchiveImportPreview {
  const response = record(value, "账号归档导入预检响应");
  const source = record(response.import, "账号归档导入预检");
  if (source.version !== 1) throw invalidResponse("账号归档导入预检版本无效");
  const guard = nonEmptyString(source.guard, "账号归档导入 guard");
  if (!/^[a-f0-9]{64}$/.test(guard)) throw invalidResponse("账号归档导入 guard 无效");
  const confirmation = nonEmptyString(source.confirmation, "账号归档导入确认文字");
  if (confirmation !== `REPLACE_CLOUD_SAVES:${guard}`) throw invalidResponse("账号归档导入确认文字无效");
  const replaces = record(source.replaces, "账号归档替换范围");
  if (!Array.isArray(replaces.modes) || !Array.isArray(replaces.slots) || !Array.isArray(source.preserves)) {
    throw invalidResponse("账号归档导入范围无效");
  }
  return {
    version: 1,
    guard,
    confirmation,
    replaces: {
      modes: replaces.modes.map((mode) => normalizeMode(mode, "账号归档模式")),
      slots: replaces.slots.map((slot) => normalizeSlot(slot, "账号归档槽位")),
    },
    preserves: source.preserves.map((entry) => nonEmptyString(entry, "账号归档保留项")),
    cloudQuota: normalizeCloudQuotaSnapshot(response.cloudQuota),
  };
}

export async function fetchCloudAccountArchiveImportPreview(
  options: CloudAccountClientOptions,
): Promise<CloudAccountArchiveImportPreview> {
  return normalizedImportPreview(await fetchJson(options, "/account/import/archive", { method: "GET" }));
}

export async function importCloudAccountArchive(
  archive: Blob,
  preview: CloudAccountArchiveImportPreview,
  options: CloudAccountClientOptions,
): Promise<CloudAccountArchiveImportResult> {
  if (!(archive instanceof Blob) || archive.size < 1) {
    throw new CloudAccountArchiveError("请选择有效的 DSP 账号归档", "ACCOUNT_ARCHIVE_IMPORT_FILE_INVALID");
  }
  const context = await requestContext(options);
  if (options.signal?.aborted) throw abortError("账号归档导入已取消");
  const url = `${context.base}/account/import/archive`;
  const request = await authenticatedRequestInit(context, url, {
    method: "POST",
    signal: options.signal,
    headers: {
      "content-type": CLOUD_ACCOUNT_ARCHIVE_CONTENT_TYPE,
      "x-dsp-account-import-guard": preview.guard,
      "x-dsp-account-import-confirmation": preview.confirmation,
    },
    body: archive,
  });
  if (options.signal?.aborted) throw abortError("账号归档导入已取消");
  let response: Response;
  try {
    response = await context.fetch(url, request);
  } catch (error) {
    if (options.signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw abortError("账号归档导入已取消");
    throw new CloudAccountArchiveError("无法连接云服务", "ARCHIVE_IMPORT_NETWORK_ERROR");
  }
  if (!response.ok) return throwHttpError(response);
  let value: unknown;
  try { value = await response.json(); } catch { throw invalidResponse("账号归档导入响应不是有效 JSON"); }
  const source = record(value, "账号归档导入响应");
  if (source.imported !== true) throw invalidResponse("账号归档导入响应缺少成功标记");
  const guard = nonEmptyString(source.guard, "导入后 guard");
  if (!/^[a-f0-9]{64}$/.test(guard)) throw invalidResponse("导入后 guard 无效");
  const revalidation = record(source.leaderboardRevalidationRequired, "排行榜复核状态");
  const modes = record(source.modes, "导入后模式槽位");
  return {
    imported: true,
    revisionCount: safeInteger(source.revisionCount, "revisionCount"),
    logicalBytes: safeInteger(source.logicalBytes, "logicalBytes"),
    guard,
    modes: Object.fromEntries(CLOUD_SAVE_MODES.map((mode) => [mode, record(modes[mode], `${mode} 模式槽位`)])) as CloudAccountArchiveImportResult["modes"],
    leaderboardRevalidationRequired: Object.fromEntries(CLOUD_SAVE_MODES.map((mode) => {
      if (typeof revalidation[mode] !== "boolean") throw invalidResponse(`${mode} 复核状态无效`);
      return [mode, revalidation[mode]];
    })) as Record<CloudQuotaMode, boolean>,
  };
}

function positiveContentLength(response: Response): number {
  const value = response.headers.get("content-length");
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    throw new CloudAccountArchiveError("账号归档缺少有效的 Content-Length", "ARCHIVE_LENGTH_INVALID");
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new CloudAccountArchiveError("账号归档体积超出浏览器安全范围", "ARCHIVE_LENGTH_INVALID");
  }
  return length;
}

function validateArchiveResponse(response: Response): number {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== CLOUD_ACCOUNT_ARCHIVE_CONTENT_TYPE) {
    throw new CloudAccountArchiveError("云服务返回了错误的账号归档格式", "ARCHIVE_CONTENT_TYPE_INVALID");
  }
  if (response.headers.get("x-dsp-account-archive-version")?.trim() !== String(CLOUD_ACCOUNT_ARCHIVE_VERSION)) {
    throw new CloudAccountArchiveError("账号归档版本不受支持", "ARCHIVE_VERSION_UNSUPPORTED");
  }
  if (!response.body) throw new CloudAccountArchiveError("账号归档响应没有正文", "ARCHIVE_BODY_MISSING");
  return positiveContentLength(response);
}

function contentDispositionFileName(value: string | null): string | null {
  if (!value) return null;
  const extended = /(?:^|;)\s*filename\*=UTF-8''([^;]*)/i.exec(value)?.[1];
  if (extended) {
    try { return decodeURIComponent(extended.trim()); } catch { return null; }
  }
  const quoted = /(?:^|;)\s*filename="([^"]*)"/i.exec(value)?.[1];
  if (quoted) return quoted;
  return /(?:^|;)\s*filename=([^;]*)/i.exec(value)?.[1]?.trim() ?? null;
}

export function safeAccountArchiveFileName(contentDisposition: string | null): string {
  const candidate = contentDispositionFileName(contentDisposition)?.trim();
  if (!candidate
    || candidate === "."
    || candidate === ".."
    || candidate.includes("..")
    || /[\\/\u0000-\u001f\u007f<>:"|?*]/.test(candidate)) {
    return `dsp-account-export${ARCHIVE_SUFFIX}`;
  }
  const withoutTrailingDots = candidate.replace(/[. ]+$/, "");
  const withSuffix = withoutTrailingDots.toLowerCase().endsWith(ARCHIVE_SUFFIX)
    ? `${withoutTrailingDots.slice(0, -ARCHIVE_SUFFIX.length)}${ARCHIVE_SUFFIX}`
    : `${withoutTrailingDots}${ARCHIVE_SUFFIX}`;
  const maximumStemLength = 180 - ARCHIVE_SUFFIX.length;
  const stem = withSuffix.slice(0, -ARCHIVE_SUFFIX.length).slice(0, maximumStemLength).replace(/[. ]+$/, "");
  return `${stem || "dsp-account-export"}${ARCHIVE_SUFFIX}`;
}

function countedArchiveStream(body: ReadableStream<Uint8Array>, expectedBytes: number): {
  stream: ReadableStream<Uint8Array>;
  bytesRead: () => number;
} {
  let bytesRead = 0;
  const stream = body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength;
      if (!Number.isSafeInteger(bytesRead) || bytesRead > expectedBytes) {
        throw new CloudAccountArchiveError("账号归档实际字节超过 Content-Length", "ARCHIVE_LENGTH_MISMATCH", 0, {
          expectedBytes,
          actualBytes: bytesRead,
        });
      }
      controller.enqueue(chunk);
    },
    flush() {
      if (bytesRead !== expectedBytes) {
        throw new CloudAccountArchiveError("账号归档实际字节与 Content-Length 不一致", "ARCHIVE_LENGTH_MISMATCH", 0, {
          expectedBytes,
          actualBytes: bytesRead,
        });
      }
    },
  }));
  return { stream, bytesRead: () => bytesRead };
}

function detectedFilePicker(): ShowSaveFilePickerLike | null {
  const candidate = (globalThis as typeof globalThis & { showSaveFilePicker?: ShowSaveFilePickerLike }).showSaveFilePicker;
  return typeof candidate === "function" ? candidate.bind(globalThis) : null;
}

async function saveBlobInBrowser(blob: Blob, fileName: string): Promise<void> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new CloudAccountArchiveError("当前环境无法保存账号归档文件", "ARCHIVE_BLOB_SAVE_UNAVAILABLE");
  }
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function abortWritableQuietly(writable: FileSystemWritableFileStreamLike | null, reason: unknown): Promise<void> {
  if (!writable) return;
  try { await writable.abort(reason); } catch { /* pipeTo may already have aborted and unlocked it */ }
}

export async function downloadCloudAccountArchive(
  options: CloudAccountArchiveDownloadOptions,
): Promise<CloudAccountArchiveDownloadResult> {
  const context = await requestContext(options);
  if (options.signal?.aborted) throw abortError();
  const requestController = new AbortController();
  const cancelRequest = () => requestController.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", cancelRequest, { once: true });
  let writable: FileSystemWritableFileStreamLike | null = null;
  let completed = false;
  try {
    const url = `${context.base}/account/export/archive`;
    const request = await authenticatedRequestInit(context, url, {
      method: "GET",
      signal: requestController.signal,
      headers: { accept: CLOUD_ACCOUNT_ARCHIVE_CONTENT_TYPE },
    });
    if (options.signal?.aborted || requestController.signal.aborted) throw abortError();
    let response: Response;
    try {
      response = await context.fetch(url, request);
    } catch (error) {
      if (options.signal?.aborted || requestController.signal.aborted || error instanceof DOMException && error.name === "AbortError") {
        throw abortError();
      }
      throw new CloudAccountArchiveError("无法连接云服务", "ARCHIVE_NETWORK_ERROR");
    }
    if (!response.ok) return await throwHttpError(response, true);
    const expectedBytes = validateArchiveResponse(response);
    const fileName = safeAccountArchiveFileName(response.headers.get("content-disposition"));
    const picker = options.showSaveFilePicker === undefined ? detectedFilePicker() : options.showSaveFilePicker;
    if (picker) {
      const handle = await picker({
        suggestedName: fileName,
        excludeAcceptAllOption: true,
        types: [{
          description: `${__APP_DISPLAY_NAME__}账号归档`,
          accept: { [CLOUD_ACCOUNT_ARCHIVE_CONTENT_TYPE]: [ARCHIVE_SUFFIX] },
        }],
      });
      if (options.signal?.aborted) throw abortError();
      // Chromium writes through a temporary file and publishes it on close.
      // keepExistingData=false avoids copying an existing destination. Browser
      // implementations ultimately control replacement semantics, so callers
      // should still avoid selecting their only irreplaceable backup copy.
      writable = await handle.createWritable({ keepExistingData: false });
      const abortDestination = () => { void abortWritableQuietly(writable, abortError()); };
      options.signal?.addEventListener("abort", abortDestination, { once: true });
      try {
        if (options.signal?.aborted) throw abortError();
        const counted = countedArchiveStream(response.body!, expectedBytes);
        await counted.stream.pipeTo(writable, { signal: requestController.signal });
        completed = true;
        return {
          method: "file-system",
          fileName,
          bytesWritten: counted.bytesRead(),
          archiveVersion: CLOUD_ACCOUNT_ARCHIVE_VERSION,
        };
      } catch (error) {
        await abortWritableQuietly(writable, error);
        if (options.signal?.aborted || requestController.signal.aborted && error instanceof DOMException && error.name === "AbortError") {
          throw abortError();
        }
        throw error;
      } finally {
        options.signal?.removeEventListener("abort", abortDestination);
      }
    }

    const configuredLimit = options.blobFallbackLimitBytes ?? DEFAULT_ARCHIVE_BLOB_FALLBACK_LIMIT_BYTES;
    const fallbackLimit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : DEFAULT_ARCHIVE_BLOB_FALLBACK_LIMIT_BYTES;
    if (expectedBytes > fallbackLimit) {
      await response.body!.cancel("blob fallback size limit").catch(() => undefined);
      throw new CloudAccountArchiveError(
        "账号归档超过浏览器 128 MiB 保守内存上限，请使用 Windows 或 Android 客户端流式导出",
        "ARCHIVE_BLOB_FALLBACK_TOO_LARGE",
        0,
        { expectedBytes, fallbackLimitBytes: fallbackLimit },
      );
    }
    const counted = countedArchiveStream(response.body!, expectedBytes);
    const blob = await new Response(counted.stream, {
      headers: { "content-type": CLOUD_ACCOUNT_ARCHIVE_CONTENT_TYPE },
    }).blob();
    if (options.signal?.aborted) throw abortError();
    if (blob.size !== expectedBytes || counted.bytesRead() !== expectedBytes) {
      throw new CloudAccountArchiveError("账号归档实际字节与 Content-Length 不一致", "ARCHIVE_LENGTH_MISMATCH", 0, {
        expectedBytes,
        actualBytes: counted.bytesRead(),
      });
    }
    await (options.saveBlob ?? saveBlobInBrowser)(blob, fileName);
    completed = true;
    return {
      method: "blob",
      fileName,
      bytesWritten: counted.bytesRead(),
      archiveVersion: CLOUD_ACCOUNT_ARCHIVE_VERSION,
    };
  } catch (error) {
    requestController.abort(error);
    await abortWritableQuietly(writable, error);
    if (options.signal?.aborted) throw abortError();
    throw error;
  } finally {
    if (!completed) requestController.abort();
    options.signal?.removeEventListener("abort", cancelRequest);
  }
}
