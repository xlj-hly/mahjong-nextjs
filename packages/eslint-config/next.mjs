import { base } from './base.mjs'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export const next = [...base, ...nextVitals, ...nextTs]
