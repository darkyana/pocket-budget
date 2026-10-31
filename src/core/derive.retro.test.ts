import { describe, expect, it } from 'vitest'
import type { MoneyRecord, Settings } from './types'
import { budgetViews, kindStatOf, monthOverview } from './derive'

const settings: Settings = {
  dayType: '工作日',
  dayPlans: { 工作日: [{ name: '三餐', expect: 50 }] },
  budgets: [
    { name: '购物', month: 800 },
    { name: '学习', month: 300 },
  ],
  fixedExpenses: [
    { name: '宠物粮', amount: 400 },
    { name: '会员年费', amount: 600, cycle: 'yearly' },
  ],
  accounts: ['储蓄卡'],
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
const commit = (item: string, paid: boolean, periodKey: string, at: number, amount = 420): MoneyRecord =>
  ({ id: `c${++seq}`, ts: at, kind: 'fixed', item, amount, periodKey, paid })
const transfer = (from: string, to: string, amount: number, at: number): MoneyRecord =>
  ({ id: `t${++seq}`, ts: at, kind: 'transfer', from, to, amount, note: '' })

const kindOf = (view: ReturnType<typeof monthOverview>, key: 'routine' | 'budget' | 'fixed') => kindStatOf(view, key)

describe('monthOverview 全口径月总览', () => {
  it('未归属预算支出计入 totalAmount 与 unassigned 字段，但不进三类笔数', () => {
    const records = [
      routine('三餐', 30, ts(11, 9)),
      budgetOut('', 62, ts(10, 16)),
    ]
    const view = monthOverview(records, NOW)
    expect(view.unassigned).toEqual({ count: 1, amount: 62 })
    expect(kindOf(view, 'budget')).toEqual({ key: 'budget', count: 0, amount: 0 })
    expect(view.totalAmount).toBe(92)
    expect(view.totalCount).toBe(1)
  })

  it('未归属回血冲减净额；净额为零且无支出时 unassigned 为 null', () => {
    const netted = monthOverview([budgetOut('', 80, ts(5)), budgetIn('', 30, ts(5, 13))], NOW)
    expect(netted.unassigned).toEqual({ count: 1, amount: 50 })
    expect(netted.totalAmount).toBe(50)
    const settled = monthOverview([budgetOut('', 80, ts(5)), budgetIn('', 80, ts(5, 13))], NOW)
    expect(settled.unassigned).toEqual({ count: 1, amount: 0 })
    expect(settled.totalAmount).toBe(0)
    expect(monthOverview([routine('三餐', 10, ts(5))], NOW).unassigned).toBeNull()
  })

  it('仅有未归属回血时不触发提醒：unassigned 为 null，净额仍冲减总数', () => {
    const view = monthOverview([budgetIn('', 80, ts(5, 13))], NOW)
    expect(view.unassigned).toBeNull()
    expect(view.totalAmount).toBe(-80)
  })

  it('回血冲减预算净额：预算金额 = 支出 − 回血，笔数只数支出', () => {
    const records = [budgetOut('购物', 100, ts(11, 10)), budgetIn('购物', 30, ts(11, 11))]
    const view = monthOverview(records, NOW)
    expect(kindOf(view, 'budget')).toEqual({ key: 'budget', count: 1, amount: 70 })
  })

  it('走账只进 transfers 计数，金额不进任何汇总', () => {
    const records = [
      transfer('储蓄卡', '备用金', 500, ts(3, 20)),
      transfer('储蓄卡', '电子钱包', 200, ts(10, 21)),
      transfer('储蓄卡', '备用金', 999, new Date(2026, 8, 30, 9).getTime()),
    ]
    const view = monthOverview(records, NOW)
    expect(view.transfers).toBe(2)
    expect(view.totalAmount).toBe(0)
    expect(view.totalCount).toBe(0)
  })

  it('固定已付按最新一期：后续未付记录冲掉先前已付，跨月已付不进本月', () => {
    const superseded = monthOverview(
      [commit('宠物粮', true, '2026-10', ts(2, 10)), commit('宠物粮', false, '2026-10', ts(3, 10))],
      NOW,
    )
    expect(kindOf(superseded, 'fixed')).toEqual({ key: 'fixed', count: 0, amount: 0 })
    const repaid = monthOverview(
      [commit('宠物粮', false, '2026-10', ts(2, 10)), commit('宠物粮', true, '2026-10', ts(3, 10), 400)],
      NOW,
    )
    expect(kindOf(repaid, 'fixed')).toEqual({ key: 'fixed', count: 1, amount: 400 })
    const lastMonth = monthOverview([commit('宠物粮', true, '2026-09', new Date(2026, 8, 5, 10).getTime())], NOW)
    expect(kindOf(lastMonth, 'fixed')).toEqual({ key: 'fixed', count: 0, amount: 0 })
  })

  it('年付周期内已付进当月总览，月付与年付互不串期', () => {
    const records = [
      commit('会员年费', true, '2026', ts(4, 12), 200),
      commit('宠物粮', true, '2026-10', ts(5, 12), 400),
    ]
    const view = monthOverview(records, NOW)
    expect(kindOf(view, 'fixed')).toEqual({ key: 'fixed', count: 2, amount: 600 })
  })

  it('上月流水不进本月任何口径', () => {
    const records = [
      routine('三餐', 30, new Date(2026, 8, 30, 9).getTime()),
      budgetOut('购物', 100, new Date(2026, 8, 30, 10).getTime()),
      budgetOut('', 50, new Date(2026, 8, 30, 11).getTime()),
    ]
    const view = monthOverview(records, NOW)
    expect(view.totalAmount).toBe(0)
    expect(view.totalCount).toBe(0)
    expect(view.transfers).toBe(0)
    expect(view.unassigned).toBeNull()
  })
})

describe('budgetViews 月口径', () => {
  it('月净额 = 支出 − 回血；月支出笔数与回血笔数分计；月度百分比分母为月额度', () => {
    const records = [
      budgetOut('购物', 100, ts(11, 10)),
      budgetOut('购物', 60, ts(4, 10)),
      budgetIn('购物', 30, ts(11, 11)),
    ]
    const [view] = budgetViews(records, settings, NOW)
    expect(view.monthSpent).toBe(130)
    expect(view.monthOutCount).toBe(2)
    expect(view.monthBackflow).toBe(1)
    expect(view.month).toBe(800)
    expect(view.monthSpent / view.month).toBeCloseTo(130 / 800)
  })

  it('月度字段跨周累计：各周流水都进月口径', () => {
    const records = [budgetOut('购物', 50, ts(4)), budgetOut('购物', 100, ts(11))]
    const [view] = budgetViews(records, settings, NOW)
    expect(view.monthSpent).toBe(150)
    expect(view.monthOutCount).toBe(2)
  })
})
