import { describe, expect, it } from 'vitest'
import type { MoneyRecord, Settings } from './types'
import {
  dayRetroMonth,
  fixedExpensePaid,
  fixedExpensesThisPeriod,
  dayLabel,
  groupByDay,
  budgetViews,
  monthQuickCalc,
  renameRecordAnchor,
  retroStats,
  routinePace,
  routineToday,
  visibleBudgets,
  withAccount,
} from './derive'

const settings: Settings = {
  dayType: '工作日',
  dayTypeSetFor: '2026-10-11',
  dayPlans: { 工作日: [{ name: '三餐', expect: 50 }, { name: '咖啡', expect: 20 }] },
  budgets: [
    { name: '购物', month: 800 },
    { name: '学习', month: 300 },
  ],
  fixedExpenses: [
      { name: '宠物粮', amount: 400 },
      { name: '域名', amount: 600, cycle: 'yearly' },
    ],
    accounts: ['现金'],
}

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

const paceSettings: Settings = {
  dayType: '工作日',
  dayPlans: {
    工作日: [{ name: '三餐', expect: 130 }],
    周末日: [{ name: '三餐', expect: 830 }],
  },
  budgets: [],
  fixedExpenses: [],
  accounts: [],
}

describe('routineToday', () => {
  it('只聚合今日流水，昨日与别的类别不计入', () => {
    const records = [
      routine('三餐', 30, ts(11, 9)),
      routine('三餐', 40, ts(10)),
      routine('咖啡', 25, ts(11, 15)),
    ]
    const view = routineToday(records, settings, NOW)
    const meals = view.buckets.find((b) => b.name === '三餐')!
    const coffee = view.buckets.find((b) => b.name === '咖啡')!
    expect(meals.spent).toBe(30)
    expect(meals.left).toBe(20)
    expect(coffee.spent).toBe(25)
    expect(coffee.left).toBe(-5)
    expect(view.totalSpent).toBe(55)
    expect(view.totalExpect).toBe(70)
    expect(view.left).toBe(15)
  })
})

describe('routinePace 当前消费力', () => {
  const base = paceSettings

  it('分子 = 本月全部日常流水（含已删类目）；分母 = 1 号至今按日历日型累加期望全额', () => {
    const records = [
      routine('已删掉的奶茶', 200, ts(5)),
      routine('三餐', 100, ts(8, 9)),
      routine('三餐', 50, ts(11, 9)),
      routine('三餐', 30, new Date(2026, 8, 30, 12).getTime()),
      budgetOut('购物', 999, ts(11, 10)),
    ]
    const view = routinePace(records, base, NOW)
    expect(view.spent).toBe(350)
    expect(view.possible).toBe(3 * 130 + 8 * 830)
    expect(view.ratio).toBeCloseTo(350 / 7030)
  })

  it('手动指定的日型不计入分母（当天 10-11 被钉成工作日，仍按日历算休息日）', () => {
    const pinned: Settings = { ...base, dayType: '工作日', dayTypeSetFor: '2026-10-11' }
    const view = routinePace([], pinned, NOW)
    expect(view.possible).toBe(3 * 130 + 8 * 830)
  })

  it('跨月归零：上月流水不计，月初分母只含当天', () => {
    const nov1 = new Date(2026, 10, 1, 20, 0)
    const records = [routine('三餐', 500, ts(11, 9))]
    const view = routinePace(records, base, nov1)
    expect(view.spent).toBe(0)
    expect(view.possible).toBe(830)
    expect(view.ratio).toBe(0)
  })

  it('分母为 0（未配置日常）：possible = 0，ratio = 0，界面据此隐藏', () => {
    const empty: Settings = { ...base, dayPlans: {} }
    const view = routinePace([routine('三餐', 100, ts(11))], empty, NOW)
    expect(view.possible).toBe(0)
    expect(view.ratio).toBe(0)
  })

  it('超 100% 返回原始比率，不截断', () => {
    const records = [routine('三餐', 8000, ts(11, 9))]
    const view = routinePace(records, base, NOW)
    expect(view.ratio).toBeCloseTo(8000 / 7030)
  })
})

