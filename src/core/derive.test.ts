import { describe, expect, it } from 'vitest'
import type { MoneyRecord, Settings } from './types'
import {
  fixedExpensePaid,
  fixedExpensesThisPeriod,
  dayLabel,
  groupByDay,
  budgetViews,
  monthQuickCalc,
  routineToday,
  visibleBudgets,
  withAccount,
} from './derive'

const settings: Settings = {
  dayType: '工作日',
  // 钉住当天日型：routineToday 的日型走「当天指定优先，否则按日历推断」，测试固定用工作日
  dayTypeSetFor: '2026-10-11',
  dayPlans: { 工作日: [{ name: '三餐', expect: 50 }, { name: '咖啡', expect: 20 }] },
  budgets: [
    { name: '购物', month: 800 },
    { name: '学习', month: 300 },
  ],
  fixedExpenses: [
    { name: '狗粮', amount: 420 },
    { name: '域名', amount: 600, cycle: 'yearly' },
  ],
  accounts: ['现金'],
}

// 2026-10-05（周一）～ 2026-10-11（周日）是同一周；NOW 取周日 20:00
const NOW = new Date(2026, 9, 11, 20, 0)
const ts = (d: number, h = 12) => new Date(2026, 9, d, h, 0).getTime()

let seq = 0
const routine = (category: string, amount: number, at: number): MoneyRecord =>
  ({ id: `r${++seq}`, ts: at, kind: 'routine', category, amount, note: '' })
const budgetOut = (budget: string, amount: number, at: number): MoneyRecord =>
  ({ id: `po${++seq}`, ts: at, kind: 'budget', budget, dir: 'out', amount, note: '' })
const budgetIn = (budget: string, amount: number, at: number): MoneyRecord =>
  ({ id: `pi${++seq}`, ts: at, kind: 'budget', budget, dir: 'in', amount, note: '' })
const commit = (item: string, paid: boolean, periodKey: string, at: number): MoneyRecord =>
  ({ id: `c${++seq}`, ts: at, kind: 'fixed', item, amount: 420, periodKey, paid })
const transfer = (from: string, to: string, amount: number, at: number): MoneyRecord =>
  ({ id: `t${++seq}`, ts: at, kind: 'transfer', from, to, amount, note: '' })

describe('routineToday', () => {
  it('只聚合今日流水，昨日与别的类别不计入', () => {
    const records = [
      routine('三餐', 30, ts(11, 9)),
      routine('三餐', 40, ts(10)), // 昨天
      routine('咖啡', 25, ts(11, 15)),
    ]
    const view = routineToday(records, settings, NOW)
    const meals = view.buckets.find((b) => b.name === '三餐')!
    const coffee = view.buckets.find((b) => b.name === '咖啡')!
    expect(meals.spent).toBe(30)
    expect(meals.left).toBe(20)
    expect(coffee.spent).toBe(25)
    expect(coffee.left).toBe(-5) // 超支为负
    expect(view.totalSpent).toBe(55)
    expect(view.totalExpect).toBe(70)
    expect(view.left).toBe(15)
  })
})

describe('budgetViews', () => {
  it('本周净支出 = 支出 − 回血；推算按已过天数', () => {
    const records = [budgetOut('购物', 100, ts(11, 10)), budgetIn('购物', 30, ts(11, 11))]
    const [view] = budgetViews(records, settings, NOW)
    expect(view.weekSpent).toBe(70)
    expect(view.weekLeft).toBe(130)
    expect(view.monthSpent).toBe(70)
    expect(view.projection).toBeCloseTo(70 * (31 / 11))
  })

  it('跨周隔离：上周流水不进本周，但仍计本月', () => {
    const records = [budgetOut('购物', 50, ts(4)), budgetOut('购物', 100, ts(11))] // 10-04 是上周日
    const [view] = budgetViews(records, settings, NOW)
    expect(view.weekSpent).toBe(100)
    expect(view.monthSpent).toBe(150)
  })

  it('visibleBudgets：超支退场、按剩余降序', () => {
    const views = [
      { name: 'A', month: 1, weekBudget: 25, weekSpent: 70, weekLeft: 30, monthSpent: 70, projection: 0 },
      { name: 'B', month: 1, weekBudget: 25, weekSpent: 100, weekLeft: 0, monthSpent: 100, projection: 0 },
      { name: 'C', month: 1, weekBudget: 25, weekSpent: 10, weekLeft: 90, monthSpent: 10, projection: 0 },
    ]
    expect(visibleBudgets(views).map((v) => v.name)).toEqual(['C', 'A'])
  })
})

