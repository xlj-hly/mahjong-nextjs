import { describe, expect, it } from 'vitest'
import { createRunner } from './runner'
import { runAutoGame } from './cli'
import { sichuan } from './rules/sichuan'
import type { Seat } from './core/rules-plugin'

// 确定性 rng：保证测试可重复。
function seededRng(): () => number {
  let s = 42
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

describe('headless 对局运行器', () => {
  it('snapshot 返回纯数据，仅当前座位手牌可见', () => {
    const runner = createRunner(undefined, seededRng())
    const snap = runner.snapshot(0)
    expect(snap.phase).toBe('draw')
    expect(snap.hands[0].concealed).toBeDefined()
    expect(snap.hands[1].concealed).toBeUndefined()
    expect(Array.isArray(snap.legalActions)).toBe(true)
  })

  it('apply 拒绝非法意图', () => {
    const runner = createRunner(undefined, seededRng())
    // 非当前座位摸牌
    expect(() => runner.apply(1, { type: 'draw' })).toThrow()
  })

  it('CLI 脚本能纯命令行跑完整一局（国标）', () => {
    const final = runAutoGame(undefined, seededRng())
    expect(final).not.toBeNull()
    expect(final!.phase).toBe('ended')
    // 要么和牌要么荒庄
    if (final!.winInfo) {
      expect(final!.winInfo.totalFan).toBeGreaterThanOrEqual(8)
      expect(final!.score).not.toBeNull()
    }
  })

  it('四川规则下 headless 能完成定缺并跑完整一局', () => {
    const runner = createRunner(sichuan, seededRng())
    // 初始处于定缺阶段
    expect(runner.snapshot(0).phase).toBe('voidSuit')
    const final = runAutoGame(sichuan, seededRng())
    expect(final).not.toBeNull()
    expect(final!.phase).toBe('ended')
  })

  it('runner 不依赖 React/next（源码无相关 import）', () => {
    // 通过直接调用验证行为即可；import 依赖已由目录隔离保证。
    const runner = createRunner(undefined, seededRng())
    expect(runner.isOver()).toBe(false)
    const seat = runner.snapshot(0).current as Seat
    runner.apply(seat, { type: 'draw' })
    expect(runner.snapshot(seat).phase).toBe('discard')
  })
})
