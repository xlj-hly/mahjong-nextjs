## Context

第一层（`mahjong-core-engine`）已交付：规则无关核心 + `RulesPlugin` 接口 + 国标插件 + 热座。`RulesPlugin` 现有动作判定方法签名很窄：`canPong(concealed, discard)`、`kongOptions(hand, discard)`、`legalChow(concealed, discard)`，只接收手牌与弃牌，无法表达「缺门」这类玩家级局内状态。动机见 proposal.md - Why。

## Goals / Non-Goals

**Goals:**

- 用四川规则插件做一次「加第二种规则不改核心」的实战验证。
- 暴露并修复插件接口缺口——把动作判定接口升级为统一的上下文对象（5 孔插座）。

**Non-Goals:**

- 血战到底、杠分即时结算（属状态机流程层重构，非插件职责）。
- 天胡/地胡等低概率番种。

## Decisions

### D1: 动作判定接口升级为统一 `ActionContext`（5 孔插座）

现有 `canPong`/`kongOptions`/`legalChow` 的窄参数是「2 孔插座」——国标够用，四川需要多一根「缺门」的线就插不进。若给每个方法单独加参数，等于把 2 孔硬改成 3 孔，逼国标插头跟着改。正确做法是引入一个可扩展的上下文对象：

```ts
interface ActionContext {
  hand: HandState // 完整手牌（含副露）
  discard: Tile | null // 弃牌；暗杠/补杠等非响应动作为 null
  seat: Seat
  seatWind: number
  roundWind: number
  /** 缺门花色；无缺门规则为 null，插件自行忽略 */
  voidedSuit: Suit | null
}

interface RulesPlugin {
  canPong(ctx: ActionContext): boolean
  kongOptions(ctx: ActionContext): KongOption[]
  legalChow(ctx: ActionContext): [Tile, Tile][]
  // evaluateWin 已用 WinContext，动作判定与和牌判定统一为「上下文对象」风格
}
```

- 国标插件：只读 `hand`/`discard`，忽略 `voidedSuit`（恒 null），逻辑不变。
- 四川插件：额外读 `voidedSuit` 实现「缺门牌不能碰/杠」。
- 未来日麻加振听、宝牌：只往 `ActionContext` 加字段，不再动签名。

`WinContext`（和牌判定用）同样加 `voidedSuit`，两处上下文风格统一。

### D2: 定缺流程的状态机表达

给 `RulesPlugin` 加可选钩子 `requiresVoidSuit?: boolean`。状态机发牌后据此决定是否插入定缺阶段；缺门信息存于状态机的玩家级状态（与 `seatWind`/`roundWind` 同类），经 `ActionContext` 与 `WinContext` 传给插件。国标插件不声明即完全跳过，行为不变。

定缺交互：热座 UI 依次询问每位玩家选缺门（万/筒/条三选一）；headless 运行器提供 `apply({ type: 'voidSuit', suit })` 意图。定缺完成后进入行牌。

### D3: 四川插件复用国标的哪些部件

四川与国标共享：牌张模型、牌墙、拆解算法、状态机骨架。四川插件仅实现 `RulesPlugin`：

- `buildWall` 返回 108 张（复用 `Wall`）；
- `legalChow` 恒返回 `[]`（不能吃）；
- `isFlower` 恒 false；
- `canPong`/`kongOptions` 复用国标逻辑并增加缺门校验；
- `evaluateWin` 复用 `decompose` 做和牌判定，再套四川番种；
- `calcScore` 线性计分。

不复制国标的 81 番种谓词——四川番种表独立且小得多。

### D4: 四川番种体系（基础番种 + 叠加）

四川番种比国标简单，是**基础番种叠加**，不是国标的「包含互斥」。基础番种（首版）：

| 番种     | 番值 |
| -------- | ---- |
| 平胡     | 1    |
| 对对胡   | 2    |
| 清一色   | 3    |
| 七对     | 3    |
| 龙七对   | 4    |
| 杠上花   | 1    |
| 杠上炮   | 1    |
| 抢杠胡   | 1    |
| 海底捞月 | 1    |

「清七对」「清龙七对」是叠加结果（清一色+七对、清一色+龙七对），无需单独定义。无起胡门槛。四川仍用一个小 IMPLIES 表处理少数互斥（如清一色覆盖平胡、七对与龙七对互斥）。

### D5: 目录与接线

```
src/game/rules/sichuan/
  tile-set.ts   # 108 张
  fan.ts        # 番种值 + 互斥表
  evaluate.ts   # 和牌判定 + 番种 + 结算
  index.ts      # 组装 RulesPlugin
```

热座 UI：规则选择（国标/四川）入口，以及定缺阶段的选择控件。`useHotseatGame` 支持传入插件、处理 `voidSuit` 意图。

## Risks / Trade-offs

- [接口升级改动面较广（三个方法签名 + 状态机调用点 + 国标插件适配）] → 属一次性机械改动，有国标插件既有测试兜底；升级后接口更通用，长期收益大于一次性成本。
- [四川番种表因地域差异不唯一] → 采用成都地区常见番种表并在此固定为唯一依据，避免实现时摇摆。
- [血战到底/杠分仍缺失 → 首版四川规则不完整] → 在 proposal Non-Goals 明确记录，核心验证目标（动作判定 + 和牌判定的插件化）不受影响。

## Migration Plan

无——`ActionContext` 为新增类型，`RulesPlugin` 方法签名升级为接收该类型；国标插件与状态机同步适配。均为同一 codebase 内的一次性改动，无外部迁移面。

## Open Questions

- 四川番种的具体番值表若与实际玩法不符，可后续调整，不影响接口与架构。