describe('fixedExpensePaid 固定支出状态（按周期）', () => {
  it('本周期无流水 = 未付', () => {
    expect(fixedExpensePaid([], '狗粮', 'monthly', NOW)).toBe(false)
    expect(fixedExpensePaid([], '域名', 'yearly', NOW)).toBe(false)
  })

  it('月付：上月已付不影响本月', () => {
    const lastMonthTs = new Date(2026, 8, 20, 10).getTime() // 2026-09-20
    const records = [commit('狗粮', true, '2026-09', lastMonthTs)]
    expect(fixedExpensePaid(records, '狗粮', 'monthly', NOW)).toBe(false)
  })

  it('月付：本月多条流水取最新一条', () => {
    const records = [commit('狗粮', true, '2026-10', ts(11, 9)), commit('狗粮', false, '2026-10', ts(11, 10))]
    expect(fixedExpensePaid(records, '狗粮', 'monthly', NOW)).toBe(false)
  })

  it('年付：年内跨月保持已付，次年回未付', () => {
    const paidInOct = new Date(2026, 9, 5, 10).getTime()
    const records = [commit('域名', true, '2026', paidInOct)]
    expect(fixedExpensePaid(records, '域名', 'yearly', new Date(2026, 10, 20, 12))).toBe(true) // 11 月仍是本年
    expect(fixedExpensePaid(records, '域名', 'yearly', new Date(2027, 0, 3, 12))).toBe(false) // 跨年重置
  })

  it('月键流水不会误匹配年付周期（防串周期）', () => {
    const records = [commit('域名', true, '2026-10', ts(11, 9))]
    expect(fixedExpensePaid(records, '域名', 'yearly', NOW)).toBe(false) // 年付周期键是 '2026'
  })

  it('fixedExpensesThisPeriod 汇总（含周期，旧数据默认月付）', () => {
    const records = [commit('狗粮', true, '2026-10', ts(11, 9))]
    expect(fixedExpensesThisPeriod(records, settings, NOW)).toEqual([
      { name: '狗粮', amount: 420, cycle: 'monthly', paid: true },
      { name: '域名', amount: 600, cycle: 'yearly', paid: false },
    ])
  })
})

describe('groupByDay 流水分组', () => {
  it('按天倒序、天内按时间倒序；outflow 只计日常与预算支出', () => {
    const records = [
      routine('三餐', 30, ts(10, 9)),
      routine('咖啡', 25, ts(11, 15)),
      budgetOut('购物', 100, ts(11, 10)),
      budgetIn('购物', 30, ts(11, 11)),
      transfer('现金', '工资卡', 500, ts(11, 12)),
      commit('狗粮', true, '2026-10', ts(11, 8)),
    ]
    const groups = groupByDay(records)
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-10-11', '2026-10-10'])
    const today = groups[0]
    expect(today.records[0].kind).toBe('routine') // 15:00 的咖啡最晚
    expect(today.outflow).toBe(125) // 25 + 100；回血、走账、固定支出不计
    expect(groups[1].outflow).toBe(30)
  })

  it('dayLabel：今天 / 昨天 / 具体日期', () => {
    expect(dayLabel('2026-10-11', NOW)).toBe('今天')
    expect(dayLabel('2026-10-10', NOW)).toBe('昨天')
    expect(dayLabel('2026-10-09', NOW)).toBe('10月9日 周五')
  })
})

describe('monthQuickCalc 本月速算', () => {
  it('2026-10：18 工作日 + 13 休息日（国庆 7 天、10-10 调休上班）；年付按月摊', () => {
    const s: Settings = {
      dayType: '工作日',
      dayPlans: {
        工作日: [{ name: '三餐', expect: 130 }],
        周末日: [{ name: '三餐', expect: 830 }],
      },
      budgets: [
        { name: '购物', month: 800 },
        { name: '学习', month: 300 },
      ],
      fixedExpenses: [
        { name: '狗粮', amount: 420 },
        { name: '域名', amount: 600, cycle: 'yearly' },
      ],
      accounts: [],
    }
    const qc = monthQuickCalc(s, NOW) // NOW = 2026-10-11
    expect(qc.workDays).toBe(18)
    expect(qc.restDays).toBe(13)
    expect(qc.workExpect).toBe(130)
    expect(qc.restExpect).toBe(830)
    expect(qc.routineTotal).toBe(18 * 130 + 13 * 830)
    expect(qc.budgetTotal).toBe(1100)
    expect(qc.fixedMonthlyTotal).toBe(420)
    expect(qc.fixedYearlyAmortized).toBe(50)
    expect(qc.total).toBe(18 * 130 + 13 * 830 + 1100 + 420 + 50)
  })
})

describe('withAccount 账户自动记忆', () => {
  it('新名字追加，已有名字不动', () => {
    const a = withAccount(settings, '公积金卡')
    expect(a.accounts).toEqual(['现金', '公积金卡'])
    expect(a).not.toBe(settings)
    const b = withAccount(settings, '现金')
    expect(b).toBe(settings)
  })
})
