import { describe, expect, it } from 'vitest'
import { defaultSettings } from './seed'
import { sampleRecords } from './sample'
import { budgetViews, dayRetroMonth, fixedExpensesThisPeriod, routineToday, visibleBudgets } from './derive'

const NOW = new Date(2026, 9, 24, 21, 0)

const bucketStatus = (left: number, expect: number) => (left < 0 ? 'over' : left < expect * 0.2 ? 'warn' : 'ok')

describe('首跑示例数据', () => {
  const settings = defaultSettings(NOW)
  const records = sampleRecords(NOW)

  it('今日日常桶呈现省/贴近/超三态', () => {
    const today = routineToday(records, settings, NOW)
    const statuses = new Set(today.buckets.filter((b) => b.spent > 0).map((b) => bucketStatus(b.left, b.expect)))
    expect([...statuses].sort()).toEqual(['ok', 'over', 'warn'])
  })

  it('当月已过天覆盖省/贴近/超三态', () => {
    const days = dayRetroMonth(records, settings, NOW).filter((d) => d.passed && !d.isToday)
    for (const s of ['ok', 'warn', 'over'] as const) {
      expect(days.some((d) => d.status === s), s).toBe(true)
    }
  })

  it('预算呈现省与贴近，超支预算弱化保留在末尾', () => {
    const views = budgetViews(records, settings, NOW)
    const by = new Map(views.map((v) => [v.name, v]))
    const shopping = by.get('购物')
    const study = by.get('学习')
    expect(shopping !== undefined && shopping.weekLeft > 0 && shopping.weekLeft < shopping.weekBudget * 0.2).toBe(true)
    expect(study !== undefined && study.weekLeft >= study.weekBudget * 0.2).toBe(true)
    expect(by.get('娱乐')!.weekLeft).toBeLessThan(0)
    expect(visibleBudgets(views).map((v) => v.name)).toEqual(['学习', '购物', '娱乐'])
  })

  it('固定支出已付未付并存且时间不晚于当前', () => {
    const fixed = fixedExpensesThisPeriod(records, settings, NOW)
    expect(fixed.filter((c) => c.paid).map((c) => c.name).sort()).toEqual(['会员年费', '物业费'])
    expect(fixed.filter((c) => !c.paid).map((c) => c.name).sort()).toEqual(['宠物粮', '家政服务'])
    expect(records.every((r) => r.ts <= NOW.getTime())).toBe(true)
  })
})
