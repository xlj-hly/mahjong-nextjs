import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'], // 入口
  format: ['esm'], // 产物格式
  target: 'node20', // 目标运行时
  sourcemap: true, // 生成 sourcemap
  dts: true, // 生成 .d.ts
  clean: true, // 构建前清空 dist
  external: [
    'hono',
    '@hono/node-server',
    'socket.io',
    '@mahjong/game-core',
    '@mahjong/protocol',
  ], // 不打进包，运行时从 node_modules 解析
})
