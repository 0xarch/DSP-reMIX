import { defineConfig } from "vitest/config";

export default defineConfig({
  // 与 vite.config.ts 的 define 保持一致：测试环境的编译期全局常量。
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0"),
    __APP_DISPLAY_NAME__: JSON.stringify(process.env.npm_package_display_name ?? "DSP reMIX"),
    __APP_DISPLAY_NAME_EN__: JSON.stringify(process.env.npm_package_display_name_en ?? "DSP Idle Network"),
    __BUILD_ID__: JSON.stringify("test"),
    __APP_PLATFORM__: JSON.stringify("web"),
    __RELEASE_CHANNEL__: JSON.stringify("stable"),
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // The large deterministic suites can crash Windows V8 forks under parallel memory pressure.
    maxWorkers: 1,
  },
});
