# Design Rules

The law. Each section = **Intent** (why the rules exist) + checkable rules. Tags: `[machine]` = grep-able by a script, `[agent]` = reviewed one by one by an AI agent against evidence, `[open]` = decision pending. Conformance status lives in `docs/design/design-audit.md`, never here; registries live in `docs/design/`: `Unicon.md` (feature-level implementation exemptions), `motion.md` (motion log), `illustration.md` (illustration log), `icons.md` (icon log).

## Governance

**Intent** — This is a fast-iterating personal-use product. Two things keep it coherent as it evolves: visual decisions made once in one place (tokens), and structure made once in one place (components). Both allow pragmatism — but only through the explicit `Unicon.md` registry, never silently. 

At the current stage, only colors are governed centrally; the token set expands gradually — each category (spacing, typography, radii, shadows) joins when a rule demands it, never big-bang.

- [ ] G1 `[machine]` No hard-coded colors in feature code: colors are defined once as design tokens in the centralized token set — `:root` of `src/styles.css` — and feature code references them by name (`var(--*)`). No hex or rgb(a) literals in `src/app/**`. (Spacing, typography, radii, shadows are reserved for future application of this law; they join as their token sets are added.)
- [ ] G2 `[machine]` Motion, illustration, and icons are exempt from central token governance — they may be defined locally in feature code. The logging duty still applies: every motion (animation, transition, scroll behavior) is registered in `motion.md`, every illustration in `illustration.md`, and every icon in `icons.md`.
- [ ] G3 `[agent]` Use components instead of feature-level implementation, unless that feature-level implementation is registered in `Unicon.md`.

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

- [ ] D1 `[machine]` Spacing values (margin/padding/gap), in styles.css or inline, are multiples of 4 (4·8·12·16·24·32). This constrains values only — it is not central token governance of spacing.

- [ ] D2 `[agent]` Every screen has exactly one dominant number — the one answering that screen's primary question — rendered visibly larger than all other numbers on the screen. Which number dominates is judged per screen (Today's, for instance, is 「还能花」); this law fixes the hierarchy, not the concept.

## 禁忌 Banned

**Intent** — Pet peeves: patterns that erode readability or trust. Hard bans, so they never creep in "just this once".

- [ ] B1 `[machine]` No pie charts (if ever introduced, max 4 slices). Current visualization vocabulary: progress bars, calendar heatmap, dual-bar comparison.
- [ ] B2 `[machine]` No gradient/glow on numbers (no `text-shadow` or gradients on numeric text).
- [ ] B3 `[open]` ??? ← the thing YOU hate most goes here
