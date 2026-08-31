import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export const base = [js.configs.recommended, ...tseslint.configs.recommended]
