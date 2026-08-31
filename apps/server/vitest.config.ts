import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@mahjong/game-core': fileURLToPath(
        new URL('../../packages/game-core/src', import.meta.url),
      ),
      '@mahjong/protocol': fileURLToPath(
        new URL('../../packages/protocol/src', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