describe('dayRetroMonth 快速回顾 · 逐日', () => {
  const base = paceSettings

  it('日型按日历：国庆休 → 周末日、10-10 调休上班 → 工作日；流水只进当月当天', () => {
    const records = [
      routine('三餐', 100, ts(1, 9)),
      routine('三餐', 50, ts(10, 9)),
      routine('三餐', 30, new Date(2026, 8, 30, 12).getTime()),
      budgetOut('购物', 999, ts(11, 10)),
    ]
    const month = dayRetroMonth(records, base, NOW)
    expect(month).toHaveLength(31)
    expect(month[0].dayType).toBe('周末日')
    expect(month[0].expect).toBe(830)
    expect(month[0].spent).toBe(100)
    expect(month[9].dayType).toBe('工作日')
    expect(month[9].expect).toBe(130)
    expect(month[9].spent).toBe(50)
    expect(month[10].isToday).toBe(true)
    expect(month[10].entries).toHaveLength(0)
    expect(month[11].passed).toBe(false)
    expect(month[11].spent).toBe(0)
  })

  it('三色阈值：<80% 绿、恰 80% 橙、恰 100% 橙、>100% 红', () => {
    const records = [
      routine('三餐', 100, ts(8, 9)),
      routine('三餐', 104, ts(9, 9)),
      routine('三餐', 130, ts(10, 9)),
    ]
    const month = dayRetroMonth(records, base, NOW)
    expect(month[7].status).toBe('ok')
    expect(month[8].status).toBe('warn')
    expect(month[9].status).toBe('warn')
    const over = dayRetroMonth([routine('三餐', 131, ts(8, 9))], base, NOW)
    expect(over[7].status).toBe('over')
  })

  it('当日型未配置期望：有支出 → 红 + Infinity；无支出 → 绿 + 0', () => {
    const noWork: Settings = { ...base, dayPlans: { 工作日: [], 周末日: [{ name: '三餐', expect: 830 }] } }
    const month = dayRetroMonth([routine('三餐', 5, ts(8, 9))], noWork, NOW)
    expect(month[7].expect).toBe(0)
    expect(month[7].ratio).toBe(Infinity)
    expect(month[7].status).toBe('over')
    expect(month[8].expect).toBe(0)
    expect(month[8].ratio).toBe(0)
    expect(month[8].status).toBe('ok')
  })

  it('当日手动指定的日型不计入（10-11 钉成工作日，日历仍按休息日算）', () => {
    const pinned: Settings = { ...base, dayType: '工作日', dayTypeSetFor: '2026-10-11' }
    const month = dayRetroMonth([], pinned, NOW)
    expect(month[10].dayType).toBe('周末日')
    expect(month[10].expect).toBe(830)
  })

  it('月初第 1 天：只有一格已过，统计退化单日', () => {
    const nov1 = new Date(2026, 10, 1, 20, 0)
    const records = [routine('三餐', 100, new Date(2026, 10, 1, 9).getTime())]
    const month = dayRetroMonth(records, base, nov1)
    expect(month).toHaveLength(30)
    expect(month.filter((d) => d.passed)).toHaveLength(1)
    const stats = retroStats(month)
    expect(stats.passedDays).toBe(1)
    expect(stats.restAvg?.days).toBe(1)
    expect(stats.workAvg).toBeNull()
  })
})

describe('retroStats 快速回顾 · 汇总', () => {
  const base = paceSettings

  it('三色天数、累计省/超、最省最超（只排 expect>0）、按日型分组（调休进工作日组）', () => {
    const records = [
      routine('三餐', 100, ts(1, 9)),
      routine('三餐', 104, ts(9, 9)),
      routine('三餐', 131, ts(10, 9)),
    ]
    const stats = retroStats(dayRetroMonth(records, base, NOW))
    expect(stats.passedDays).toBe(11)
    expect(stats.okDays).toBe(9)
    expect(stats.warnDays).toBe(1)
    expect(stats.overDays).toBe(1)
    expect(stats.spent).toBe(335)
    expect(stats.possible).toBe(3 * 130 + 8 * 830)
    expect(stats.saved).toBe(3 * 130 + 8 * 830 - 335)
    expect(stats.best?.day).toBe(2)
    expect(stats.worst?.day).toBe(10)
    expect(stats.workAvg).toMatchObject({ days: 3, spent: 235, expect: 390 })
    expect(stats.restAvg).toMatchObject({ days: 8, spent: 100, expect: 6640 })
  })

  it('expect=0 的天不进 best/worst：Infinity 日不得当「最超」', () => {
    const noWork: Settings = { ...paceSettings, dayPlans: { 工作日: [], 周末日: [{ name: '三餐', expect: 830 }] } }
    const records = [
      routine('三餐', 9999, ts(8, 9)),
      routine('三餐', 100, ts(1, 9)),
      routine('三餐', 200, ts(2, 9)),
    ]
    const stats = retroStats(dayRetroMonth(records, noWork, NOW))
    expect(stats.worst?.day).toBe(2)
    expect(stats.best?.day).toBe(3)
  })

  it('与今日页消费力同源：spent / possible 逐分逐合一致', () => {
    const records = [
      routine('已删掉的奶茶', 200, ts(5)),
      routine('三餐', 100, ts(8, 9)),
      routine('三餐', 50, ts(11, 9)),
      routine('三餐', 30, new Date(2026, 8, 30, 12).getTime()),
    ]
    const stats = retroStats(dayRetroMonth(records, base, NOW))
    const pace = routinePace(records, base, NOW)
    expect(stats.spent).toBe(pace.spent)
    expect(stats.possible).toBe(pace.possible)
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
    const records = [budgetOut('购物', 50, ts(4)), budgetOut('购物', 100, ts(11))]
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
    expect(fixedExpensePaid([], '宠物粮', 'monthly', NOW)).toBe(false)
    expect(fixedExpensePaid([], '域名', 'yearly', NOW)).toBe(false)
  })

  it('月付：上月已付不影响本月', () => {
    const lastMonthTs = new Date(2026, 8, 20, 10).getTime()
    const records = [commit('宠物粮', true, '2026-09', lastMonthTs)]
    expect(fixedExpensePaid(records, '宠物粮', 'monthly', NOW)).toBe(false)
  })

  it('月付：本月多条流水取最新一条', () => {
    const records = [commit('宠物粮', true, '2026-10', ts(11, 9)), commit('宠物粮', false, '2026-10', ts(11, 10))]
    expect(fixedExpensePaid(records, '宠物粮', 'monthly', NOW)).toBe(false)
  })

  it('年付：年内跨月保持已付，次年回未付', () => {
    const paidInOct = new Date(2026, 9, 5, 10).getTime()
    const records = [commit('域名', true, '2026', paidInOct)]
    expect(fixedExpensePaid(records, '域名', 'yearly', new Date(2026, 10, 20, 12))).toBe(true)
    expect(fixedExpensePaid(records, '域名', 'yearly', new Date(2027, 0, 3, 12))).toBe(false)
  })

  it('月键流水不会误匹配年付周期（防串周期）', () => {
    const records = [commit('域名', true, '2026-10', ts(11, 9))]
    expect(fixedExpensePaid(records, '域名', 'yearly', NOW)).toBe(false)
  })

  it('fixedExpensesThisPeriod 汇总（含周期，旧数据默认月付）', () => {
    const records = [commit('宠物粮', true, '2026-10', ts(11, 9))]
    expect(fixedExpensesThisPeriod(records, settings, NOW)).toEqual([
      { name: '宠物粮', amount: 400, cycle: 'monthly', paid: true },
      { name: '域名', amount: 600, cycle: 'yearly', paid: false },
    ])
  })
})

