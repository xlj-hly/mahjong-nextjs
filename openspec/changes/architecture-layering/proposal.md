## Why

web 端当前把页面、组件、网络访问、状态管理全部堆在少数文件里（`page.tsx` 用 `useState` 做三模式切换、`RoomView.tsx` 412 行四合一、棋盘渲染在热座与联机各写一份、没有 api 层也没有 request 封装）；服务端 `index.ts` 也把 HTTP、Socket.io、消息路由、对局编排全塞在一个 250 行文件里。功能一增加耦合就失控，难以维护。本次以「分层」为目标对整个项目做结构性重构——先把目录结构与代码架构理顺，不引入新机制，后续再按需完善。

## What Changes

- **前端分层**：建立 `app/`（路由页面）、`components/`（纯展示）、`api/`（request 封装 + socket）、`hooks/`（业务状态）、`lib/`（共享工具）的分层结构，替代当前 `components/` 一锅烩。
- **真路由**：单页 `useState` 模式切换改为 `/`、`/hotseat`、`/online`、`/room/[code]` 路由，支持房间直达链接。
- **棋盘渲染去重**：`BoardView` 与 `RoomView` 的 `OnlineBoardInner` 合并为一个共享的纯展示 `GameBoard`，热座与联机只保留数据来源差异。
- **共享工具抽离**：`actionLabel`/`meldLabel`/`voidSuitLabel` 与 `RULES` 注册表、`RuleSelect` 抽到 `lib/`，消除多处复制。
- **request 封装**：新增 `api/client.ts`（HTTP 封装骨架，不含 REST 端点）；`NetworkRunner` 归入 `api/socket.ts`；新增 `useRoom` hook（`useState + useEffect` 订阅替代手搓 `setTick`，并修复断连泄漏）。
- **死代码清理**：删除 `page.module.css`，修正 `layout.tsx` 的 metadata。
- **类型收严（protocol）**：`RoomMember.seat`、`RoomMessage.yourSeat` 从 `number` 改为 `Seat`，`CreateRoomMessage.rule`/`RoomMessage.rule` 统一为 `RuleId`，消除前端 `as 0|1|2|3` 与 `as 'guobiao'|'sichuan'` 强转。
- **web 测试**：为 web 建立 vitest + testing-library，覆盖抽出的共享工具与关键 hook。
- **CI 质量门禁**：新增 PR 触发的 test/typecheck/lint job。
- **服务端分层**：`index.ts` 巨石拆为 `routes/`（HTTP）、`socket/`（消息分发）、`services/`（对局编排）、`store/`（房间状态）四层。
- **服务端房间 store 接口化**：`room.ts` 抽象为接口 + 内存实现，新增「开局前全员离开」与「对局结束」的房间清理。

## Capabilities

### New Capabilities

无（本次不引入新的 capability，新增行为归入已有 `online-play`）。

### Modified Capabilities

- `online-play`: 新增「房间直达链接」「房间清理」两条需求（以 ADDED Requirements 表达，不改动既有需求）。

## Impact

- 前端：`apps/web/src` 几乎全部文件重排到 `app/`、`components/`、`api/`、`hooks/`、`lib/`；`apps/web/package.json` 新增测试依赖（vitest/testing-library）。
- 共享类型：`packages/protocol/src/protocol.ts`（`seat`/`rule` 类型收严，纯类型变更）。
- 服务端：`apps/server/src/` 拆为 `routes/`、`socket/`、`services/`、`store/`；`room.ts` 接口化 + 清理，`index.ts` 瘦身为组装入口。
- CI：新增独立 `.github/workflows/ci.yml`（PR 触发的 test/typecheck/lint 门禁）。
- 对局规则、socket 消息协议格式均不变；热座/联机的用户可见玩法行为不变。
