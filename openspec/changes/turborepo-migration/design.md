## Context

当前项目是单包 Next.js 结构，`src/game/` 是纯 TS 游戏引擎，`src/server/` 是简易 Socket.io 服务端（`tsx` 直跑、无构建），`src/components/` + `src/app/` 是前端。依赖耦合、代码组织混乱、构建无法分层。需要迁移到 monorepo 使前后端可独立构建和部署（前端 Vercel，服务端 Render），并把服务端重建为规范工程（编译构建 + 测试 + 类型检查）。

## Goals / Non-Goals

**Goals:**

- 前端（Next.js）部署到 Vercel，服务端（Hono + Socket.io）部署到 Render
- 服务端重建为规范工程：编译为 `dist` 后启动，具备 build/test/lint/typecheck
- 游戏引擎与协议类型作为共享包，编译为 `dist` + `.d.ts`，两端复用
- 工程化工具链在根级提供基础配置，各包按类型采用
- 迁移后所有现有测试通过，功能无回归

**Non-Goals:**

- 不实现新业务功能
- 不配置 CI/CD 流水线（GitHub Actions）
- 不落库部署配置文件与 Docker（`render.yaml`、`vercel.json`、`Dockerfile` 留待后续），部署靠平台 GitHub 绑定
- 不做断线重连、观战等功能

## Decisions

### D1: 包管理器切换为 pnpm

当前使用 npm（`package-lock.json`）。切换为 pnpm：

- monorepo workspace 支持更成熟
- 依赖隔离更严格（hoisted 但 phantom deps 受控）
- 磁盘效率更高（hard links）

迁移步骤：删除 `node_modules` 和 `package-lock.json`，创建 `pnpm-workspace.yaml`（`packages: ["apps/*", "packages/*"]`，另含 `allowBuilds` 许可 esbuild / unrs-resolver 的依赖构建脚本、`catalog` 统一 typescript / vitest 版本），根 `package.json` 增加 `packageManager` 字段固定 pnpm 版本，`pnpm install` 生成 `pnpm-lock.yaml`。

### D2: Turborepo 构建管道

共享包与服务端均编译为 `dist`，`build` 按依赖拓扑排序执行（先构建被依赖的包）。根 `turbo.json`：

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalEnv": ["NEXT_PUBLIC_SERVER_URL"],
  "globalDependencies": ["**/.env*"],
  "tasks": {
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**"]
    },
    "test": {},
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- `build` 依赖上游包先 `build`（`^build`），保证消费方拿到最新的 `dist` 与 `.d.ts`
- `dev` 依赖 `^build`：首次运行先产出共享包 `dist`，否则 `apps/web` 无法解析 `@mahjong/*` 的 `exports` 产物；开发期间靠 `tsdown --watch`（game-core / protocol 的 `dev` 任务）持续重编译
- `typecheck` 依赖 `^build`：消费包 `tsc --noEmit` 按 `exports.types → dist/*.d.ts` 解析，需先有 `dist`；`test` 例外——走 vitest `resolve.alias` 指向源码，故无依赖
- `test` / `lint` 无依赖、可并行
- `globalEnv` / `globalDependencies` 让 `NEXT_PUBLIC_SERVER_URL` 与 `.env*` 变更触发缓存失效，避免 web 构建产物陈旧

### D3: 游戏引擎包 `@mahjong/game-core`

从 `src/game/` 迁移到 `packages/game-core/`：

- `src/game/core/` → `packages/game-core/src/core/`
- `src/game/rules/` → `packages/game-core/src/rules/`
- `src/game/runner.ts` → `packages/game-core/src/runner.ts`
- `src/game/cli.ts` → `packages/game-core/src/cli.ts`
- `src/game/test-utils.ts` → `packages/game-core/src/test-utils.ts`（内部测试工具，不对外导出）
- 所有 `*.test.ts` 随源码迁移
- 新增入口 `src/index.ts`，统一 re-export 全部公开 API

公开导出（覆盖前端组件与服务端的实际导入）：`Game`、`Wall`、`decompose`、`tileLabel`、`sortTiles`、`seatName`、`RulesPlugin`、`guobiao`、`sichuan`、`createRunner`、`Runner`，以及类型 `Action`、`Snapshot`、`Seat`、`Tile`、`Suit`、`Meld`、`GamePhase` 等。`test-utils.ts` 不进入 `index.ts`。

`package.json`（编译导出）：

```json
{
  "name": "@mahjong/game-core",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown src/index.ts --format esm --dts",
    "dev": "tsdown src/index.ts --format esm --dts --watch",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "tsdown": "^0.22.14",
    "vitest": "^4",
    "typescript": "^5"
  }
}
```

