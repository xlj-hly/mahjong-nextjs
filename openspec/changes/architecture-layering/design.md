## Context

现状：web 端 `page.tsx` 以 `useState<Mode>` 做三模式切换并内联创建 `NetworkRunner`；`RoomView.tsx`（412 行）混合「建房/加入表单 + 房间大厅 + 联机棋盘」；`BoardView.tsx` 与 `RoomView.tsx` 的 `OnlineBoardInner` 各自实现一套近乎相同的棋盘；`components/` 混放组件/hook/css；无 api 层、无 web 测试。服务端 `index.ts`（250 行）把 HTTP、Socket.io、消息路由、对局编排全塞在一个文件，`room.ts` 用模块级 `Map` 存房间且永不清理。动机见 proposal.md。

约束：Next 16（AGENTS.md 提示有 breaking changes，实现前须读 `node_modules/next/dist/docs/`）；monorepo 用 turbo + tsdown/tsup；`@mahjong/protocol` 已拆为纯类型包。

## Goals / Non-Goals

**Goals:**

- 前端按 `app`（页面）/`components`（组件）/`api`/`hooks`/`lib`（工具）分层落地，对局行为不变。
- 棋盘渲染收敛为一份，热座/联机复用。
- request 骨架（HTTP 封装 + socket 封装 + React hook）就位。
- web 建立测试安全网；CI 建立质量门禁。
- 服务端分层（index.ts 拆四模块）+ 房间 store 接口化并补清理。

**Non-Goals:**

- 不引入任何新的运行时机制/依赖：zod 校验、状态管理库（zustand/jotai）、Redis/持久化等均不在本轮（protocol 保持纯类型）。
- 不新增任何 REST 端点（只搭 HTTP 封装骨架）。
- 不做客户端断线重连策略、房主迁移、用户账号、e2e。
- 不清理 render.yaml / cd.yml 的部署残留（除新增 CI job 外）。

## Decisions

### D1 目录结构：api/ 顶层，而非 lib/api/

`api/` 是「网络出入口」这一职责目录，与 `app/`（页面）、`components/`（展示）平级；`lib/` 只收无家可归的纯工具（labels、rules）。hook 不放 `app/`（避免 components→app 反向依赖）：`useHotseatGame`、`useRoom` 都放顶层 `hooks/`，由页面调用并把 `snapshot`/`apply` 经 props 传给纯展示组件。备选「lib/api/」套娃被否——多一层不带来信息，import 路径更长。

### D2 真路由 vs 单页 mode-switch

选真路由（`/`、`/hotseat`、`/online`、`/room/[code]`）。理由：房间码分享需要可深链、可刷新的 URL，单页模式做不了。备选「保持单页只做内部组件分层」被否——无法支撑直达链接这一新需求。实现前按 AGENTS.md 先读 Next 16 路由文档确认 typed routes / `dynamic` 的写法。

### D3 棋盘去重：共享纯展示 GameBoard

`GameBoard({ snapshot, onApply })` 纯展示，只消费 `snapshot` 并回调 `onApply(action)`；热座传本地 runner 的 snapshot/apply，联机传 `useRoom` 的。备选「保留两份」被否——两份 90% 重复，规则/UI 改动要改两处。备选「HOC/context 抽象数据源」被否——过度，props 足够。

### D4 request 封装：api/client.ts + api/socket.ts + useRoom

- HTTP：`api/client.ts` 薄封装（base URL、JSON 解析、错误归一、超时），暂不接真实端点。
- 实时：`NetworkRunner` 迁入 `api/socket.ts`（对外接口不变）。
- 状态：`useRoom` hook 封装 runner 生命周期，用 `useState + useEffect` 订阅 `onUpdate`（把 `RoomView` 里手搓的 `setTick` 收进 hook）；unmount 时 `disconnect()` 修连接泄漏。不用 `useSyncExternalStore`——runner 的 getter 不是引用稳定的单一快照，不满足该 API 的契约。

### D5 不引入状态库

当前共享状态很少（每对局页自包含），内置 hooks（`useState`/`useEffect`）足够。备选 zustand/jotai 推迟到出现跨页全局态时再评估。

### D6 DTO 类型：本轮只收严 seat，REST 类型延后

本轮无 REST 端点，不新增 DTO；仅把 `RoomMember.seat`/`RoomMessage.yourSeat` 改为 `Seat`，并把 `CreateRoomMessage.rule`/`RoomMessage.rule` 统一为 `RuleId`（消除前端两处强转）。未来 REST 的 request/response 类型将扩进 `@mahjong/protocol`（已决策），但本轮不涉及。

### D7 服务端房间 store：接口 + 内存实现 + 清理

把 `room.ts` 的一组函数收敛为 `RoomStore` 接口 + `createRoomStore()` 内存实现，并**新增 `leaveRoom(code, socketId)`**（移除成员；开局前成员清空则自动删房），让 `index.ts` 的 disconnect handler 改调它，替代现在直接 `room.members.delete`。清理规则：开局前空房 → 删房；对局结束 → 删房 + 删 runner。`runners`（对局引擎实例）归 `services/`（对局编排）持有，`store/` 只负责房间成员与就绪状态；对局结束时由 services 的结束路径先释放 runner，再触发 store 删房，避免两层各自持有状态造成泄漏。备选「现在上 Redis」被否——无持久化需求。备选「只加清理不抽接口」被否——接口化成本低且配合未来服务端分层。

### D8 web 测试：vitest + testing-library

vitest 已在 workspace catalog，复用。首测覆盖：`labels`（纯函数）、`api/client`（fetch 封装，mock）、`useRoom`（runner 订阅）。不做 UI 快照（后续 e2e 再说）。

### D9 CI 门禁：新增 PR job

新增**独立 `ci.yml`**（PR 触发）job：`pnpm install` + `turbo run test typecheck lint`，与 `cd.yml` 部署解耦（不阻塞部署）。

### D10 服务端 index.ts 分层

把 `index.ts`（250 行巨石）拆为 `routes/`（Hono 路由，含 health）、`socket/`（Socket.io 初始化 + 消息分发）、`services/`（对局编排：开局建 runner、广播快照/结算）、`store/`（房间状态）。`index.ts` 瘦身为 `createApp()` 组装入口（集成测试依赖它起自定义端口，工厂签名保持）。备选「保持单文件」被否——HTTP/socket/编排三件事耦合，后续加 REST 或改消息处理都要在同一个文件里动刀。

## Risks / Trade-offs

- [Next 16 路由写法与训练记忆不同] → 动工前先读 `node_modules/next/dist/docs/`，路由部分小步验证。
- [重构破坏现有行为] → 以 turbo typecheck/test/lint + 既有集成测试为安全网；热座/联机分别本地冒烟。
- [GameBoard 抽象过度] → 保持纯展示、props 驱动，不塞任何数据获取；若热座/联机分支差异过大则回退为两个薄壳。
- [路由切换影响收藏/书签] → 旧页面本就无 URL（纯单页），无既有外链，无迁移负担。
- [房间清理改变可见行为] → 仅清理「开局前空房」与「已结束对局」，不触碰进行中对局；spec 已明确。

## Migration Plan

纯重构，无数据迁移、无 feature flag，单 PR 合并；服务端房间清理向后兼容（仍内存存储）。回滚：revert 提交即可。验证：合并前 CI 全绿 + 本地三模式冒烟（热座、联机、直达链接）。
