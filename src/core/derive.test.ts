import { describe, expect, it } from 'vitest'
import type { MoneyEvent, Settings } from './types'
import {
  commitmentPaid,
  commitmentsThisPeriod,
  dayLabel,
  groupByDay,
  poolViews,
  rhythmToday,
  visiblePools,
  withAccount,
} from './derive'

const settings: Settings = {
  dayType: '工作日',
  dayPlans: { 工作日: [{ name: '三餐', expect: 50 }, { name: '咖啡', expect: 20 }] },
  pools: [
    { name: '购物', month: 800, weekAllow: 200 },
    { name: '学习', month: 300, weekAllow: 75 },
  ],
  commitments: [
    { name: '狗粮', amount: 420 },
    { name: '域名', amount: 600, cycle: 'yearly' },
  ],
  accounts: ['现金'],
}

// 2026-10-05（周一）～ 2026-10-11（周日）是同一周；NOW 取周日 20:00
const NOW = new Date(2026, 9, 11, 20, 0)
const ts = (d: number, h = 12) => new Date(2026, 9, d, h, 0).getTime()

let seq = 0
const rhythm = (category: string, amount: number, at: number): MoneyEvent =>
  ({ id: `r${++seq}`, ts: at, kind: 'rhythm', category, amount, note: '' })
const poolOut = (pool: string, amount: number, at: number): MoneyEvent =>
  ({ id: `po${++seq}`, ts: at, kind: 'pool', pool, dir: 'out', amount, note: '' })
const poolIn = (pool: string, amount: number, at: number): MoneyEvent =>
  ({ id: `pi${++seq}`, ts: at, kind: 'pool', pool, dir: 'in', amount, note: '' })
const commit = (item: string, paid: boolean, periodKey: string, at: number): MoneyEvent =>
  ({ id: `c${++seq}`, ts: at, kind: 'commitment', item, amount: 420, periodKey, paid })
const transfer = (from: string, to: string, amount: number, at: number): MoneyEvent =>
  ({ id: `t${++seq}`, ts: at, kind: 'transfer', from, to, amount, note: '' })

describe('rhythmToday', () => {
  it('只聚合今日事件，昨日与别的类别不计入', () => {
    const events = [
      rhythm('三餐', 30, ts(11, 9)),
      rhythm('三餐', 40, ts(10)), // 昨天
      rhythm('咖啡', 25, ts(11, 15)),
    ]
    const view = rhythmToday(events, settings, NOW)
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

describe('poolViews', () => {
  it('本周净支出 = 支出 − 回血；推算按已过天数', () => {
    const events = [poolOut('购物', 100, ts(11, 10)), poolIn('购物', 30, ts(11, 11))]
    const [view] = poolViews(events, settings, NOW)
    expect(view.weekSpent).toBe(70)
    expect(view.weekLeft).toBe(130)
    expect(view.monthSpent).toBe(70)
    expect(view.projection).toBeCloseTo(70 * (31 / 11))
  })

  it('跨周隔离：上周事件不进本周，但仍计本月', () => {
    const events = [poolOut('购物', 50, ts(4)), poolOut('购物', 100, ts(11))] // 10-04 是上周日
    const [view] = poolViews(events, settings, NOW)
    expect(view.weekSpent).toBe(100)
    expect(view.monthSpent).toBe(150)
  })

  it('visiblePools：超支退场、按剩余降序', () => {
    const views = [
      { name: 'A', month: 1, weekAllow: 100, weekSpent: 70, weekLeft: 30, monthSpent: 70, projection: 0 },
      { name: 'B', month: 1, weekAllow: 100, weekSpent: 100, weekLeft: 0, monthSpent: 100, projection: 0 },
      { name: 'C', month: 1, weekAllow: 100, weekSpent: 10, weekLeft: 90, monthSpent: 10, projection: 0 },
    ]
    expect(visiblePools(views).map((v) => v.name)).toEqual(['C', 'A'])
  })
})

describe('commitmentPaid 义务状态（按周期）', () => {
  it('本周期无事件 = 未付', () => {
    expect(commitmentPaid([], '狗粮', 'monthly', NOW)).toBe(false)
    expect(commitmentPaid([], '域名', 'yearly', NOW)).toBe(false)
  })

  it('月付：上月已付不影响本月', () => {
    const lastMonthTs = new Date(2026, 8, 20, 10).getTime() // 2026-09-20
    const events = [commit('狗粮', true, '2026-09', lastMonthTs)]
    expect(commitmentPaid(events, '狗粮', 'monthly', NOW)).toBe(false)
  })

  it('月付：本月多条事件取最新一条', () => {
    const events = [commit('狗粮', true, '2026-10', ts(11, 9)), commit('狗粮', false, '2026-10', ts(11, 10))]
    expect(commitmentPaid(events, '狗粮', 'monthly', NOW)).toBe(false)
  })

  it('年付：年内跨月保持已付，次年回未付', () => {
    const paidInOct = new Date(2026, 9, 5, 10).getTime()
    const events = [commit('域名', true, '2026', paidInOct)]
    expect(commitmentPaid(events, '域名', 'yearly', new Date(2026, 10, 20, 12))).toBe(true) // 11 月仍是本年
    expect(commitmentPaid(events, '域名', 'yearly', new Date(2027, 0, 3, 12))).toBe(false) // 跨年重置
  })

  it('月键事件不会误匹配年付周期（防串周期）', () => {
    const events = [commit('域名', true, '2026-10', ts(11, 9))]
    expect(commitmentPaid(events, '域名', 'yearly', NOW)).toBe(false) // 年付周期键是 '2026'
  })

  it('commitmentsThisPeriod 汇总（含周期，旧数据默认月付）', () => {
    const events = [commit('狗粮', true, '2026-10', ts(11, 9))]
    expect(commitmentsThisPeriod(events, settings, NOW)).toEqual([
      { name: '狗粮', amount: 420, cycle: 'monthly', paid: true },
      { name: '域名', amount: 600, cycle: 'yearly', paid: false },
    ])
  })
})

describe('groupByDay 流水分组', () => {
  it('按天倒序、天内按时间倒序；outflow 只计节律与池支出', () => {
    const events = [
      rhythm('三餐', 30, ts(10, 9)),
      rhythm('咖啡', 25, ts(11, 15)),
      poolOut('购物', 100, ts(11, 10)),
      poolIn('购物', 30, ts(11, 11)),
      transfer('现金', '工资卡', 500, ts(11, 12)),
      commit('狗粮', true, '2026-10', ts(11, 8)),
    ]
    const groups = groupByDay(events)
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-10-11', '2026-10-10'])
    const today = groups[0]
    expect(today.events[0].kind).toBe('rhythm') // 15:00 的咖啡最晚
    expect(today.outflow).toBe(125) // 25 + 100；回血、走账、义务不计
    expect(groups[1].outflow).toBe(30)
  })

  it('dayLabel：今天 / 昨天 / 具体日期', () => {
    expect(dayLabel('2026-10-11', NOW)).toBe('今天')
    expect(dayLabel('2026-10-10', NOW)).toBe('昨天')
    expect(dayLabel('2026-10-09', NOW)).toBe('10月9日 周五')
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
