import { describe, expect, it } from 'vitest'
import { actionLabel, meldLabel, voidSuitLabel } from './labels'

const wan = (rank: number) => ({ suit: 'wan' as const, rank })

describe('labels', () => {
  it('actionLabel 映射所有动作', () => {
    expect(actionLabel({ type: 'voidSuit', suit: 'wan' })).toBe('定缺')
    expect(actionLabel({ type: 'draw' })).toBe('摸牌')
    expect(actionLabel({ type: 'win' })).toBe('和牌')
    expect(actionLabel({ type: 'pong' })).toBe('碰')
    expect(actionLabel({ type: 'kong', kind: 'melded', tile: wan(1) })).toBe(
      '杠',
    )
    expect(actionLabel({ type: 'chow', tiles: [wan(1), wan(2)] })).toBe('吃')
    expect(actionLabel({ type: 'pass' })).toBe('过')
    expect(actionLabel({ type: 'discard', tile: wan(1) })).toBe('出牌')
  })

  it('voidSuitLabel 映射花色', () => {
    expect(voidSuitLabel({ type: 'voidSuit', suit: 'tong' })).toBe('筒')
  })

  it('meldLabel 映射面子', () => {
    expect(meldLabel({ type: 'pung', tile: wan(5), concealed: false })).toBe(
      '碰 五万',
    )
    expect(
      meldLabel({
        type: 'chow',
        tiles: [wan(1), wan(2), wan(3)],
        concealed: false,
      }),
    ).toBe('吃 一万二万三万')
    expect(meldLabel({ type: 'kong', tile: wan(9), concealed: true })).toBe(
      '暗杠 九万',
    )
  })
})
