import { defineConfig } from 'tsdown'

export default defineConfig(({ watch }) => ({
  // 开启源码地图
  sourcemap: true,
  // tsdown 在 platform: node 下默认输出 .mjs；这里固定回 .js，保持与 tsup 产物一致，
  // 使 exports 字段（./dist/index.js + ./dist/index.d.ts）无需改动。
  outExtensions: () => ({ js: '.js' }),
  // watch 模式禁止清理 dist：turbo 的 dev 依赖 ^build 保证产物就位，
  // watcher 一旦清理，server 的 tsx 会在重建空窗内解析不到 @mahjong/* 而崩溃。
  clean: !watch,
}))
