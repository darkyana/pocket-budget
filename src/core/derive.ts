/**
 * 派生层：从流水 + 设置推导出所有视图数字。纯函数，无 IO 无 DOM。
 * 这里算错的数字会毁掉对工具的信任，所以本文件被 time.test / derive.test 盯着。
 */
import type { DayTypeName, ExpenseCycle, MoneyRecord, Settings } from './types'
import { dayKeyOf, dayOfMonth, daysInMonth, isSameDay, isSameWeek, monthKeyOf, projectMonthEnd, yearKeyOf } from './time'
import { isRestDay } from './holidays'

/* ---------------- 日型：推断与生效 ---------------- */

/** 显式修正：锚改名的联动改写——同名流水的锚字段一并更新；无匹配时原数组原样返回 */
export function renameRecordAnchor(
  records: MoneyRecord[],
  kind: 'routine' | 'budget' | 'fixed',
  from: string,
  to: string,
): MoneyRecord[] {
  let changed = false
  const next = records.map((e) => {
    if (kind === 'routine' && e.kind === 'routine' && e.category === from) {
      changed = true
      return { ...e, category: to }
    }
    if (kind === 'budget' && e.kind === 'budget' && e.budget === from) {
      changed = true
      return { ...e, budget: to }
    }
    if (kind === 'fixed' && e.kind === 'fixed' && e.item === from) {
      changed = true
      return { ...e, item: to }
    }
    return e
  })
  return changed ? next : records
}

/** 按日历自动推断日型：休息日（周末/法定节假日，调休上班除外）→ 休息型，否则工作型 */
export function autoDayType(now: Date, dayTypes: DayTypeName[]): DayTypeName {
  const rest = dayTypes.includes('周末日') ? '周末日' : (dayTypes.find((t) => t !== '工作日') ?? dayTypes[0] ?? '工作日')
  const work = dayTypes.includes('工作日') ? '工作日' : (dayTypes[0] ?? '工作日')
  return isRestDay(now) ? rest : work
}

/** 今日生效的日型：当天手动指定优先（指定的类型还得存在），否则按日历推断 */
export function todayDayType(settings: Settings, now: Date): DayTypeName {
  if (settings.dayTypeSetFor === dayKeyOf(now) && settings.dayPlans[settings.dayType]) return settings.dayType
  return autoDayType(now, Object.keys(settings.dayPlans))
}

/** 启动时对齐落库的 dayType：清掉过期的手动指定，使设置快照与派生结果一致（导出/对账友好） */
export function syncedDayType(settings: Settings, now: Date): Settings {
  const eff = todayDayType(settings, now)
  const stale = settings.dayTypeSetFor !== undefined && settings.dayTypeSetFor !== dayKeyOf(now)
  if (settings.dayType === eff && !stale) return settings
  return { ...settings, dayType: eff, dayTypeSetFor: stale ? undefined : settings.dayTypeSetFor }
}

/* ---------------- 本月速算：按设置 + 日历的静态估算 ---------------- */

/** 日常预计实际消耗比率的缺省值：期望是上限，不是每天花光 */
export const DEFAULT_ROUTINE_RATIO = 0.6

/** 某日期望合计：按日历自动推断日型后累加该日型的日常期望（手动指定不计入）；消费力分母与快速回顾逐日视图共用 */
export function dayExpectSum(dayPlans: Settings['dayPlans'], date: Date): number {
  const dayTypes = Object.keys(dayPlans)
  return (dayPlans[autoDayType(date, dayTypes)] ?? []).reduce((s, b) => s + b.expect, 0)
}

export interface MonthQuickCalc {
  /** 本月按日历推断的工作日 / 休息日天数（调休上班的周末算工作日） */
  workDays: number
  restDays: number
  /** 两种日型的单日期望合计（明细展示用） */
  workExpect: number
  restExpect: number
  /** 逐日按日型累加的期望全额（未折比率） */
  routineBase: number
  /** 生效的实际消耗比率（0~1） */
  ratio: number
  /** 日常部分 = 期望全额 × 比率 */
  routineTotal: number
  budgetCount: number
  budgetTotal: number
  fixedMonthlyCount: number
  fixedMonthlyTotal: number
  fixedYearlyCount: number
  fixedYearlyTotal: number
  /** 年付合计 ÷12 的月摊值 */
  fixedYearlyAmortized: number
  total: number
}

/**
 * 本月速算：不动流水，只按当前设置 + 本月日历静态推算「这个月按计划会花多少」。
 * 逐日用 autoDayType 推断（含法定节假日与调休）；自定义日型与当天的手动点选不计入。
 * 日常按「实际消耗比率」折算（期望是上限，缺省 60%）。
 */
