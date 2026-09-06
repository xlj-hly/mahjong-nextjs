## 1. 前置调研

- [x] 1.1 阅读 `node_modules/next/dist/docs/` 确认 Next 16 的路由、`dynamic`、typed routes 写法，产出路由结构结论并记录在 PR 描述

## 2. 共享类型收严（protocol）

- [x] 2.1 将 `protocol.ts` 中 `RoomMember.seat`、`RoomMessage.yourSeat` 改为 `Seat`，`CreateRoomMessage.rule`/`RoomMessage.rule` 统一为 `RuleId` 并重新 build，验证 `pnpm --filter @mahjong/protocol build` 通过且 server/web typecheck 无新增错误

## 3. 前端目录骨架与死代码清理

- [x] 3.1 建立 `app/`、`components/`、`api/`、`hooks/`、`lib/` 目录结构并移动现有文件，验证 `pnpm --filter @mahjong/web typecheck` 通过
- [x] 3.2 删除 `page.module.css`、修正 `layout.tsx` metadata，验证 web build 不再引用已删样式

## 4. 共享工具抽离

- [x] 4.1 将 `actionLabel`/`meldLabel`/`voidSuitLabel` 抽到 `lib/labels.ts`，`RULES` 注册表抽到 `lib/rules.ts`，`RuleSelect` 组件抽到 `components/ui/RuleSelect.tsx`，验证 BoardView/RoomView 改用后 lint 通过、无重复实现

## 5. 棋盘渲染去重

- [x] 5.1 抽 `components/board/GameBoard.tsx`（`{snapshot, onApply}` 纯展示），热座与联机均改用它，验证热座与联机各跑一局行为一致

## 6. request 封装与 hook

- [x] 6.1 新增 `api/client.ts`（HTTP 封装骨架）并配单元测试，验证 client 测试通过
- [x] 6.2 将 `NetworkRunner` 迁至 `api/socket.ts`，新增 `useRoom` hook 用 `useState + useEffect` 订阅 `onUpdate` 并在 unmount 时 disconnect，验证断连/卸载后 socket 关闭

## 7. 真路由

- [x] 7.1 将单页模式切换拆为 `/`、`/hotseat`、`/online`、`/room/[code]` 路由并接入 useHotseatGame/useRoom，验证直达 `/room/<code>` 能自动加入、无效码有提示

## 8. web 测试基建

- [x] 8.1 为 web 配置 vitest + testing-library 并加 `test` 脚本，验证 `pnpm --filter @mahjong/web test` 可运行且首个测试通过

## 9. 服务端房间 store 接口化与清理

- [x] 9.1 将 `room.ts` 收敛为 `RoomStore` 接口 + 内存实现，新增 `leaveRoom` 与空房/结束房清理，`index.ts` 的 disconnect 改调 `leaveRoom`，更新 `room.test.ts` 覆盖清理逻辑，验证 server 测试全绿

## 10. 服务端 index.ts 分层

- [x] 10.1 将 `index.ts` 拆为 `routes/`、`socket/`、`services/`、`store/` 四模块，`index.ts` 瘦身为 `createApp()` 组装入口，验证 `pnpm --filter @mahjong/server typecheck` 通过且集成测试全绿

## 11. CI 质量门禁

- [x] 11.1 新增独立 `ci.yml`（PR 触发）跑 turbo test/typecheck/lint，验证 PR 上 job 正常执行且与 cd.yml 部署解耦

## 12. 收尾验证

- [x] 12.1 全仓 `turbo run typecheck test lint` 通过，本地三模式（热座/联机/直达链接）冒烟通过
