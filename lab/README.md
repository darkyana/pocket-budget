# pocket-budget 设计实验室（lab）

独立 Vite 应用：`pnpm lab`（端口 5174，strictPort）。与主 app 完全隔离——不共享 vite 配置、PWA、`__CODE_UPDATED_AT__` define，主 app 的 `pnpm build` / `pnpm test` / `pnpm design:scan` 不感知 lab。

## 结构

- `vite.config.ts` / `tsconfig.json` / `index.html` / `main.tsx` / `lab.css` — lab 自有骨架
- `styles.css`、`app/`、`core/`、`storage/{migrate,voucher}.ts` — 主库对应文件的**逐字镜像**（`src/xxx` → `lab/xxx`）
- `storage/db.ts` — 唯一替换件：内存夹具层（`loadState` 返回 `fixtures.ts` 的虚构数据，`saveState` 落内存）
- `fixtures.ts` — 虚构示例数据（词汇表见 docs/agents/CODING_STANDARDS.md）
- `gallery/` — 组件画廊（原子 → 复合 → 页面）与四屏仿真（Today / Records / Settings / QuickRetro）

## BASELINE.json 格式（#28 sync/pushback 的依赖）

```json
{
  "commit": "<主库 commit sha>",
  "files": [
    { "src": "src/styles.css", "hash": "sha256:<hex>" },
    { "src": "src/app/components/Sheet.tsx", "hash": "sha256:<hex>" }
  ]
}
```

- `commit`：镜像所对应的主库基线 commit。重生成时默认取当前 HEAD（与 `lab:sync` 写入后的推进语义一致）；需要复位到指定基点时用 `--commit <sha>` / `--ref <ref>` 显式指定，无法解析的引用会报错退出且不写文件
- `files[].src`：主库路径；lab 镜像路径 = 把前缀 `src/` 换成 `lab/`
- `files[].hash`：文件内容 sha256（`node:crypto`，对 lab 镜像文件计算；镜像逐字，故等于对 src 计算）
- `files` 按 `src` 字典序稳定排列
- 重新生成：`node lab/generate-baseline.mjs`
- 新文件发现：`lab:sync` 按同一枚举规则（固定清单 + components / pages / core 下的 .ts/.tsx，排除 *.test.ts）扫描 src，发现清单外的应镜像文件时 dry-run 会报告「发现新镜像文件」，确认后写入镜像并补进清单

守卫测试：`src/lab.guard.test.ts`（主 tsconfig/build 不含 lab、src 不 import lab、基线清单覆盖全部应镜像文件、基线哈希与镜像一致）。

## 主题变体（#27）

- `variants/*.css` — 候选设计方向的**完整样式表**变体（token 覆盖 + 类规则改动均可）；`harbor-dusk.css` 为预置演示（冷调配色、胶囊按钮、浮坞导航、描边卡片）。`baseline` 不是文件：它就是镜像 `styles.css` 本身（`?raw` 引入），保证基线永不漂移。
- 变体切换：右下角浮动切换器（`gallery/Variants.tsx`）热切换，画廊与四屏同时换肤；当前变体写入 URL `?variant=<id>`，带参打开直接进入该变体。
- 变体发现：运行时 `import.meta.glob('../variants/*.css', { query: '?raw', eager: true })`，新增 css 文件即自动出现在切换器（id = 文件名去扩展名，按字典序）。
- 纯逻辑（URL 参数、id 发现）在 `lab/variant.ts`，测试 `lab/variant.test.ts` / `lab/variants.test.ts`，跑法：`pnpm test:lab`（独立于主 `pnpm test`）。
