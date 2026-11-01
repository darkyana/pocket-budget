import type { DayTypeName, ExpenseCycle, MoneyRecord, Settings } from './types'
import { dayKeyOf, dayOfMonth, daysInMonth, isSameDay, isSameWeek, monthKeyOf, projectMonthEnd, yearKeyOf } from './time'
import { isRestDay } from './holidays'

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

export function autoDayType(now: Date, dayTypes: DayTypeName[]): DayTypeName {
  const rest = dayTypes.includes('周末日') ? '周末日' : (dayTypes.find((t) => t !== '工作日') ?? dayTypes[0] ?? '工作日')
  const work = dayTypes.includes('工作日') ? '工作日' : (dayTypes[0] ?? '工作日')
  return isRestDay(now) ? rest : work
}

export function todayDayType(settings: Settings, now: Date): DayTypeName {
  if (settings.dayTypeSetFor === dayKeyOf(now) && settings.dayPlans[settings.dayType]) return settings.dayType
  return autoDayType(now, Object.keys(settings.dayPlans))
}

export function syncedDayType(settings: Settings, now: Date): Settings {
  const eff = todayDayType(settings, now)
  const stale = settings.dayTypeSetFor !== undefined && settings.dayTypeSetFor !== dayKeyOf(now)
  if (settings.dayType === eff && !stale) return settings
  return { ...settings, dayType: eff, dayTypeSetFor: stale ? undefined : settings.dayTypeSetFor }
}

export const DEFAULT_ROUTINE_RATIO = 0.6

export function dayExpectSum(dayPlans: Settings['dayPlans'], date: Date): number {
  const dayTypes = Object.keys(dayPlans)
  return (dayPlans[autoDayType(date, dayTypes)] ?? []).reduce((s, b) => s + b.expect, 0)
}

export interface MonthQuickCalc {
  workDays: number
  restDays: number
  workExpect: number
  restExpect: number
  routineBase: number
  ratio: number
  routineTotal: number
  budgetCount: number
  budgetTotal: number
  fixedMonthlyCount: number
  fixedMonthlyTotal: number
  fixedYearlyCount: number
  fixedYearlyTotal: number
  fixedYearlyAmortized: number
  total: number
}

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

export interface PaceView {
  spent: number
  possible: number
  ratio: number
}

export function routinePace(records: MoneyRecord[], settings: Settings, now: Date, realNow: Date = now): PaceView {
  const key = monthKeyOf(now)
  const spent = records.reduce((sum, e) => (e.kind === 'routine' && monthKeyOf(e.ts) === key ? sum + e.amount : sum), 0)
  const upto = monthKeyOf(now) < monthKeyOf(realNow) ? daysInMonth(now) : dayOfMonth(now)
  let possible = 0
  for (let d = 1; d <= upto; d++) {
    possible += dayExpectSum(settings.dayPlans, new Date(now.getFullYear(), now.getMonth(), d))
  }
  return { spent, possible, ratio: possible > 0 ? spent / possible : 0 }
}

export type DayStatus = 'ok' | 'warn' | 'over'

export type RoutineEntry = Extract<MoneyRecord, { kind: 'routine' }>

export interface DayRetro {
  day: number
  date: Date
  dayType: DayTypeName
  expect: number
  spent: number
  ratio: number
  status: DayStatus
  passed: boolean
  isToday: boolean
  entries: RoutineEntry[]
}