export function monthQuickCalc(settings: Settings, now: Date): MonthQuickCalc {
  const days = daysInMonth(now)
  let workDays = 0
  let restDays = 0
  let routineBase = 0
  let workExpect = 0
  let restExpect = 0
  for (let d = 1; d <= days; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), d)
    const expect = dayExpectSum(settings.dayPlans, date)
    if (isRestDay(date)) {
      restDays++
      restExpect = expect
    } else {
      workDays++
      workExpect = expect
    }
    routineBase += expect
  }
  const ratio = settings.routineSpendRatio ?? DEFAULT_ROUTINE_RATIO
  const routineTotal = routineBase * ratio
  const budgetTotal = settings.budgets.reduce((s, b) => s + b.month, 0)
  const monthly = settings.fixedExpenses.filter((c) => (c.cycle ?? 'monthly') === 'monthly')
  const yearly = settings.fixedExpenses.filter((c) => c.cycle === 'yearly')
  const fixedMonthlyTotal = monthly.reduce((s, c) => s + c.amount, 0)
  const fixedYearlyTotal = yearly.reduce((s, c) => s + c.amount, 0)
  const fixedYearlyAmortized = fixedYearlyTotal / 12
  return {
    workDays,
    restDays,
    workExpect,
    restExpect,
    routineBase,
    ratio,
    routineTotal,
    budgetCount: settings.budgets.length,
    budgetTotal,
    fixedMonthlyCount: monthly.length,
    fixedMonthlyTotal,
    fixedYearlyCount: yearly.length,
    fixedYearlyTotal,
    fixedYearlyAmortized,
    total: routineTotal + budgetTotal + fixedMonthlyTotal + fixedYearlyAmortized,
  }
}

/* ---------------- 日常：今日 ---------------- */

export interface RoutineView {
  name: string
  expect: number
  spent: number
  left: number
}

export function routineToday(records: MoneyRecord[], settings: Settings, now: Date) {
  const buckets: RoutineView[] = (settings.dayPlans[todayDayType(settings, now)] ?? []).map((b) => {
    const spent = records.reduce((sum, e) => {
      return e.kind === 'routine' && e.category === b.name && isSameDay(e.ts, now) ? sum + e.amount : sum
    }, 0)
    return { name: b.name, expect: b.expect, spent, left: b.expect - spent }
  })
  const totalSpent = buckets.reduce((s, b) => s + b.spent, 0)
  const totalExpect = buckets.reduce((s, b) => s + b.expect, 0)
  return { buckets, totalSpent, totalExpect, left: totalExpect - totalSpent }
}

/* ---------------- 日常：当前消费力（月至今节奏） ---------------- */

export interface PaceView {
  /** 本月至今实际日常花费（全部日常流水合计，类目已删的照算） */
  spent: number
  /** 至今可发生期望全额（1 号至今逐日按日历日型累加）；为 0 表示未配置，ratio 无意义 */
  possible: number
  /** spent / possible，仅 possible > 0 时有效；超支 > 1 不截断 */
  ratio: number
}

/**
 * 当前消费力：本月至今实际日常花费 ÷ 至今按当前日型配置可发生的期望全额。
 * 分母逐日按日历自动推断（手动指定的日型不计入，与本月速算同口径），不乘消耗比率；
 * 月中改配置会按当前配置追溯已过的天。>1 表示花得比配置节奏快。
 */
export function routinePace(records: MoneyRecord[], settings: Settings, now: Date): PaceView {
  const key = monthKeyOf(now)
  const spent = records.reduce((sum, e) => (e.kind === 'routine' && monthKeyOf(e.ts) === key ? sum + e.amount : sum), 0)
  let possible = 0
  for (let d = 1; d <= dayOfMonth(now); d++) {
    possible += dayExpectSum(settings.dayPlans, new Date(now.getFullYear(), now.getMonth(), d))
  }
  return { spent, possible, ratio: possible > 0 ? spent / possible : 0 }
}

/* ---------------- 快速回顾：本月逐日解释（消费力回顾页） ---------------- */

/** 逐日状态：超计划 = 红；达到计划 80% = 橙（贴近）；否则 = 绿（省） */
export type DayStatus = 'ok' | 'warn' | 'over'

/** 当天的日常流水（快速回顾只收 routine；budget / fixed / transfer 不算） */
export type RoutineEntry = Extract<MoneyRecord, { kind: 'routine' }>

