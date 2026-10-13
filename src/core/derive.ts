/**
 * 派生层：从流水 + 设置推导出所有视图数字。纯函数，无 IO 无 DOM。
 * 这里算错的数字会毁掉对工具的信任，所以本文件被 time.test / derive.test 盯着。
 */
import type { DayTypeName, ExpenseCycle, MoneyRecord, Settings } from './types'
import { dayKeyOf, daysInMonth, isSameDay, isSameWeek, monthKeyOf, projectMonthEnd, yearKeyOf } from './time'
import { isRestDay } from './holidays'

/* ---------------- 日型：推断与生效 ---------------- */

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

export interface MonthQuickCalc {
  /** 本月按日历推断的工作日 / 休息日天数（调休上班的周末算工作日） */
  workDays: number
  restDays: number
  /** 两种日型的单日期望合计（明细展示用） */
  workExpect: number
  restExpect: number
  /** 日常部分 = 逐日按日型累加期望 */
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
 */
export function monthQuickCalc(settings: Settings, now: Date): MonthQuickCalc {
  const dayTypes = Object.keys(settings.dayPlans)
  const days = daysInMonth(now)
  let workDays = 0
  let restDays = 0
  let routineTotal = 0
  let workExpect = 0
  let restExpect = 0
  for (let d = 1; d <= days; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), d)
    const expect = (settings.dayPlans[autoDayType(date, dayTypes)] ?? []).reduce((s, b) => s + b.expect, 0)
    if (isRestDay(date)) {
      restDays++
      restExpect = expect
    } else {
      workDays++
      workExpect = expect
    }
    routineTotal += expect
  }
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