describe('groupByDay 流水分组', () => {
  it('按天倒序、天内按时间倒序；outflow 汇总资金净流出', () => {
    const records = [
      routine('三餐', 30, ts(10, 9)),
      routine('咖啡', 25, ts(11, 15)),
      budgetOut('购物', 100, ts(11, 10)),
      budgetIn('购物', 30, ts(11, 11)),
      transfer('现金', '储蓄卡', 500, ts(11, 12)),
      commit('宠物粮', true, '2026-10', ts(11, 8)),
    ]
    const groups = groupByDay(records)
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-10-11', '2026-10-10'])
    const today = groups[0]
    expect(today.records[0].kind).toBe('routine')
    expect(today.outflow).toBe(515)
    expect(groups[1].outflow).toBe(30)
  })

  it('dayLabel：今天 / 昨天 / 具体日期', () => {
    expect(dayLabel('2026-10-11', NOW)).toBe('今天')
    expect(dayLabel('2026-10-10', NOW)).toBe('昨天')
    expect(dayLabel('2026-10-09', NOW)).toBe('10月9日 周五')
  })
})

describe('monthQuickCalc 本月速算', () => {
  const base: Settings = {
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
      { name: '宠物粮', amount: 400 },
      { name: '域名', amount: 600, cycle: 'yearly' },
    ],
    accounts: [],
  }

  it('2026-10：18 工作日 + 13 休息日；日常按实际比率折算（缺省 60%）', () => {
    const qc = monthQuickCalc(base, NOW)
    expect(qc.workDays).toBe(18)
    expect(qc.restDays).toBe(13)
    expect(qc.workExpect).toBe(130)
    expect(qc.restExpect).toBe(830)
    expect(qc.routineBase).toBe(18 * 130 + 13 * 830)
    expect(qc.ratio).toBe(0.6)
    expect(qc.routineTotal).toBe((18 * 130 + 13 * 830) * 0.6)
    expect(qc.budgetTotal).toBe(1100)
    expect(qc.fixedMonthlyTotal).toBe(400)
    expect(qc.fixedYearlyAmortized).toBe(50)
    expect(qc.total).toBe((18 * 130 + 13 * 830) * 0.6 + 1100 + 400 + 50)
  })

  it('比率可调：routineSpendRatio 覆盖缺省', () => {
    const qc = monthQuickCalc({ ...base, routineSpendRatio: 1 }, NOW)
    expect(qc.ratio).toBe(1)
    expect(qc.routineTotal).toBe(18 * 130 + 13 * 830)
  })
})

describe('renameRecordAnchor 锚改名联动', () => {
  it('同名流水的锚字段一并改写，他类与不同名不动', () => {
    const records = [
      routine('三餐', 30, ts(11, 9)),
      routine('咖啡', 25, ts(11, 10)),
      budgetOut('三餐', 10, ts(11, 11)),
      commit('三餐', true, '2026-10', ts(11, 12)),
    ]
    const out = renameRecordAnchor(records, 'routine', '三餐', '食材')
    expect(out[0]).toMatchObject({ kind: 'routine', category: '食材' })
    expect(out[1]).toMatchObject({ kind: 'routine', category: '咖啡' })
    expect(out[2]).toMatchObject({ kind: 'budget', budget: '三餐' })
    expect(out[3]).toMatchObject({ kind: 'fixed', item: '三餐' })
  })

  it('无匹配时原数组原样返回', () => {
    const records = [routine('三餐', 30, ts(11, 9))]
    expect(renameRecordAnchor(records, 'budget', '购物', '别的')).toBe(records)
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
