'use client'

// 牌视觉层（TileView）：单张牌怎么画——v1 用汉字 + CSS 牌块外壳。
// 这是「同一渲染范式内可换」的接缝；换 three.js 时整体替换的是 BoardView，
// 牌数据（Tile 对象）贯穿始终、永不改变。

import type { Tile } from '@/game/core/tile'
import { tileLabel } from '@/game/core/tile'

const SUIT_CLASS: Record<Tile['suit'], string> = {
  wan: 'tile--wan',
  tong: 'tile--tong',
  tiao: 'tile--tiao',
  wind: 'tile--wind',
  dragon: 'tile--dragon',
  flower: 'tile--flower',
}

interface TileViewProps {
  tile?: Tile
  /** 牌背：不显示内容（用于隐藏其他玩家手牌）。 */
  faceDown?: boolean
  selected?: boolean
  onClick?: () => void
}

export function TileView({ tile, faceDown, selected, onClick }: TileViewProps) {
  if (faceDown || !tile) {
    return (
      <button
        type="button"
        className={`tile tile--back${onClick ? ' tile--clickable' : ''}`}
        onClick={onClick}
        aria-label="牌背"
        disabled={!onClick}
      />
    )
  }
  return (
    <button
      type="button"
      className={`tile ${SUIT_CLASS[tile.suit]}${selected ? ' tile--selected' : ''}${onClick ? ' tile--clickable' : ''}`}
      onClick={onClick}
      aria-label={tileLabel(tile)}
      disabled={!onClick}
    >
      {tileLabel(tile)}
    </button>
  )
}
