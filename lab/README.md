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
  "commit": "<lab/25-design-lab 的 sha>",
  "files": [
    { "src": "src/styles.css", "hash": "sha256:<hex>" },
    { "src": "src/app/components/Sheet.tsx", "hash": "sha256:<hex>" }
  ]
}
```

- `commit`：镜像所对应的主库基线 commit（`lab/25-design-lab` 的 sha）
- `files[].src`：主库路径；lab 镜像路径 = 把前缀 `src/` 换成 `lab/`
- `files[].hash`：文件内容 sha256（`node:crypto`，对 lab 镜像文件计算；镜像逐字，故等于对 src 计算）
- `files` 按 `src` 字典序稳定排列
- 重新生成：`node lab/generate-baseline.mjs`

守卫测试：`src/lab.guard.test.ts`（主 tsconfig/build 不含 lab、src 不 import lab、基线哈希与镜像一致）。
