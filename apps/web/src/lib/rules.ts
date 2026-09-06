// 规则注册表：前端可选择的规则及其引擎插件。

import { guobiao, sichuan, type RulesPlugin } from '@mahjong/game-core'
import type { RuleId } from '@mahjong/protocol'

export interface RuleOption {
  id: RuleId
  label: string
  plugin: RulesPlugin
}

export const RULES: RuleOption[] = [
  { id: 'guobiao', label: '国标麻将', plugin: guobiao },
  { id: 'sichuan', label: '四川麻将', plugin: sichuan },
]
