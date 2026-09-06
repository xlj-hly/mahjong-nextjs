// 展示层辅助函数：动作/面子/定缺的文案映射，纯函数、无状态。

import {
  tileLabel,
  type Action,
  type Meld,
  type Suit,
} from '@mahjong/game-core'

export function voidSuitLabel(action: Action): string {
  const suit = action.type === 'voidSuit' ? action.suit : null
  const names: Record<Suit, string> = {
    wan: '万',
    tong: '筒',
    tiao: '条',
    wind: '风',
    dragon: '箭',
    flower: '花',
  }
  return suit ? names[suit] : ''
}

export function actionLabel(action: Action): string {
  switch (action.type) {
    case 'voidSuit':
      return '定缺'
    case 'draw':
      return '摸牌'
    case 'win':
      return '和牌'
    case 'pong':
      return '碰'
    case 'kong':
      return '杠'
    case 'chow':
      return '吃'
    case 'pass':
      return '过'
    case 'discard':
      return '出牌'
  }
}

export function meldLabel(meld: Meld): string {
  if (meld.type === 'chow') return `吃 ${meld.tiles.map(tileLabel).join('')}`
  if (meld.type === 'pung') return `碰 ${tileLabel(meld.tile)}`
  return `${meld.concealed ? '暗' : '明'}杠 ${tileLabel(meld.tile)}`
}
