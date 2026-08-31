import { defineConfig, globalIgnores } from 'eslint/config'
import { base } from '@mahjong/eslint-config/base'

export default defineConfig([...base, globalIgnores(['dist/**'])])
