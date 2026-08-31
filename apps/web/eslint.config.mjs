import { defineConfig, globalIgnores } from 'eslint/config'
import { next } from '@mahjong/eslint-config/next'

export default defineConfig([
  ...next,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
