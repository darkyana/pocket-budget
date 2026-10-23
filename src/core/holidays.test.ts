import { describe, expect, it } from 'vitest'
import { isRestDay } from './holidays'
import { autoDayType, syncedDayType, todayDayType } from './derive'
import type { Settings } from './types'

const d = (s: string) => new Date(`${s}T12:00:00`)

describe('isRestDay 2026 法定节假日表（国办发明电〔2025〕7号）', () => {
  it('普通工作日与周末', () => {
    expect(isRestDay(d('2026-10-13'))).toBe(false) // 周二
    expect(isRestDay(d('2026-10-17'))).toBe(true) // 周六
  })

  it('法定节假日整体放假（含其间的工作日）', () => {
    expect(isRestDay(d('2026-10-01'))).toBe(true) // 国庆 周四
    expect(isRestDay(d('2026-02-17'))).toBe(true) // 春节 周二
  })

  it('调休上班的周末不算休', () => {
    expect(isRestDay(d('2026-10-10'))).toBe(false) // 周六 国庆调休
    expect(isRestDay(d('2026-01-04'))).toBe(false) // 周日 元旦调休
  })

  it('表外日期退回朴素周末规则', () => {
    expect(isRestDay(d('2027-01-02'))).toBe(true) // 周六
    expect(isRestDay(d('2027-01-04'))).toBe(false) // 周一
  })
})

describe('calendar table coverage', () => {
  it.each([
    '2026-01-04', '2026-02-14', '2026-02-28',
    '2026-05-09', '2026-09-20', '2026-10-10',
  ])('classifies adjusted working weekend %s as a workday', date => {
    expect(isRestDay(d(date))).toBe(false)
  })

  it.each([
    ['2026-07-06', false],
    ['2026-07-11', true],
    ['2026-07-12', true],
    ['2025-01-01', false],
    ['2025-01-04', true],
    ['2025-01-05', true],
    ['2027-01-01', false],
    ['2027-01-02', true],
    ['2027-01-03', true],
  ] as const)('uses ordinary weekday/weekend rules for %s', (date, expected) => {
    expect(isRestDay(d(date))).toBe(expected)
  })

  it.each([
    ['2025-12-31', '2026-01-01', '2026-01-03', '2026-01-04'],
    ['2026-02-14', '2026-02-15', '2026-02-23', '2026-02-24'],
    ['2026-04-03', '2026-04-04', '2026-04-06', '2026-04-07'],
    ['2026-04-30', '2026-05-01', '2026-05-05', '2026-05-06'],
    ['2026-06-18', '2026-06-19', '2026-06-21', '2026-06-22'],
    ['2026-09-24', '2026-09-25', '2026-09-27', '2026-09-28'],
    ['2026-09-30', '2026-10-01', '2026-10-07', '2026-10-08'],
  ])('preserves the inclusive holiday between %s and %s through %s before %s', (before, start, end, after) => {
    expect(isRestDay(d(before))).toBe(false)
    for (const day = d(start); day <= d(end); day.setDate(day.getDate() + 1)) {
      expect(isRestDay(day), day.toDateString()).toBe(true)
    }
    expect(isRestDay(d(after))).toBe(false)
  })
})

const base: Settings = {
  dayType: '工作日',
  dayPlans: { 工作日: [], 周末日: [], 假期日: [] },
  budgets: [],
  fixedExpenses: [],
  accounts: [],
}

describe('autoDayType / todayDayType 日型推断', () => {
  it('休息日→周末日，工作日→工作日', () => {
    expect(autoDayType(d('2026-10-13'), ['工作日', '周末日'])).toBe('工作日')
    expect(autoDayType(d('2026-10-01'), ['工作日', '周末日'])).toBe('周末日')
  })

  it('当天手动指定优先；跨天自动失效', () => {
    const s: Settings = { ...base, dayType: '假期日', dayTypeSetFor: '2026-10-13' }
    expect(todayDayType(s, d('2026-10-13'))).toBe('假期日')
    expect(todayDayType(s, d('2026-10-14'))).toBe('工作日')
  })

  it('指定的日型已不存在时回自动', () => {
    const s: Settings = { ...base, dayType: '已删除', dayTypeSetFor: '2026-10-13' }
    expect(todayDayType(s, d('2026-10-13'))).toBe('工作日')
  })
})

describe('syncedDayType 启动对齐', () => {
  it('过期指定被清掉，dayType 对齐到自动值', () => {
    const s: Settings = { ...base, dayType: '假期日', dayTypeSetFor: '2026-10-12' }
    const out = syncedDayType(s, d('2026-10-13'))
    expect(out.dayType).toBe('工作日')
    expect(out.dayTypeSetFor).toBeUndefined()
  })

  it('一致时原样返回', () => {
    const s: Settings = { ...base, dayType: '工作日' }
    expect(syncedDayType(s, d('2026-10-13'))).toBe(s)
  })
})
