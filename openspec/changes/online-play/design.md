## Context

前两层已交付 `Game`（行牌状态机）、`RulesPlugin`（国标/四川）、以及 `snapshot(seat)`/`apply(seat, action)` 两个口子。热座通过这两个口子在单机内驱动对局。本 change 把它们搬到网络上：服务端持有 `Game` 实例，客户端只上报意图、接收快照。动机见 proposal.md - Why。

## Goals / Non-Goals

**Goals:**

- 用最小的改动兑现「snapshot/apply 解耦 → WebSocket 复用引擎」的承诺。
- 验证「权威服务器 + 薄传输层」架构：引擎零改动，网络只是传输。

**Non-Goals:**

- 断线重连、观战、账号、匹配大厅（见 proposal Non-Goals）。

## Decisions

### D1: 独立 Node 服务，非 Next.js 内嵌

实时对战需要 WebSocket 长连接 + 权威服务器。Next.js 适合做 UI 外壳，Route Handler 内嵌 WebSocket 在自托管下也可行但不稳定。**采纳**独立 Node 服务（`src/server/`），与 Next.js 前端并行运行。

- 备选：Next.js Route Handler 内嵌 ws。**否决**——长连接生命周期与 Serverless/热重载语义冲突。

### D2: Socket.io 选型

**采纳** Socket.io：内置房间（room）、连接管理、自动重连客户端，朋友自用场景省去大量样板。

- 备选：原生 `ws`。**否决**——房间广播、断线检测需手写。

### D3: 消息协议（薄传输层）

客户端与服务端之间只传两种语义，直接映射引擎的两个口子：

```
// 客户端 → 服务端（意图）
{ type: 'create', rule: 'guobiao' | 'sichuan' }   // 创建房间（创建者为房主）
{ type: 'join', code }                             // 加入房间
{ type: 'ready' }                                  // 准备
{ type: 'start' }                                  // 仅房主可触发；须全员已准备
{ type: 'action', action: Action }                 // 意图（出牌/碰/杠/和/定缺/摸）

// 服务端 → 客户端（快照 / 事件）
{ type: 'room', code, members }                    // 房间状态
{ type: 'snapshot', snapshot: Snapshot }           // 该座位可见的快照
{ type: 'gameOver', result }                       // 结算
{ type: 'error', message }                         // 拒绝的意图
```

服务端收到 `action` 后调用 `game.apply(seat, action)`，把每个座位 `game.snapshot(seat)` 分别发给对应连接的 socket。协议不承载任何规则语义——规则仍在服务端的插件里。

### D4: 房主、座位与 socket 的绑定

创建房间者为房主（座位 0）；加入者按顺序分配座位 1–3。服务端维护 `seat → socketId` 映射。`action` 消息的服务端校验：`seat` 必须对应当前 socket，防止玩家替他人操作；合法性由 `game.apply` 抛错兜底。`start` 仅房主可发，且须全员已准备。

### D5: 引擎复用（零改动）

`Game`、`RulesPlugin`、国标/四川插件、`snapshot`/`apply` 全部复用。服务端代码只需：

1. 按房间规则加载插件；
2. 创建 `Game`；
3. 把 socket 消息转成 `game.apply`，把 `game.snapshot` 广播出去。

这验证了第一层 D9 的架构承诺。

### D6: 前端联机模式

`useHotseatGame` 现在是「本地 Runner」模式。新增联机模式：一个 `NetworkRunner` 实现与本地相同的 `{ snapshot, apply }` 接口，但内部通过 socket 通信。`BoardView`/`TileView` 等 UI 组件不改。规则选择在「创建房间」时进行，而非对局中切换。

- 备选：重写 UI 层适配网络。**否决**——违背「薄传输层」目标。

### D7: 目录结构

```
src/server/
  index.ts          # Socket.io 服务入口
  room.ts           # 房间管理（成员/座位/准备状态）
  protocol.ts       # 消息类型定义
src/game/
  network.ts        # NetworkRunner（客户端 socket 封装）
src/components/
  RoomView.tsx      # 创建/加入房间 UI
```

## Risks / Trade-offs

- [服务端与前端各自启动，朋友自托管有门槛] → 提供 `npm run server` 与连接地址环境变量，README 说明；后续可做单命令并发启动。
- [无断线重连，掉线即出局] → 明确为 Non-Goal；Socket.io 客户端有自动重连，但房间座位绑定需后续 change 处理。
- [意图消息被客户端篡改] → 服务端校验 `seat` 归属 + `game.apply` 抛错兜底；朋友自用威胁模型下足够。

## Migration Plan

无——新增服务与前端联机模式，不改动现有热座与引擎。热座模式保留，通过 UI 入口选择「本地热座 / 联机对战」。

## Open Questions

- 房间是否支持「中途重新开始一局」（一局结束后原房间继续开下一局）——本 change 先支持单局，结束后房间可解散重建；连续对局留待后续。
