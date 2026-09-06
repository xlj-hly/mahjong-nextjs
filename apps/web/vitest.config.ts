import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@mahjong/game-core': fileURLToPath(
        new URL('../../packages/game-core/src', import.meta.url),
      ),
      '@mahjong/protocol': fileURLToPath(
        new URL('../../packages/protocol/src', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
