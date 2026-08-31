## Why

当前项目是单包结构，Next.js 前端和 Socket.io 服务端混在同一个 `src/` 下，`package.json` 只有一份。这导致：

1. **依赖耦合**：前端和服务端共享同一个 `node_modules`，Next.js 的 React/Next 依赖和服务端的 socket.io 混在一起，打包产物臃肿。
2. **代码组织混乱**：游戏引擎、网络协议、前端 UI、服务端逻辑混在同一层，边界模糊。
3. **构建无法分层**：前端和服务端无法独立构建和部署。

迁移到 Turborepo monorepo 后，前端（`apps/web`）和服务端（`apps/server`）各自有独立的 `package.json` 和部署配置，共享代码通过 `packages/` 抽取并编译为可消费的产物。前端部署到 Vercel，服务端部署到 Render。

## What Changes

- 引入 **pnpm workspace + Turborepo**，项目从单包迁移为 monorepo。
- 服务端**重建为规范工程**：引入 **Hono** 作为 HTTP 层（中间件、日志、健康检查、CORS、未来 REST API），**保留 Socket.io** 处理实时通信，两者共享同一个 HTTP Server；具备独立的构建（编译为 `dist`）、测试、类型检查与启动脚本。复用当前 `room.ts` 的房间管理逻辑与意图处理逻辑，协议消息格式不变。
- 游戏引擎（`packages/game-core`）和网络协议（`packages/protocol`）抽取为共享包，**编译为 `dist` + `.d.ts`**，前端和服务端共同消费编译产物。
- 前端（`apps/web`）保留 Next.js，部署到 Vercel。
- 工程化工具链（TypeScript、oxfmt、ESLint、Vitest、husky、commitlint、lint-staged）在根级提供基础配置，各包按类型（web / server / 库）采用对应配置。

## Capabilities

### New Capabilities

- `turborepo-migration`：monorepo 目录结构、共享包、构建管道与部署模型的工程化约定（非业务功能）

### Modified Capabilities

- `mahjong-core`：实现从 `src/game/` 迁移到 `packages/game-core/`，编译产出 `dist` + `.d.ts`，行为不变（无 spec delta）
- `online-play`：服务端重建为 Hono + Socket.io 规范工程，Socket.io 协议消息格式不变，客户端 `NetworkRunner` 不变（无 spec delta）

## Impact

- **目录结构**：从 `src/` 单包迁移到 `apps/` + `packages/` 多包结构
- **包管理**：从 npm 切换到 pnpm
- **构建**：引入 Turborepo 管理构建管道；共享包与服务端编译为 `dist`
- **服务端框架**：引入 Hono 作为 HTTP 框架，Socket.io 保留
- **部署**：前端 Vercel，服务端 Render（本次仅约定部署目标与环境变量，不落库部署配置文件与 Docker，后续再上）
- **不改变**：游戏引擎逻辑、规则插件、UI 组件功能、网络协议（Socket.io 消息格式不变）

## Non-Goals（明确排除）

- **不在本次迁移中实现新的业务功能**（如断线重连、观战、AI 等）
- **不做 CI/CD 流水线配置**（GitHub Actions 等）
- **不落库部署配置文件与 Docker**（`render.yaml`、`vercel.json`、`Dockerfile` 留待后续）；自动化部署靠 Vercel/Render 的平台 GitHub 绑定能力在后台配置，本次仅约定部署目标与环境变量