export interface DayRetro {
  day: number
  date: Date
  /** 该日按日历自动推断的日型（手动指定不计入，与消费力分母同口径） */
  dayType: DayTypeName
  /** 该日计划日常（该日型各桶 expect 之和） */
  expect: number
  /** 该日日常实际支出（全部 routine 流水合计，类目已删照算） */
  spent: number
  /** spent / expect；expect = 0 且有支出时为 Infinity */
  ratio: number
  status: DayStatus
  /** 已过（含今天）；未来的天只有占位 */
  passed: boolean
  isToday: boolean
  entries: RoutineEntry[]
}

/** 比率→三色状态：>100% 红、≥80% 橙、否则绿。expect=0 且有支出时 ratio=Infinity，同样落红。日格、月消费力、分组均值共用 */
export function statusOfRatio(ratio: number): DayStatus {
  if (ratio > 1) return 'over'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

/**
 * 本月逐日回顾：1 号到月底每天的计划 / 实际 / 状态。流水一次遍历按天分组（O(n)），
 * 再逐日按 autoDayType 取计划——口径与 routinePace 完全一致，不另造。
 */
export function dayRetroMonth(records: MoneyRecord[], settings: Settings, now: Date): DayRetro[] {
  const key = monthKeyOf(now)
  const byDay = new Map<number, RoutineEntry[]>()
  for (const e of records) {
    if (e.kind !== 'routine' || monthKeyOf(e.ts) !== key) continue
    const day = new Date(e.ts).getDate()
    const list = byDay.get(day)
    if (list) list.push(e)
    else byDay.set(day, [e])
  }
  const today = dayOfMonth(now)
  return Array.from({ length: daysInMonth(now) }, (_, i) => {
    const day = i + 1
    const date = new Date(now.getFullYear(), now.getMonth(), day)
    const dayType = autoDayType(date, Object.keys(settings.dayPlans))
    const expect = dayExpectSum(settings.dayPlans, date)
    const entries = byDay.get(day) ?? []
    const spent = entries.reduce((s, e) => s + e.amount, 0)
    const ratio = expect > 0 ? spent / expect : spent > 0 ? Infinity : 0
    return {
      day,
      date,
      dayType,
      expect,
      spent,
      ratio,
      status: statusOfRatio(ratio),
      passed: day <= today,
      isToday: day === today,
      entries,
    }
  })
}

export interface GroupAvg {
  label: string
  days: number
  spent: number
  expect: number
  ratio: number
}

export interface RetroStats {
  passedDays: number
  okDays: number
  warnDays: number
  overDays: number
  spent: number
  possible: number
  /** possible − spent，正数 = 比计划省下 */
  saved: number
  /** 已过天数里最省 / 最超的一天（只排 expect > 0 的天，ratio 才有意义） */
  best: DayRetro | null
  worst: DayRetro | null
  /** 工作日 / 周末日各自的实际÷计划（无该类天数时为 null） */
  workAvg: GroupAvg | null
  restAvg: GroupAvg | null
}

function avgOf(label: string, days: DayRetro[]): GroupAvg | null {
  if (days.length === 0) return null
  const spent = days.reduce((s, d) => s + d.spent, 0)
  const expect = days.reduce((s, d) => s + d.expect, 0)
  return { label, days: days.length, spent, expect, ratio: expect > 0 ? spent / expect : spent > 0 ? Infinity : 0 }
}

/** 已过天数的汇总：三色天数、累计省/超、工作日/周末日均值、最省/最超一天 */
export function retroStats(month: DayRetro[]): RetroStats {
  const passed = month.filter((d) => d.passed)
  const spent = passed.reduce((s, d) => s + d.spent, 0)
  const possible = passed.reduce((s, d) => s + d.expect, 0)
  const ranked = passed.filter((d) => d.expect > 0).sort((a, b) => a.ratio - b.ratio)
  return {
    passedDays: passed.length,
    okDays: passed.filter((d) => d.status === 'ok').length,
    warnDays: passed.filter((d) => d.status === 'warn').length,
    overDays: passed.filter((d) => d.status === 'over').length,
    spent,
    possible,
    saved: possible - spent,
    best: ranked[0] ?? null,
    worst: ranked[ranked.length - 1] ?? null,
    workAvg: avgOf('工作日', passed.filter((d) => d.dayType === '工作日')),
    restAvg: avgOf('周末日', passed.filter((d) => d.dayType === '周末日')),
  }
}

/* ---------------- 预算：本周 / 本月 / 推算 ---------------- */

export interface BudgetView {
  name: string
  month: number
  /** 周预算 = 月÷4（派生值，不落库） */
  weekBudget: number
  /** 本周净支出（支出 − 回血） */
  weekSpent: number
  weekLeft: number
  /** 本月净支出 */
  monthSpent: number
  /** 按当前节奏推算的月底总额 */
  projection: number
}

function netBudgetSpend(records: MoneyRecord[], budgetName: string, inSpan: (ts: number) => boolean): number {
  return records.reduce((sum, e) => {
    if (e.kind !== 'budget' || e.budget !== budgetName || !inSpan(e.ts)) return sum
    return sum + (e.dir === 'out' ? e.amount : -e.amount)
  }, 0)
}

export function budgetViews(records: MoneyRecord[], settings: Settings, now: Date): BudgetView[] {
  return settings.budgets.map((p) => {
    const weekSpent = netBudgetSpend(records, p.name, (ts) => isSameWeek(ts, now))
    const monthSpent = netBudgetSpend(records, p.name, (ts) => monthKeyOf(ts) === monthKeyOf(now))
    return {
      name: p.name,
      month: p.month,
      weekBudget: p.month / 4,
      weekSpent,
      weekLeft: p.month / 4 - weekSpent,
      monthSpent,
      projection: projectMonthEnd(monthSpent, now),
    }
  })
}

/** 裁定：超支的预算从首页退场；展示按本周剩余降序，只回答「现在还能在哪花钱」 */
export function visibleBudgets(views: BudgetView[]): BudgetView[] {
  return views.filter((v) => v.weekLeft > 0).sort((a, b) => b.weekLeft - a.weekLeft)
}

/* ---------------- 固定支出：本周期状态 ---------------- */

/** 固定支出的归属周期键：月付 'YYYY-MM'，年付 'YYYY' */
export function expensePeriodKey(now: Date, cycle: ExpenseCycle): string {
  return cycle === 'yearly' ? yearKeyOf(now) : monthKeyOf(now)
}

/** 固定支出状态 = 本周期内该固定支出最后一条流水；周期内无流水 = 未付（周期更替自动回到未付） */
export function fixedExpensePaid(records: MoneyRecord[], name: string, cycle: ExpenseCycle, now: Date): boolean {
  const key = expensePeriodKey(now, cycle)
  let last: Extract<MoneyRecord, { kind: 'fixed' }> | undefined
  for (const e of records) {
    if (e.kind === 'fixed' && e.item === name && e.periodKey === key && (!last || e.ts >= last.ts)) {
      last = e
    }
  }
  return last ? last.paid : false
}

export interface FixedExpenseView {
  name: string
  amount: number
  cycle: ExpenseCycle
  paid: boolean
}

export function fixedExpensesThisPeriod(records: MoneyRecord[], settings: Settings, now: Date): FixedExpenseView[] {
  return settings.fixedExpenses.map((c) => {
    const cycle = c.cycle ?? 'monthly'
    return { name: c.name, amount: c.amount, cycle, paid: fixedExpensePaid(records, c.name, cycle, now) }
  })
}

/* ---------------- 流水：按天分组 ---------------- */

export interface DayGroup {
  dayKey: string
  records: MoneyRecord[]
  /** 当日消费性支出（日常 + 预算支出）；走账不是消费、固定支出不占当日额度，都不计 */
  outflow: number
}

export function groupByDay(records: MoneyRecord[]): DayGroup[] {
  const map = new Map<string, MoneyRecord[]>()
  for (const e of records) {
    const k = dayKeyOf(e.ts)
    const list = map.get(k)
    if (list) list.push(e)
    else map.set(k, [e])
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dayKey, list]) => {
      const sorted = [...list].sort((a, b) => b.ts - a.ts)
      const outflow = sorted.reduce((s, e) => {
        if (e.kind === 'routine') return s + e.amount
        if (e.kind === 'budget' && e.dir === 'out') return s + e.amount
        return s
      }, 0)
      return { dayKey, records: sorted, outflow }
    })
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/** 「周五」式星期名（快速回顾等视图的日期头用） */
export const weekdayOf = (d: Date) => `周${WEEKDAY_NAMES[d.getDay()]}`

/** 「今天 / 昨天 / 10月9日 周五」 */
export function dayLabel(dayKey: string, now: Date): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (isSameDay(date, now)) return '今天'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(date, yesterday)) return '昨天'
  return `${m}月${d}日 周${WEEKDAY_NAMES[date.getDay()]}`
}

/* ---------------- 走账账户 ---------------- */

/** 账户自动记忆：新名字追加到列表末尾（不修改原对象） */
export function withAccount(settings: Settings, name: string): Settings {
  if (!name || settings.accounts.includes(name)) return settings
  return { ...settings, accounts: [...settings.accounts, name] }
}
