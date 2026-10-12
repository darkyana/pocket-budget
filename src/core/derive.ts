/**
 * 派生层：从事件流 + 设置推导出所有视图数字。纯函数，无 IO 无 DOM。
 * 这里算错的数字会毁掉对工具的信任，所以本文件被 time.test / derive.test 盯着。
 */
import type { CommitmentCycle, MoneyEvent, Settings } from './types'
import { dayKeyOf, isSameDay, isSameWeek, monthKeyOf, projectMonthEnd, yearKeyOf } from './time'

/* ---------------- 节律：今日 ---------------- */

export interface RhythmView {
  name: string
  expect: number
  spent: number
  left: number
}

export function rhythmToday(events: MoneyEvent[], settings: Settings, now: Date) {
  const buckets: RhythmView[] = (settings.dayPlans[settings.dayType] ?? []).map((b) => {
    const spent = events.reduce((sum, e) => {
      return e.kind === 'rhythm' && e.category === b.name && isSameDay(e.ts, now) ? sum + e.amount : sum
    }, 0)
    return { name: b.name, expect: b.expect, spent, left: b.expect - spent }
  })
  const totalSpent = buckets.reduce((s, b) => s + b.spent, 0)
  const totalExpect = buckets.reduce((s, b) => s + b.expect, 0)
  return { buckets, totalSpent, totalExpect, left: totalExpect - totalSpent }
}

/* ---------------- 预算池：本周 / 本月 / 推算 ---------------- */

export interface PoolView {
  name: string
  month: number
  weekAllow: number
  /** 本周净支出（支出 − 回血） */
  weekSpent: number
  weekLeft: number
  /** 本月净支出 */
  monthSpent: number
  /** 按当前节奏推算的月底总额 */
  projection: number
}

function netPoolSpend(events: MoneyEvent[], poolName: string, inSpan: (ts: number) => boolean): number {
  return events.reduce((sum, e) => {
    if (e.kind !== 'pool' || e.pool !== poolName || !inSpan(e.ts)) return sum
    return sum + (e.dir === 'out' ? e.amount : -e.amount)
  }, 0)
}

export function poolViews(events: MoneyEvent[], settings: Settings, now: Date): PoolView[] {
  return settings.pools.map((p) => {
    const weekSpent = netPoolSpend(events, p.name, (ts) => isSameWeek(ts, now))
    const monthSpent = netPoolSpend(events, p.name, (ts) => monthKeyOf(ts) === monthKeyOf(now))
    return {
      name: p.name,
      month: p.month,
      weekAllow: p.weekAllow,
      weekSpent,
      weekLeft: p.weekAllow - weekSpent,
      monthSpent,
      projection: projectMonthEnd(monthSpent, now),
    }
  })
}

/** 裁定：超支的池子从首页退场；展示按本周剩余降序，只回答「现在还能在哪花钱」 */
export function visiblePools(views: PoolView[]): PoolView[] {
  return views.filter((v) => v.weekLeft > 0).sort((a, b) => b.weekLeft - a.weekLeft)
}

/* ---------------- 义务：本周期状态 ---------------- */

/** 义务的归属周期键：月付 'YYYY-MM'，年付 'YYYY' */
export function commitmentPeriodKey(now: Date, cycle: CommitmentCycle): string {
  return cycle === 'yearly' ? yearKeyOf(now) : monthKeyOf(now)
}

/** 义务状态 = 本周期内该义务最后一条事件；周期内无事件 = 未付（周期更替自动回到未付） */
export function commitmentPaid(events: MoneyEvent[], name: string, cycle: CommitmentCycle, now: Date): boolean {
  const key = commitmentPeriodKey(now, cycle)
  let last: Extract<MoneyEvent, { kind: 'commitment' }> | undefined
  for (const e of events) {
    if (e.kind === 'commitment' && e.item === name && e.periodKey === key && (!last || e.ts >= last.ts)) {
      last = e
    }
  }
  return last ? last.paid : false
}

export interface CommitmentView {
  name: string
  amount: number
  cycle: CommitmentCycle
  paid: boolean
}

export function commitmentsThisPeriod(events: MoneyEvent[], settings: Settings, now: Date): CommitmentView[] {
  return settings.commitments.map((c) => {
    const cycle = c.cycle ?? 'monthly'
    return { name: c.name, amount: c.amount, cycle, paid: commitmentPaid(events, c.name, cycle, now) }
  })
}

/* ---------------- 流水：按天分组 ---------------- */

export interface DayGroup {
  dayKey: string
  events: MoneyEvent[]
  /** 当日消费性支出（节律 + 池支出）；走账不是消费、义务不占当日额度，都不计 */
  outflow: number
}

export function groupByDay(events: MoneyEvent[]): DayGroup[] {
  const map = new Map<string, MoneyEvent[]>()
  for (const e of events) {
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
        if (e.kind === 'rhythm') return s + e.amount
        if (e.kind === 'pool' && e.dir === 'out') return s + e.amount
        return s
      }, 0)
      return { dayKey, events: sorted, outflow }
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