注：tsdown 在 `platform: node` 下默认输出 `.mjs`/`.d.mts`，与 `exports` 字段（`./dist/index.js` + `./dist/index.d.ts`）不符，故每个库包需配 `tsdown.config.ts`（`outExtensions: () => ({ js: '.js' })`）固定回 `.js`（`.d.ts` 由 `.js` 自动推导）；protocol 同理。

注：`runner.ts` 的 `createRunner` 默认参数硬依赖 `guobiao`（顶层 `import`），导致 game-core 产物必然包含国标番种目录，前端无法 tree-shake。本次接受（与现状一致），后续可考虑将规则拆为独立包。

### D4: 协议包 `@mahjong/protocol`

从 `src/game/network/` 迁移到 `packages/protocol/`：

- `protocol.ts` → `packages/protocol/src/protocol.ts`
- `runner.ts` → `packages/protocol/src/network-runner.ts`
- 新增入口 `src/index.ts`，re-export 消息类型与 `createNetworkRunner` / `NetworkRunner`

依赖 `@mahjong/game-core`（`Action` / `Snapshot` / `Seat` 类型）与 `socket.io-client`（`network-runner.ts` 直接使用）。

`package.json`（编译导出）：

```json
{
  "name": "@mahjong/protocol",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown src/index.ts --format esm --dts",
    "dev": "tsdown src/index.ts --format esm --dts --watch",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mahjong/game-core": "workspace:*",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": { "tsdown": "^0.22.14", "typescript": "^5" }
}
```

### D5: Hono + Socket.io 服务端 `apps/server`

服务端**重建为规范工程**（非直接迁入简易版），采用 Hono + Socket.io 共存架构：

- **Hono**：HTTP 框架层，提供 `cors` 中间件、日志中间件、`/health` 健康检查，为未来 REST API 预留扩展点。
- **Socket.io**：实时通信层，处理房间管理、意图上报、快照广播、对局结束广播。
- 两者共享同一个 Node.js HTTP Server。
- **保留 `createApp()` 工厂**（返回 `{ httpServer, io }`，不立即监听），供集成测试自定义端口；生产入口读取 `process.env.PORT ?? 3001` 后监听。

结构示例：

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createAdaptorServer } from '@hono/node-server'
import { Server } from 'socket.io'

const app = new Hono()
app.use('*', logger())
app.use('*', cors())
app.get('/health', (c) => c.json({ status: 'ok' }))

export function createApp() {
  // createAdaptorServer 创建不监听的 http.Server 并把 Hono 接入请求流；
  // 若该 API 与版本不符，可改用 serve({ fetch: app.fetch })（不传 port）实现等价效果。
  const httpServer = createAdaptorServer({ fetch: app.fetch })
  const io = new Server(httpServer, { cors: { origin: '*' } })
  // io.on('connection', ...) 复用现有意图处理逻辑（消息格式不变）
  return { httpServer, io }
}

