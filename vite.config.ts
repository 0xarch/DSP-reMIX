import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function gitText(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const appVersion = process.env.npm_package_version ?? "0.1.0";
// 项目显示名的唯一来源：package.json 的 displayName / displayNameEn。
// 从文件读取（而非 npm_package_* 环境变量），保证 npx vite 直启时同样生效；环境变量可覆盖。
const packageMetadata = (() => {
  try { return JSON.parse(execFileSync("node", ["-e", "process.stdout.write(JSON.stringify(require('./package.json')))"], { encoding: "utf8" })); }
  catch { return {} as { displayName?: string; displayNameEn?: string; version?: string }; }
})();
const appDisplayName = process.env.APP_DISPLAY_NAME?.trim() || packageMetadata.displayName || "DSP Idle Network";
const appDisplayNameEn = process.env.APP_DISPLAY_NAME_EN?.trim() || packageMetadata.displayNameEn || appDisplayName;
const gitSha = process.env.DSP_GIT_SHA?.trim() || gitText(["rev-parse", "--short=12", "HEAD"]) || "nogit";
const gitDirty = process.env.DSP_GIT_DIRTY == null
  ? Boolean(gitText(["status", "--porcelain"]))
  : process.env.DSP_GIT_DIRTY === "1";
const buildId = process.env.DSP_BUILD_ID?.trim() || `${appVersion}+${gitSha}${gitDirty ? ".dirty" : ""}`;
const requestedPlatform = process.env.VITE_APP_PLATFORM?.trim().toLowerCase();
const appPlatform = requestedPlatform === "desktop" || requestedPlatform === "android" ? requestedPlatform : "web";
const requestedReleaseChannel = process.env.VITE_RELEASE_CHANNEL?.trim().toLowerCase();
const releaseChannel = requestedReleaseChannel === "beta" || requestedReleaseChannel === "nightly" ? requestedReleaseChannel : "stable";
const apiProxyTarget = process.env.DSP_API_PROXY_TARGET?.trim() || "http://127.0.0.1:4320";

export function resolveAssetBase(platform: string): string {
  return platform === "web" ? "/" : "./";
}

export function resolveVersionGeneratedAt(
  sourceDateEpoch = process.env.SOURCE_DATE_EPOCH,
  now = new Date(),
): string {
  const raw = sourceDateEpoch?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const seconds = Number(raw);
    if (Number.isSafeInteger(seconds)) {
      const generatedAt = new Date(seconds * 1_000);
      if (Number.isFinite(generatedAt.getTime())) return generatedAt.toISOString();
    }
  }
  return now.toISOString();
}

const versionGeneratedAt = resolveVersionGeneratedAt();

function scaleUiFontSizes(): Plugin {
  return {
    name: "scale-ui-font-sizes",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?", 1)[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith("/src/styles.css")) return null;
      const fontSizes = source.replace(
        /(\bfont-size\s*:\s*)(\d*\.?\d+)px\b/g,
        "$1calc($2px * var(--ui-font-scale, 1))",
      );
      const fontShorthands = fontSizes.replace(
        /(\bfont\s*:\s*)(\d*\.?\d+)px(?=\/)/g,
        "$1calc($2px * var(--ui-font-scale, 1))",
      );
      return fontShorthands === source ? null : { code: fontShorthands, map: null };
    },
  };
}

function rewritePwaManifest(source: string | Uint8Array): string {
  try {
    const manifest = JSON.parse(typeof source === "string" ? source : new TextDecoder().decode(source));
    manifest.name = appDisplayName;
    manifest.short_name = appDisplayName;
    return `${JSON.stringify(manifest, null, 2)}\n`;
  } catch { return typeof source === "string" ? source : new TextDecoder().decode(source); }
}

function emitVersionMetadata(): Plugin {
  return {
    name: "emit-version-metadata",
    // index.html 是静态入口，标题在这里统一替换为 package.json 的 displayName。
    transformIndexHtml(html) {
      return html.replace(/<title>.*<\/title>/, `<title>${appDisplayName}</title>`);
    },
    // dev 模式下 public/manifest.webmanifest 由静态中间件直出，用中间件重写。
    configureServer(server) {
      server.middlewares.use("/manifest.webmanifest", (_req, res) => {
        res.setHeader("Content-Type", "application/manifest+json");
        res.end(rewritePwaManifest(readFileSync("public/manifest.webmanifest", "utf8")));
      });
    },
    // Rolldown 在 generateBundle 阶段尚未拷贝 public/ 资源，用 closeBundle 在写盘后改写。
    closeBundle() {
      try {
        const manifestPath = `${process.cwd()}/dist/manifest.webmanifest`;
        writeFileSync(manifestPath, rewritePwaManifest(readFileSync(manifestPath, "utf8")));
      } catch { /* dist manifest may not exist in non-web targets */ }
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify({ version: appVersion, buildId, platform: appPlatform, generatedAt: versionGeneratedAt })}\n`,
      });
    },
  };
}

export default defineConfig({
  // Browser history routes such as /station/:publicId must still resolve the
  // Web entry chunks from the origin root. Packaged file:// shells continue
  // to require relative assets, so keep that behavior only for native builds.
  base: resolveAssetBase(appPlatform),
  plugins: [scaleUiFontSizes(), react(), emitVersionMetadata()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_DISPLAY_NAME__: JSON.stringify(appDisplayName),
    __APP_DISPLAY_NAME_EN__: JSON.stringify(appDisplayNameEn),
    __BUILD_ID__: JSON.stringify(buildId),
    __APP_PLATFORM__: JSON.stringify(appPlatform),
    __RELEASE_CHANNEL__: JSON.stringify(releaseChannel),
  },
  build: {
    // The release gate consumes Vite's authoritative static/dynamic module
    // graph instead of guessing startup cost from hashed filenames.
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 30,
              includeDependenciesRecursively: false,
            },
            {
              name: "flow-vendor",
              test: /node_modules[\\/]@xyflow[\\/]/,
              priority: 20,
              includeDependenciesRecursively: false,
            },
            {
              name: "game-core",
              test: /src[\\/]game[\\/](?:content|engine|recipeGraph|statistics)\.ts$/,
              priority: 10,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4318,
    proxy: { "/api": apiProxyTarget },
  },
  preview: { proxy: { "/api": apiProxyTarget } },
});
