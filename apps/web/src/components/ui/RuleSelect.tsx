'use client'

// 规则选择器：纯展示组件，选中值由父级控制。

import type { RuleId } from '@mahjong/protocol'
import { RULES } from '@/lib/rules'

export function RuleSelect({
  value,
  onChange,
}: {
  value: RuleId
  onChange: (id: RuleId) => void
}) {
  return (
    <div className="board__rule-select">
      <span>选择规则：</span>
      {RULES.map((r) => (
        <button
          key={r.id}
          type="button"
          className={r.id === value ? 'board__rule-active' : ''}
          onClick={() => onChange(r.id)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
