## 1. 依赖与协议

- [x] 1.1 安装 `socket.io`、`socket.io-client`，验证 `package.json` 新增依赖、安装成功
- [x] 1.2 定义消息协议类型 `protocol.ts`（create/join/ready/start/action/snapshot/gameOver/error），验证 `tsc` 通过

## 2. 服务端（src/server）

- [x] 2.1 实现房间管理 `room.ts`（创建/加入/座位分配/准备状态/房主开局校验），验证单元测试通过
- [x] 2.2 实现 Socket.io 服务入口 `index.ts`：创建/加入/准备/开始/意图处理，验证能启动服务
- [x] 2.3 服务端持有 `Game` 实例，按规则加载插件（国标/四川），收到 action 调 `game.apply`，验证非法意图被拒绝、合法意图推进对局
- [x] 2.4 实现快照按座位广播（每座位仅见自己手牌），验证单元测试通过
- [x] 2.5 对局结束广播结算结果，验证测试通过

## 3. 前端联机（src/game + src/components）

- [x] 3.1 实现 `NetworkRunner`（socket 封装，暴露与本地 Runner 相同的 snapshot/apply 接口），验证 `tsc` 通过
- [x] 3.2 实现 `RoomView`（创建/加入房间 UI），验证能创建房间并展示房间码
- [x] 3.3 `useHotseatGame` 支持联机模式（本地热座 / 联机对战二选一），验证两种模式均可启动

## 4. 端到端验证

- [x] 4.1 编写服务端集成测试：4 名玩家加入 → 准备 → 开局 → 出牌流转 → 和牌结算，验证国标与四川规则均可跑通
- [x] 4.2 全量单测、`npm run typecheck`、`npm run lint`、`npm run build` 全部通过，验证引擎与热座无回归
