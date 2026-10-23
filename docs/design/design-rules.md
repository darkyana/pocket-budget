# Design Rules

The law. Each section = **Intent** (why the rules exist) + checkable rules. Tags: `[machine]` = grep-able by a script, `[agent]` = reviewed one by one by an AI agent against evidence, `[open]` = decision pending. Conformance status lives in `docs/design/design-audit.md`, never here; registries live in `docs/design/`: `Unicon.md` (feature-level implementation exemptions), `motion.md` (motion log), `illustration.md` (illustration log), `icons.md` (icon log).

## Governance

**Intent** — This is a fast-iterating personal-use product. Two things keep it coherent as it evolves: visual decisions made once in one place (tokens), and structure made once in one place (components). Both allow pragmatism — but only through the explicit `Unicon.md` registry, never silently. 

At the current stage, colors, spacing, typography, radii, and z-index are governed centrally; the token set expands gradually — each category joins when a rule demands it, never big-bang.

- [ ] G1 `[machine]` No hard-coded colors in feature code: colors are defined once as design tokens in the centralized token set — `:root` of `src/styles.css` — and feature code references them by name (`var(--*)`). No hex or rgb(a) literals in `src/app/**`. (Spacing, typography, radii, shadows are reserved for future application of this law; they join as their token sets are added.) 裸值的唯一合法位置是 `:root` 的 token 定义本身（`styles.css` `:root` 之外同样禁止颜色字面量）。例外：`index.html` 的 `theme-color`（HTML 无法引用 CSS 变量），由 `design-scan` 断言其值与 `--accent` 相等。
- [ ] G2 `[machine]` Motion, illustration, and icons are exempt from central token governance — they may be defined locally in feature code. The logging duty still applies: every motion (animation, transition, scroll behavior) is registered in `motion.md`, every illustration in `illustration.md`, and every icon in `icons.md`.
- [ ] G3 `[agent]` Use components instead of feature-level implementation, unless that feature-level implementation is registered in `Unicon.md`.

## 词汇 Vocabulary

**Intent** — One vocabulary so rules, scans, reviews, and registries mean the same thing by the same words. Definitions only; ladder tier values live in the 阶梯 entry below — the single place tiers are listed.

- **token（令牌）** — 在 `src/styles.css` `:root` 定义一次的命名变量（如 `--accent`、`--shadow-md`）。设计决策只在此处发生，其余代码按名引用（`var(--*)`）。
- **裸值（bare literal）** — 直接写在样式代码里的颜色字面量（`#2f6f4f`、`rgba(0,0,0,.35)`）。颜色类别受管后，`src/app/**` 与 `styles.css` 的 `:root` 之外一律禁止（见 G1）。
- **派生色（derived color）** — 在使用处由既有 token 经 `color-mix()` 计算出的颜色（如 `color-mix(in srgb, var(--over) 15%, var(--card))`）。不是裸值，也不必新设 token；允许轻微色相偏移。
- **阶梯（scale）** — 同一维度按强度排布的固定档位。收敛到少数几档，不按现状逐处 token 化；新档位入阶须先改本词条。现行档位：间距 `2（hairline）/4/8/12/16/24/32`、字号 `12/13/14/16/20/28`、圆角 `4/8/12/16/999`、z-index `5/10/30/40/50/60`；阴影沿用 `--shadow-sm/md/lg` 三档。
- **hairline（发丝线）** — 1px 细分隔线，本产品的默认分隔语汇（现由 `--line` 承担）；作为间距档位时为 2px（`--space-hairline`），是阶梯中唯一的亚栅格档，仅用于图标与文字的咬合间隙及行内微调（见 D1）。
- **豁免（exemption）** — 有登记的例外。经 `unicon.md` 登记后方可游离于 token 体系；未登记的偏离按违规处理。

## 数字 Numbers (the hero of this app)

**Intent** — The app's entire value is answering money questions at a glance. Numbers are the hero: one formatting path so ¥ never looks different in two places, digits that align in columns, and a hierarchy that puts the decision number first.

- [ ] N1 `[machine]` All currency display goes through `money()` or `moneyExact()` — nothing else formats currency (no `¥`, `toFixed`, `toLocaleString` outside `format.ts`). `money()` = glanceable numbers (whole yuan); `moneyExact()` = exactly 2 decimals wherever a number must round-trip (records feed, editing, reconciliation).
- [ ] N2 `[machine]` Amounts render with tabular figures (等宽数字): `font-variant-numeric: tabular-nums` on numeric displays.
- [ ] N3 `[machine]` Thousands separator: amounts ≥ 1,000 render grouped (`¥1,234.50`), never ungrouped (`¥1234.50`). Implemented inside the two currency functions in `format.ts` only — no call site ever formats.

## 颜色语义 Color semantics

**Intent** — Color is information, not decoration. The product answers「还能花多少」; red, green, and orange must each mean exactly one thing so the answer is readable at a glance and never cries wolf.

- [ ] C1 `[agent]` Red (`--over`) = overspent/over budget ONLY, plus destructive actions (delete). Never decorative.
- [ ] C2 `[agent]` Green (`--ok` / `--accent`) = positive/available: still-can-spend, `省`, refund (回血), on-track projection. Green also serves as brand accent (links, active states).
- [ ] C3 `[agent]` Orange (`--warn`) = near planned or unpaid/needs attention. Triggers: ratio ≥ 80%, week left < 20% of week budget, unpaid fixed-expense items.

## 密度与节奏 Density & rhythm

**Intent** — A one-hand phone app read in seconds: rhythm comes from a consistent spacing scale, and each screen has one dominant number — the decision — with everything else subordinate to it.

- [ ] D1 `[machine]` Spacing values (margin/padding/gap), in styles.css or inline, are multiples of 4 (4·8·12·16·24·32). This constrains values only — it is not central token governance of spacing. 唯一例外：hairline（2px）档，仅用于图标与文字的咬合间隙及行内微调。

- [ ] D2 `[agent]` Every screen has exactly one dominant number — the one answering that screen's primary question — rendered visibly larger than all other numbers on the screen. Which number dominates is judged per screen (Today's, for instance, is 「还能花」); this law fixes the hierarchy, not the concept.

## 阶梯 Ladder

**Intent** — Rhythm must be reproducible and greppable: spacing, type sizes, radii, and layers take values from the vocabulary's fixed ladders, so humans and `design-scan` enforce the same list.

- [ ] G4 `[machine]` 间距、字号、圆角、z-index 取值 ∈ 词汇区定义的阶梯（token 引用或等值裸值白名单），新档位入阶须先改词汇区。阴影与遮罩已 token 化，同样禁裸值。

## 禁忌 Banned

**Intent** — Pet peeves: patterns that erode readability or trust. Hard bans, so they never creep in "just this once".

- [ ] B1 `[machine]` No pie charts (if ever introduced, max 4 slices). Current visualization vocabulary: progress bars, calendar heatmap, dual-bar comparison.
- [ ] B2 `[machine]` No gradient/glow on numbers (no `text-shadow` or gradients on numeric text).
- [ ] B3 `[open]` ??? ← the thing YOU hate most goes here
