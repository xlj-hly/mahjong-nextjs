## Purpose

定义 Turborepo monorepo 的目录结构、包划分、依赖关系与工程化配置，使前端（Next.js）和服务端（Hono + Socket.io）可独立构建、测试与部署，共享编译后的游戏引擎与协议类型。

## ADDED Requirements

### Requirement: Monorepo 目录结构

系统 SHALL 采用 pnpm workspace + Turborepo 的 monorepo 结构，包含 `apps/web`（Next.js 前端，部署 Vercel）、`apps/server`（Hono + Socket.io 后端，部署 Render）、`packages/game-core`（游戏引擎）、`packages/protocol`（网络协议）四个包。

#### Scenario: 目录结构正确

- **WHEN** 迁移完成
- **THEN** 项目根目录包含 `apps/web`、`apps/server`、`packages/game-core`、`packages/protocol` 四个子包，每个子包有独立的 `package.json` 与 `build` 脚本

### Requirement: 共享包编译产物

系统 SHALL 将共享包编译为 `dist` + `.d.ts` 产物，通过 `exports` 字段对外提供编译产物，供前端和服务端消费。

#### Scenario: 共享包编译

- **WHEN** 执行 `pnpm turbo build`
- **THEN** `packages/game-core` 与 `packages/protocol` 产出 `dist/`（含 `.js` 与 `.d.ts`），`exports` 指向编译产物

### Requirement: 共享包依赖

系统 SHALL 将游戏引擎（规则无关核心 + 规则插件）抽取为 `@mahjong/game-core` 共享包，网络协议类型抽取为 `@mahjong/protocol` 共享包，前端和服务端通过 workspace 协议引用。

#### Scenario: 前端引用共享包

- **WHEN** `apps/web` 构建
- **THEN** 它通过 `@mahjong/game-core` 和 `@mahjong/protocol` 引用共享代码（解析到编译产物），不直接引用 `packages/` 下的源码路径

#### Scenario: 服务端引用共享包

- **WHEN** `apps/server` 启动
- **THEN** 它通过 `@mahjong/game-core` 和 `@mahjong/protocol` 引用共享代码（解析到编译产物）

### Requirement: 游戏引擎包

`packages/game-core` SHALL 包含当前 `src/game/core/` 和 `src/game/rules/` 的全部代码与测试，并对外导出引擎与规则的全部公开 API，包括类型 `Action`、`Snapshot`、`Seat`、`Tile`、`Suit`、`Meld` 与函数/类 `Game`、`Wall`、`decompose`、`tileLabel`、`sortTiles`、`seatName`、`RulesPlugin`、`guobiao`、`sichuan`、`createRunner`、`Runner`。

#### Scenario: 测试随包迁移

- **WHEN** 游戏引擎迁移到 `packages/game-core`
- **THEN** 所有现有测试（tile、decompose、state-machine、guobiao、sichuan、runner）在新位置通过

#### Scenario: 公开 API 完整

- **WHEN** 前端与服务端从 `@mahjong/game-core` 导入
- **THEN** 能获取 `Action`、`Snapshot`、`Seat`、`Tile`、`Suit`、`Meld`、`seatName`、`Game`、`Wall`、`decompose`、`tileLabel`、`sortTiles`、`RulesPlugin`、`guobiao`、`sichuan`、`createRunner`、`Runner` 等全部公开符号

### Requirement: 协议包

`packages/protocol` SHALL 包含当前 `src/game/network/` 的协议类型定义与 `NetworkRunner`，声明 `socket.io-client` 依赖并定义 `exports` 入口，对外导出消息类型与客户端封装。

#### Scenario: NetworkRunner 可用

- **WHEN** 前端引用 `@mahjong/protocol`
- **THEN** 能获取 `createNetworkRunner` 函数、`NetworkRunner` 类型与所有消息类型（`ClientMessage`、`ServerMessage`、`RoomMember` 等）

#### Scenario: 依赖完整

- **WHEN** 协议包被消费
- **THEN** 它能正确解析 `socket.io-client` 与 `@mahjong/game-core`（二者均为其 `dependencies`）

### Requirement: Hono + Socket.io 服务端

`apps/server` SHALL 使用 Hono 框架作为 HTTP 层（中间件、健康检查、CORS、日志），Socket.io 作为实时通信层，两者共存于同一个 HTTP Server，实现当前 `src/server/` 的等价功能：房间管理、WebSocket 连接、意图处理、快照广播、对局结束广播。服务端 SHALL 保留可测试的工厂函数 `createApp()`（返回 `{ httpServer, io }`，不立即监听）并读取 `process.env.PORT`。

#### Scenario: 功能等价

- **WHEN** Hono + Socket.io 服务端运行
- **THEN** 它提供与当前 Socket.io 服务端等价的功能（创建/加入房间、准备、开局、意图上报、快照广播、对局结束广播）

#### Scenario: Hono HTTP 层可用

