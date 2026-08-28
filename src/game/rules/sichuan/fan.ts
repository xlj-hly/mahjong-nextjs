// 四川麻将番种：基础番种 + 叠加制（清七对 = 清一色 + 七对，无需单独定义）。

export const FAN_VALUES: Record<string, number> = {
  平胡: 1,
  对对胡: 2,
  清一色: 3,
  七对: 3,
  龙七对: 4,
  杠上花: 1,
  杠上炮: 1,
  抢杠胡: 1,
  海底捞月: 1,
}

// 互斥关系：四川番种叠加制，仅少数「大番种覆盖小番种」或天然互斥需处理。
// IMPLIES：key 是高番种，value 是它必然包含（覆盖）的低番种。
export const IMPLIES: Record<string, string[]> = {
  清一色: ['平胡'],
  龙七对: ['七对'],
}

// 无起胡门槛（四川麻将通常 1 番即可胡）。
export const MIN_FAN = 0