export function statusOfRatio(ratio: number): DayStatus {
  if (ratio > 1) return 'over'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

export interface RetroMonthRange {
  earliest: Date
  latest: Date
}

export function retroMonthRange(records: MoneyRecord[], now: Date): RetroMonthRange {
  const latest = new Date(now.getFullYear(), now.getMonth(), 1)
  const keys = records.map((e) => monthKeyOf(e.ts)).filter((k) => k <= monthKeyOf(latest))
  const earliestKey = keys.length > 0 ? keys.reduce((a, b) => (a < b ? a : b)) : monthKeyOf(latest)
  const [y, m] = earliestKey.split('-').map(Number)
  return { earliest: new Date(y, m - 1, 1), latest }
}

export function dayRetroMonth(records: MoneyRecord[], settings: Settings, now: Date, realNow: Date = now): DayRetro[] {
  const key = monthKeyOf(now)
  const byDay = new Map<number, RoutineEntry[]>()
  for (const e of records) {
    if (e.kind !== 'routine' || monthKeyOf(e.ts) !== key) continue
    const day = new Date(e.ts).getDate()
    const list = byDay.get(day)
    if (list) list.push(e)
    else byDay.set(day, [e])
  }
  const elapsed = monthKeyOf(now) < monthKeyOf(realNow)
  const today = elapsed ? daysInMonth(now) + 1 : dayOfMonth(now)
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
      isToday: !elapsed && day === today,
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
  saved: number
  best: DayRetro | null
  worst: DayRetro | null
  workAvg: GroupAvg | null
  restAvg: GroupAvg | null
}

function avgOf(label: string, days: DayRetro[]): GroupAvg | null {
  if (days.length === 0) return null
  const spent = days.reduce((s, d) => s + d.spent, 0)
  const expect = days.reduce((s, d) => s + d.expect, 0)
  return { label, days: days.length, spent, expect, ratio: expect > 0 ? spent / expect : spent > 0 ? Infinity : 0 }
}

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

export type MonthKindKey = 'routine' | 'budget' | 'fixed'

export interface MoneyStat {
  count: number
  amount: number
}

export interface MonthKindStat extends MoneyStat {
  key: MonthKindKey
}

export interface MonthOverview {
  kinds: MonthKindStat[]
  totalAmount: number
  totalCount: number
  transfers: number
  unassigned: MoneyStat | null
}

export function kindStatOf(overview: MonthOverview, key: MonthKindKey): MoneyStat {
  return overview.kinds.find((k) => k.key === key) ?? { count: 0, amount: 0 }
}

function netAmount(entries: Extract<MoneyRecord, { kind: 'budget' }>[]): number {
  return entries.reduce((sum, e) => sum + (e.dir === 'out' ? e.amount : -e.amount), 0)
}

export function monthOverview(records: MoneyRecord[], now: Date): MonthOverview {
  const key = monthKeyOf(now)
  const inMonth = (ts: number) => monthKeyOf(ts) === key
  const routineEntries = records.filter((e): e is RoutineEntry => e.kind === 'routine' && inMonth(e.ts))
  const budgetEntries = records.filter((e): e is Extract<MoneyRecord, { kind: 'budget' }> => e.kind === 'budget' && inMonth(e.ts))
  const assigned = budgetEntries.filter((e) => e.budget !== '')
  const loose = budgetEntries.filter((e) => e.budget === '')
  const fixedPaid = effectiveRecords(records).filter((e): e is Extract<MoneyRecord, { kind: 'fixed' }> => e.kind === 'fixed' && inMonth(e.ts))
  const kinds: MonthKindStat[] = [
    { key: 'routine', count: routineEntries.length, amount: routineEntries.reduce((s, e) => s + e.amount, 0) },
    { key: 'budget', count: assigned.filter((e) => e.dir === 'out').length, amount: netAmount(assigned) },
    { key: 'fixed', count: fixedPaid.length, amount: fixedPaid.reduce((s, e) => s + e.amount, 0) },
  ]
  const looseCount = loose.filter((e) => e.dir === 'out').length
  const looseAmount = netAmount(loose)
  return {
    kinds,
    totalAmount: kinds.reduce((s, k) => s + k.amount, 0) + looseAmount,
    totalCount: kinds.reduce((s, k) => s + k.count, 0),
    transfers: records.filter((e) => e.kind === 'transfer' && inMonth(e.ts)).length,
    unassigned: looseCount > 0 ? { count: looseCount, amount: looseAmount } : null,
  }
}

export interface BudgetView {
  name: string
  month: number
  weekBudget: number
  weekSpent: number
  weekLeft: number
  monthSpent: number
  monthOutCount: number
  monthBackflow: number
  projection: number
}

function budgetEntriesIn(records: MoneyRecord[], budgetName: string, inSpan: (ts: number) => boolean) {
  return records.filter((e): e is Extract<MoneyRecord, { kind: 'budget' }> => e.kind === 'budget' && e.budget === budgetName && inSpan(e.ts))
}

function netBudgetSpend(records: MoneyRecord[], budgetName: string, inSpan: (ts: number) => boolean): number {
  return netAmount(budgetEntriesIn(records, budgetName, inSpan))
}

export type BudgetEntry = Extract<MoneyRecord, { kind: 'budget' }>

export function budgetMonthEntries(records: MoneyRecord[], budgetName: string, now: Date): BudgetEntry[] {
  const key = monthKeyOf(now)
  return records
    .filter((e): e is BudgetEntry => e.kind === 'budget' && e.budget === budgetName && monthKeyOf(e.ts) === key)
    .sort((a, b) => a.ts - b.ts)
}

export function budgetViews(records: MoneyRecord[], settings: Settings, now: Date, realNow: Date = now): BudgetView[] {
  const elapsed = monthKeyOf(now) < monthKeyOf(realNow)
  return settings.budgets.map((p) => {
    const weekSpent = netBudgetSpend(records, p.name, (ts) => isSameWeek(ts, now))
    const monthEntries = budgetEntriesIn(records, p.name, (ts) => monthKeyOf(ts) === monthKeyOf(now))
    const monthSpent = netAmount(monthEntries)
    return {
      name: p.name,
      month: p.month,
      weekBudget: p.month / 4,
      weekSpent,
      weekLeft: p.month / 4 - weekSpent,
      monthSpent,
      monthOutCount: monthEntries.filter((e) => e.dir === 'out').length,
      monthBackflow: monthEntries.filter((e) => e.dir === 'in').length,
      projection: elapsed ? monthSpent : projectMonthEnd(monthSpent, now),
    }
  })
}

export function visibleBudgets(views: BudgetView[]): BudgetView[] {
  return [...views].sort((a, b) => b.weekLeft - a.weekLeft)
}

export function expensePeriodKey(now: Date, cycle: ExpenseCycle): string {
  return cycle === 'yearly' ? yearKeyOf(now) : monthKeyOf(now)
}

export function fixedExpensePaid(records: MoneyRecord[], name: string, cycle: ExpenseCycle, now: Date): boolean {
  const key = expensePeriodKey(now, cycle)
  return effectiveRecords(records).some((e) => e.kind === 'fixed' && e.item === name && e.periodKey === key)
}

export function effectiveRecords(records: MoneyRecord[]): MoneyRecord[] {
  const latest = new Map<string, Extract<MoneyRecord, { kind: 'fixed' }>>()
  for (const e of records) {
    if (e.kind !== 'fixed') continue
    const key = JSON.stringify([e.item, e.periodKey])
    const previous = latest.get(key)
    if (!previous || e.ts >= previous.ts) latest.set(key, e)
  }
  return records.filter((e) => e.kind !== 'fixed' || (e.paid && latest.get(JSON.stringify([e.item, e.periodKey])) === e))
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

export interface DayGroup {
  dayKey: string
  records: MoneyRecord[]
  outflow: number
}

export function groupByDay(records: MoneyRecord[]): DayGroup[] {
  const map = new Map<string, MoneyRecord[]>()
  for (const e of effectiveRecords(records)) {
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
        if (e.kind === 'budget') return s + (e.dir === 'out' ? e.amount : -e.amount)
        if (e.kind === 'fixed') return s + e.amount
        return s
      }, 0)
      return { dayKey, records: sorted, outflow }
    })
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

export const weekdayOf = (d: Date) => `周${WEEKDAY_NAMES[d.getDay()]}`

export function dayLabel(dayKey: string, now: Date): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (isSameDay(date, now)) return '今天'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(date, yesterday)) return '昨天'
  return `${m}月${d}日 周${WEEKDAY_NAMES[date.getDay()]}`
}

export function withAccount(settings: Settings, name: string): Settings {
  if (!name || settings.accounts.includes(name)) return settings
  return { ...settings, accounts: [...settings.accounts, name] }
}