- **WHEN** 服务端运行
- **THEN** Hono 提供 `/health` 等 HTTP 端点，并应用 CORS 与日志中间件，Socket.io 实时通信不受影响

#### Scenario: 可测试工厂与端口

- **WHEN** 服务端被测试或部署
- **THEN** `createApp()` 返回未监听的 `{ httpServer, io }` 供测试自定义端口；生产启动读取 `process.env.PORT`

### Requirement: Next.js 前端

`apps/web` SHALL 保留当前 `src/app/` 和 `src/components/` 的全部页面与组件（含 `public/` 静态资源），通过 `@mahjong/protocol` 的 `NetworkRunner` 连接服务端，内部 `@/*` 路径别名保留。

#### Scenario: 热座模式可用

- **WHEN** 用户选择本地热座
- **THEN** 对局正常运行，不依赖服务端

#### Scenario: 联机模式可用

- **WHEN** 用户选择联机对战
- **THEN** 前端通过 Socket.io 连接服务端（经 `@mahjong/protocol` 的 `NetworkRunner`），房间功能正常

### Requirement: 工程化工具链

系统 SHALL 通过根级 `tsconfig.json` 与 `packages/eslint-config/` 统一 TypeScript 编译选项与 ESLint 规则：各包 `tsconfig.json` 通过相对路径 `extends` 继承根配置并按需覆盖（web 覆盖 DOM/jsx/next 插件，node 包继承 ES2022 lib），ESLint 通过 `import` 继承预设并按需覆盖。game-core 与 server 各自的 `vitest.config.ts` 定义本包测试配置（跨包引用经 `resolve.alias` 指向源码）。oxfmt、husky、commitlint、lint-staged 在根级配置。

#### Scenario: 共享 TypeScript 配置

- **WHEN** 各包构建或类型检查
- **THEN** 各包 `tsconfig.json` 通过 `"extends": "../../tsconfig.json"` 继承根配置：`apps/web` 覆盖 `lib`（dom/dom.iterable/esnext）、`jsx`、`plugins`（next）与 `@/*` 路径；`apps/server` 与共享包仅 `extends` + `include: ["src"]`（继承根的 `lib: ["ES2022"]`，不含 DOM）

#### Scenario: 共享 ESLint 配置

- **WHEN** 各包执行 lint
- **THEN** 各包 `eslint.config.mjs` 通过 `import` 继承 `packages/eslint-config/` 的预设（`apps/web` 用 next 预设，其余用 base 预设），本地配置仅覆盖 ignores

#### Scenario: Vitest 按包运行

- **WHEN** 执行 `pnpm turbo test`
- **THEN** game-core 与 server 各自的 `vitest.config.ts` 定义本包测试（`include`、`environment`，server 额外 `resolve.alias` 将 `@mahjong/game-core`/`@mahjong/protocol` 指向源码），`turbo test` 并行在各包运行 `vitest run`，各自只跑本包测试、互不重叠（不并发绑定同一端口）

#### Scenario: 根级命令可用

- **WHEN** 执行 `pnpm turbo build`、`pnpm turbo test`、`pnpm turbo lint`、`pnpm turbo typecheck`
- **THEN** Turborepo 按依赖顺序在各包中执行对应命令

#### Scenario: 类型检查依赖构建产物

- **WHEN** 在未构建过的干净仓库执行 `pnpm turbo typecheck`
- **THEN** Turborepo 先构建上游共享包产出 `dist` + `.d.ts`，再执行各包 `typecheck`，使其能按 `exports.types` 解析 `@mahjong/*` 引用

### Requirement: pnpm Workspace

系统 SHALL 使用 `pnpm-workspace.yaml` 定义 workspace（`apps/*`、`packages/*`），根 `package.json` 配置 Turborepo 管道。workspace 包含 `apps/web`、`apps/server`、`packages/game-core`、`packages/protocol`、`packages/eslint-config` 五个包。

#### Scenario: 安装依赖

- **WHEN** 执行 `pnpm install`
- **THEN** 所有包的依赖正确安装，workspace 内部引用通过 `workspace:*` 协议解析

### Requirement: 部署模型

系统 SHALL 支持前端部署到 Vercel、服务端部署到 Render 的双平台部署模型。前端通过环境变量 `NEXT_PUBLIC_SERVER_URL` 指向服务端地址，服务端通过 `process.env.PORT` 监听端口。部署通过平台绑定 GitHub 仓库的自动化能力完成；本次不落库部署配置文件（`render.yaml`、`vercel.json`、`Dockerfile` 留待后续）。

#### Scenario: 前端部署目标

- **WHEN** `apps/web` 部署到 Vercel
- **THEN** 前端通过 `NEXT_PUBLIC_SERVER_URL` 连接 Render 服务端，热座模式不依赖服务端

#### Scenario: 服务端部署目标

- **WHEN** `apps/server` 部署到 Render
- **THEN** 服务端读取 `process.env.PORT` 启动长驻进程，Socket.io 实时通信正常工作