const PORT = Number(process.env.PORT ?? 3001)
const { httpServer } = createApp()
httpServer.listen(PORT)
```

`room.ts` 的房间管理逻辑与 `index.ts` 的意图处理逻辑逻辑不变迁入，协议消息格式不变。

`package.json`：

```json
{
  "name": "@mahjong/server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format esm",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mahjong/game-core": "workspace:*",
    "@mahjong/protocol": "workspace:*",
    "hono": "^4",
    "@hono/node-server": "^1",
    "socket.io": "^4.8.3"
  },
  "devDependencies": {
    "tsx": "^4",
    "tsup": "^8",
    "vitest": "^4",
    "typescript": "^5"
  }
}
```

注（与实际实现对齐）：devDependencies 另含 `socket.io-client`（集成测试模拟客户端）、`@types/node`、`eslint`、`@mahjong/eslint-config`（typecheck/lint 需要）；typescript / vitest 经根 `catalog:` 统一版本。`build` 经 `tsup.config.ts` 配置（entry `src/index.ts`、esm、target node20、sourcemap、dts、clean，`@mahjong/*` 与 hono / socket.io 全部 external，运行时从 node_modules 解析）；`start` 为 `node --enable-source-maps dist/index.js`。生产 `listen` 包在 `isMain` 守卫内（比对 `import.meta.url` 与 `process.argv[1]`），模块被测试 import 时不自动监听。

### D6: Next.js 前端 `apps/web`

从当前项目迁移到 `apps/web/`：

- `src/app/` → `apps/web/src/app/`
- `src/components/` → `apps/web/src/components/`
- `public/` → `apps/web/public/`
- `next.config.ts`、`eslint.config.mjs` 等配置迁入，`tsconfig.json` 按 web 类型配置（`@/*` → `./src/*` 路径别名保留）

包名为 `@mahjong/web`。

前端消费共享包的**编译产物**（`dist`），因此 `next.config.ts` 无需 `transpilePackages`（实现时对照 Next 16 文档验证一次；若因版本行为仍需转译源码包，再显式添加 `transpilePackages`）。

导入改写（从 `@/game/*` 改到共享包），涉及全部 5 个文件：

- `useHotseatGame.ts`：`createRunner` / `Runner` / `guobiao` / `sichuan` / `Action` / `Snapshot` / `RulesPlugin` / `Seat` → `@mahjong/game-core`
- `page.tsx`：`createNetworkRunner` → `@mahjong/protocol`；`@/components/*`、`@/components/board.css` 保持 `@/*` 不变
- `BoardView.tsx`：`Action` / `seatName` / `Seat` / `Meld` / `tileLabel` / `Suit` → `@mahjong/game-core`
- `RoomView.tsx`：`NetworkRunner` → `@mahjong/protocol`；`Snapshot` / `Action` / `seatName` / `tileLabel` / `Suit` / `Meld` → `@mahjong/game-core`
- `TileView.tsx`：`Tile` / `tileLabel` → `@mahjong/game-core`

### D7: 工程化配置

- **TypeScript**：根级 `tsconfig.json` 作为唯一共享基底，各包 `tsconfig.json` 通过相对路径 `"extends": "../../tsconfig.json"` 继承（monorepo 深度统一为两级，相对路径一致）。根配置关键选项：target ES2022、module ESNext、moduleResolution bundler、strict、`lib: ["ES2022"]`（**显式去掉 TS 默认注入的 DOM**，web 包自行覆盖）、noEmit、**不开 `noUncheckedIndexedAccess`**（现有源码未按该选项编写）、**不开 incremental**（各包独立 `tsc --noEmit`，不做增量缓存）。`apps/web` 本地覆盖 `lib`（dom/dom.iterable/esnext）、`allowJs`、`jsx: react-jsx`、`plugins: [next]`、`paths: {"@/*": ["./src/*"]}`；`apps/server` 与共享包 `extends` + `include: ["src"]`（继承根的 `lib: ["ES2022"]`，不含 DOM），其中 `apps/server` 与 `game-core` 额外 `"types": ["node"]`（node 环境下 vitest / tsx 需要），`protocol` 无需。共享包的 `@mahjong/*` 引用通过 workspace 软链 + `exports` 解析，**不在根级配置 `paths`**。
- **ESLint**：`packages/eslint-config/`（`@mahjong/eslint-config`）导出可复用的 flat config 预设（`base.mjs` 为基础 typescript-eslint 规则，`next.mjs` 为 base + eslint-config-next 覆盖）。**不引入 prettier / `@next/eslint-plugin-next` / `eslint-plugin-turbo` 那一套**（项目用 oxfmt 非 prettier，web 已用 eslint-config-next）。各包 `eslint.config.mjs` 通过 `import` 继承预设并按需覆盖 ignores（web 忽略 `.next/`，server 与共享包忽略 `dist/`）。game-core / protocol / server / web 四包均提供 `lint` 脚本（`eslint .`，并将 `eslint` 与 `@mahjong/eslint-config` 列为 devDependencies）；eslint-config 无源码不 lint。
- **oxfmt**：根级 `.oxfmtrc.json` 保留，忽略规则调整为匹配各包（`apps/*`、`packages/*` 下的 `dist`、`.next`、`.turbo`）。
- **Vitest**：game-core 与 server 各自提供 `vitest.config.ts`（protocol 无测试），定义本包的 `environment` 与 `include`；server 的配置额外用 `resolve.alias` 将 `@mahjong/game-core` / `@mahjong/protocol` 指向源码目录（避免测试依赖先构建）。各包 `test` 脚本就是 `vitest run`，`turbo test` 并行在各包执行、各自只跑本包测试，互不重叠（避免 server 集成测试端口 3099 被并发绑定）。**不设根级 `vitest.workspace.ts`**——vitest 工作区与 turbo 按包执行模型不兼容（从包目录运行 `vitest run --project <name>` 找不到父级 workspace 文件）。
- **husky / commitlint / lint-staged**：根级保留，`.husky/` 钩子命令维持 `npm` / `npx` 不变（不切换 pnpm）；`.gitignore` 增加 `dist/`、`.turbo/` 等，去掉根锚定写法。
- **根 package.json**：scripts 映射为 `dev`/`build`/`test`/`lint`/`typecheck` = `turbo run <task>`，`fmt`/`fmt:check` 保留 oxfmt，`prepare` = husky；`packageManager` 固定 pnpm 版本；devDependencies 只挂跨包根级工具（turbo、husky、commitlint、oxfmt、lint-staged），typescript / vitest 版本由 `pnpm-workspace.yaml` 的 `catalog:` 统一管理、按需进入各包 devDependencies，tsx / tsup 等仅单包使用的工具下放到对应包。

### D8: 依赖解析与类型别名（修正）

共享包通过 pnpm workspace 软链 + `exports`（指向 `dist`）解析，**不配置根级 `paths`**。仅 `apps/web` 内部保留 `@/*` → `./src/*` 别名。前端通过 `NEXT_PUBLIC_SERVER_URL` 读取服务端地址。

### D9: NetworkRunner 不变

服务端保留 Socket.io，客户端的 `NetworkRunner`（`socket.io-client`）**无需改动**。协议消息格式不变，API 签名不变。唯一变化是导入路径从 `@/game/network/runner` 改为 `@mahjong/protocol`。

### D10: 部署模型（本次仅约定，不落库配置）

- **前端**（`apps/web`）：Vercel，Next.js 标准部署；读取 `NEXT_PUBLIC_SERVER_URL` 指向服务端。
- **服务端**（`apps/server`）：Render，Web Service 长驻进程；读取 `process.env.PORT`。
- **自动化部署**：靠 Vercel / Render 绑定 GitHub 仓库的平台能力触发（monorepo 下 Vercel 项目 Root Directory 指向 `apps/web`，Render 服务目录指向 `apps/server`），**本次不落库** `render.yaml` / `vercel.json` / `Dockerfile`，后续单独变更补齐。
- **CORS**：Hono 与 Socket.io 均需配置允许 Vercel 域名（当前阶段可先 `*`，上线前收紧）。

## Risks / Trade-offs

- [Hono + Socket.io 共存增加服务端复杂度] → 职责清晰（Hono 管 HTTP，Socket.io 管实时），Hono 为未来 REST API、日志、中间件提供扩展点
- [编译导出增加构建步骤] → 换取干净的类型产物（`.d.ts`）、web 端不依赖 Next 的源码转译行为；跨包联调用 `tsdown --watch` / `turbo dev`
- [Render 免费计划有冷启动延迟] → 服务端空闲后休眠，首次请求需唤醒；可用外部 ping 保活
- [pnpm 切换有一次性成本] → 删除 `node_modules` + `package-lock.json`，重新 `pnpm install`
- [Turborepo 学习曲线] → 个人项目影响小，配置简单

## Deployment

- 前端 `apps/web` → Vercel；服务端 `apps/server` → Render
- 环境变量：前端 `NEXT_PUBLIC_SERVER_URL`，服务端 `PORT`
- CORS 允许 Vercel 域名
- 部署配置文件（`render.yaml`、`vercel.json`、Docker）不在本次范围，靠平台 GitHub 绑定在后台配置

## Migration Plan

1. 创建 `pnpm-workspace.yaml`、根 `turbo.json`，切换 pnpm，验证 `pnpm install`
2. 创建 `packages/game-core/`：迁移 `src/game/`，新建 `index.ts` 补全导出，加 `tsdown` 构建，验证测试通过
3. 创建 `packages/protocol/`：迁移 `src/game/network/`，补 `socket.io-client` 依赖与 `exports`/入口，验证 `tsc` 通过
4. 创建 `apps/server/`：重建 Hono + Socket.io 规范工程（`createApp()` 工厂、`PORT`、CORS/日志/健康检查），迁入 `room.ts` 与测试，验证 `build`/`test`/`typecheck` 通过
5. 创建 `apps/web/`：迁移 `src/app/`、`src/components/`、`public/`、配置，改写全部导入，验证 `next build` 成功
6. 更新工程化：`.gitignore` / `.oxfmtrc.json` / lint-staged 适配多包结构（`.husky/` 钩子命令维持 `npm` / `npx` 不变）
7. 删除旧的 `src/` 目录、`package-lock.json`、`node_modules`，以及误入仓库根的 create-turbo 参考模板目录 `turborepo/`（被其内 `.gitignore` 末尾裸 `*` 整目录忽略、未纳入 git，但与目标结构同名混淆，需物理删除）
8. 全量验证：`pnpm turbo build`、`pnpm turbo test`、`pnpm turbo lint`、`pnpm turbo typecheck` 全部通过
