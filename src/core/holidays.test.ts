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
