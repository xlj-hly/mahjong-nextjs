## 1. Monorepo 基础设施

- [x] 1.1 创建 `pnpm-workspace.yaml`（`packages: ["apps/*", "packages/*"]`），根 `package.json` 配置 `packageManager` 固定 pnpm 版本、Turborepo 依赖，以及根 scripts（`dev`/`build`/`test`/`lint`/`typecheck` = `turbo run <task>`、`fmt`/`fmt:check` = oxfmt、`prepare` = husky），验证 `pnpm install` 成功
- [x] 1.2 创建 `turbo.json`（`build` 依赖 `^build` 并输出 `.next/**`/`dist/**`；`typecheck` 依赖 `^build`；`dev` 依赖 `^build` + persistent；`test`/`lint` 无依赖；`globalEnv` 含 `NEXT_PUBLIC_SERVER_URL`），验证 `turbo` 命令可用
- [x] 1.3 创建根 `tsconfig.json`（ES2022/strict/module ESNext/moduleResolution bundler，`lib: ["ES2022"]`、noEmit，不开 `noUncheckedIndexedAccess` 与 incremental），各包 `tsconfig.json` 通过 `"extends": "../../tsconfig.json"` 继承；`apps/web` 覆盖 lib（dom）/jsx/next 插件/`@/*` 路径，`apps/server` 与共享包 `extends` + `include: ["src"]`（server 与 game-core 额外 `"types": ["node"]`）
- [x] 1.4 创建 `packages/eslint-config/`（`@mahjong/eslint-config`）：导出 `base.mjs`（typescript-eslint 基础规则）、`next.mjs`（base + eslint-config-next 覆盖），不引入 prettier / `@next/eslint-plugin-next` / `eslint-plugin-turbo`，各包 `eslint.config.mjs` 通过 `import` 继承对应预设并覆盖 ignores
- [x] 1.5 各包创建 `tsconfig.json` 与 `eslint.config.mjs`：`apps/web` extends 根 `tsconfig.json` + 覆盖 web 选项 + ignores `.next/`；`apps/server` 与共享包 extends 根 `tsconfig.json` + ignores `dist/`；game-core / protocol / server / web 四包加 `lint` 脚本（`eslint .`）；验证 `tsc` 与 `eslint` 在各包可运行

## 2. 共享包

- [x] 2.1 创建 `packages/game-core/`：迁移 `src/game/core/`、`src/game/rules/`、`src/game/runner.ts`、`src/game/cli.ts`、`src/game/test-utils.ts` 及所有测试；新建 `src/index.ts` 补全公开导出（含 `Action`/`Snapshot`/`Seat`/`Tile`/`Suit`/`Meld`/`seatName` 等）；加 `tsdown` 构建（`--dts`），验证 `pnpm --filter @mahjong/game-core test` 与 `build` 通过
- [x] 2.2 创建 `packages/protocol/`：迁移 `src/game/network/protocol.ts`、`src/game/network/runner.ts`；补 `socket.io-client` 依赖与 `exports`/`index.ts` 入口；加 `tsdown` 构建（`--dts`），验证 `tsc` 通过

## 3. 服务端

- [x] 3.1 创建 `apps/server/`：重建 Hono + Socket.io 规范工程——Hono 提供 `cors`/日志中间件/`/health`，Socket.io 处理实时通信，共享 HTTP Server；**保留 `createApp()` 工厂**（返回 `{httpServer, io}`，不立即监听），生产入口读取 `process.env.PORT`；定义 dev/build/start/test/lint/typecheck 脚本，验证 `build` 与 `typecheck` 通过
- [x] 3.2 迁入 `src/server/room.ts` 房间管理逻辑与 `index.ts` 的意图处理逻辑，导入改为 `@mahjong/game-core`/`@mahjong/protocol`，协议消息格式不变，验证功能等价
- [x] 3.3 迁移 `src/server/room.test.ts`（单元测试）与 `src/server/integration.test.ts`（集成测试，适配 `createApp()` 工厂），验证测试通过

## 4. 前端

- [x] 4.1 创建 `apps/web/`：迁移 `src/app/`、`src/components/`、`public/`、`next.config.ts`、eslint 配置，tsconfig 按 web 类型配置（保留 `@/*` → `./src/*`），验证 `next build` 成功
- [x] 4.2 改写全部导入到共享包（`useHotseatGame.ts`/`page.tsx`/`BoardView.tsx`/`RoomView.tsx`/`TileView.tsx` 共 5 个文件），验证热座与联机模式均可启动
- [x] 4.3 验证 Next 16 对编译产物（`dist`）的消费无需 `transpilePackages`（对照 `node_modules/next/dist/docs/`；若需要再显式添加）

## 5. 工程化与清理

- [x] 5.1 创建 game-core 与 server 各自的 `vitest.config.ts`（protocol 无测试）：定义 `environment`/`include`，server 额外 `resolve.alias` 将 `@mahjong/game-core`/`@mahjong/protocol` 指向源码；各包 `test` 脚本为 `vitest run`，验证 `pnpm turbo test` 全部通过、无重复运行与端口冲突
- [x] 5.2 更新 `.gitignore`（去掉根锚定、加 `dist/`、`.turbo/`）与 `.oxfmtrc.json` ignorePatterns 适配多包
- [x] 5.3 lint-staged 配置保留在根 `package.json`；`.husky/` 钩子命令维持 `npm`/`npx` 不变（不切换 pnpm）
- [x] 5.4 删除旧的 `src/` 目录、`package-lock.json`、`node_modules`，以及误入仓库根的 create-turbo 参考模板目录 `turborepo/`，验证 `pnpm install` 重新安装成功

## 6. 全量验证

- [x] 6.1 全量验证：`pnpm turbo build`、`pnpm turbo test`、`pnpm turbo lint`、`pnpm turbo typecheck` 全部通过
