## 1. 核心接口升级（mahjong-core）

- [x] 1.1 新增 `ActionContext` 类型（hand/discard/seat/seatWind/roundWind/voidedSuit），验证 `tsc` 通过
- [x] 1.2 将 `RulesPlugin` 的 `canPong`/`kongOptions`/`legalChow` 签名改为接收 `ActionContext`，验证类型定义正确
- [x] 1.3 `WinContext` 增加 `voidedSuit: Suit | null` 字段，验证 `tsc` 通过
- [x] 1.4 国标插件适配新签名（从 ctx 读 hand/discard，忽略 voidedSuit），验证国标既有测试全部仍通过
- [x] 1.5 状态机增加「定缺」阶段：发牌后若插件 `requiresVoidSuit` 则依次询问定缺并记录；验证国标（不需定缺）行为不变、既有测试通过

## 2. 四川规则插件（src/game/rules/sichuan）

- [x] 2.1 实现 108 张牌种集合（万筒条各 36，无字无花），验证 `buildWall().remaining === 108` 单测通过
- [x] 2.2 实现插件骨架：`isFlower` 恒 false、`legalChow` 恒空、`requiresVoidSuit: true`，验证类型实现 `RulesPlugin` 通过
- [x] 2.3 实现 `canPong`/`kongOptions`：复用国标逻辑并增加「缺门牌不可碰/杠」校验，验证单测通过
- [x] 2.4 实现四川番种表 `fan.ts`（平胡/对对胡/清一色/七对/龙七对/杠上花/杠上炮/抢杠胡/海底捞月）与叠加/互斥规则，验证番值正确
- [x] 2.5 实现 `evaluateWin`：复用 `decompose` 和牌判定 + 缺一门约束 + 四川番种叠加，验证「含缺门牌不可和」「清一色识别」「清七对=清一色+七对」「平胡 1 番可和」单测通过
- [x] 2.6 实现 `calcScore` 线性结算，验证自摸/点炮结算单测通过

## 3. 热座接入

- [x] 3.1 `useHotseatGame` 支持传入规则插件（国标/四川）并处理 `voidSuit` 意图，验证两种插件均可启动热座
- [x] 3.2 热座 UI 增加规则选择入口与定缺阶段控件，验证四川规则下进入对局前可完成定缺
- [x] 3.3 四川规则下 headless 跑完整一局，验证 CLI/测试能完成对局到结算

## 4. 集成验证

- [x] 4.1 全量单测、`npm run typecheck`、`npm run lint`、`npm run build` 全部通过，验证国标插件无回归
