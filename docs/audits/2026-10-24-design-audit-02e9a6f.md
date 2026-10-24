# 口袋账房：设计规则合规快照

> **快照审查 · Snapshot audit at commit `02e9a6f`（2026-10-24）。** 本文是对 `docs/design/design-rules.md` 各规则在当时代码上的逐条核查记录，是证据，不是规格，也不代表当前或预期行为。引用前先核对适用性：`git diff 02e9a6f HEAD -- src/`。规则的现行来源是 `docs/design/design-rules.md` 本身。

审查基线：`main`，`02e9a6f9b985d4843699c656b14ca0eae7d0b0c6`。核查日期：2026-10-24；开始时工作区干净。`[machine]` 规则的结论引用 `scripts/design-scan.mjs` 实跑输出（`node scripts/design-scan.mjs` → "设计扫描通过（全部跟踪文件）"，退出码 0）；`[agent]` 规则逐条静态阅读代码取证。未启动页面做视觉实测。

勾选 = 本次核查通过；未勾 = 不通过或存疑；证据均为 file:line 指针。

## Governance

- [x] **G1** `[machine]` 颜色无裸值 — design-scan 通过（app 颜色 / styles 颜色 / theme-color / inline style 四项检查）。[扫描器](<../../scripts/design-scan.mjs>)
- [ ] **G2** `[machine]` 动效/插画/图标登记义务 — **不通过**。`motion.md` 与 `icons.md` 均为空文件，但代码实际存在 3 组动效（[width 过渡](<../../src/styles.css#L147>)、[transform 过渡](<../../src/styles.css#L392>)、[sheet-in 关键帧](<../../src/styles.css#L455>)，各带 reduced-motion 旁路）与 2 类图标（[页签三图标](<../../src/App.tsx#L11-L13>)、[ChevronLeft](<../../src/app/pages/QuickRetro.tsx#L2>)）。登记缺失，代码本身合规（均为局部定义，允许）。
- [x] **G3** `[agent]` 组件优先于 feature 级实现 — design-scan 类名白名单通过；`src/app/components/` 提供原子组件（SegmentedControl、FormFooter、Sheet），业务限制留在调用方。[组件清单](<../../src/app/components>)、[扫描器白名单](<../../scripts/design-scan.mjs>)

## 数字 Numbers

- [x] **N1** `[machine]`（本次人工核，扫描器未覆盖）货币一律走 `money()`/`moneyExact()` — 全库 `¥`、`toFixed`、`toLocaleString` 仅出现在 [format.ts](<../../src/app/format.ts#L4-L10>) 及其测试；所有调用点均引用两函数。[调用点抽查](<../../src/app/pages/Records.tsx#L17-L29>)
- [x] **N2** `[machine]`（本次人工核）等宽数字 — `tabular-nums` 覆盖 8 处数值样式类（hero-num/sub-num/cal-amt/num 等）。[样式](<../../src/styles.css#L825-L832>)
- [x] **N3** `[machine]`（本次人工核）千分位 — 分组逻辑仅在两函数内实现，测试覆盖 `¥1,234`/`¥1,234,567`。[测试](<../../src/app/format.test.ts#L6-L7>)

## 颜色语义 Color semantics

- [x] **C1** `[agent]` 红 = 超支/破坏性 — `--over` 仅经 [statusColor('over')](<../../src/app/statusColor.ts#L3>)（余额 < 0 或 ratio ≥ 1 时）与 [`.btn-danger`](<../../src/styles.css#L177-L178>)（删除类按钮）出现，无装饰用途。
- [x] **C2** `[agent]` 绿 = 正向/可用，兼品牌强调 — `--ok` 经 statusColor('ok') 用于还能花/省；`--accent` 用于链接、页签激活、表单控件。[示例](<../../src/styles.css#L301-L302>)
- [x] **C3** `[agent]` 橙 = 接近或需关注 — 触发条件与规则一致：ratio ≥ 0.8（[derive.ts:173](<../../src/core/derive.ts#L171-L174>)）、周余 < 周预算 20%（[Today.tsx:142](<../../src/app/pages/Today.tsx#L142>)、[Today.tsx:150](<../../src/app/pages/Today.tsx#L150>)）、未付固定支出（[Today.tsx:210](<../../src/app/pages/Today.tsx#L210>)）。

## 密度与节奏 / 阶梯

- [x] **D1** `[machine]` 间距 4 的倍数（hairline 2px 例外）— design-scan 通过。
- [ ] **D2** `[agent]` 每屏唯一主数 — **今日页不通过**：决策数「还能花」用 `sub-num`（20px，[Today.tsx:66](<../../src/app/pages/Today.tsx#L66>)），而各日常桶余额同为 `sub-num`（[Today.tsx:83](<../../src/app/pages/Today.tsx#L83>)），主数未"明显大于屏上其他数字"。回顾页达标（`hero-num` 28px，[QuickRetro.tsx:76](<../../src/app/pages/QuickRetro.tsx#L76>)）。流水/设置为列表/配置页，无主数诉求，规则未明确此类屏的适用性。
- [x] **G4** `[machine]` 阶梯取值 — design-scan 通过（间距/字号/圆角/z-index）。

## 禁忌 Banned

- [x] **B1** `[machine]` 无饼图 — 现有可视化词汇为进度条/日历热力/双条对比，无饼图。
- [x] **B2** `[machine]` 数字无渐变/发光 — 数值样式无 text-shadow/gradient。
- **B3** `[open]` 待定条目，本次不核查。

## 汇总

15 条规则：12 通过，2 不通过（G2 登记缺失、D2 今日页主数层级），1 待定（B3）。G2 的修复即问题 2 的补登记（已决定暂缓）；D2 是否要把「还能花」升为 `hero-num` 或压低桶数字，留待后续决策。N1–N3 目前无扫描器覆盖，本片为人工核查。
