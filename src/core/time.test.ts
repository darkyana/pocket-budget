import { describe, expect, it } from 'vitest'
import { dayKeyOf, daysInMonth, isSameWeek, monthKeyOf, projectMonthEnd, startOfWeek, timestampOf } from './time'

// 2026-10-05 是周一，2026-10-11 是周日
describe('time', () => {
  it('startOfWeek 以周一为一周之始：周日入叔回到本周周一零点', () => {
    const mon = startOfWeek(new Date(2026, 9, 11, 15, 30)) // 周日下午
    expect(mon.getDay()).toBe(1)
    expect(mon.getFullYear()).toBe(2026)
    expect(mon.getMonth()).toBe(9)
    expect(mon.getDate()).toBe(5)
    expect(mon.getHours()).toBe(0)
  })

  it('startOfWeek 周一入参仍是当天零点', () => {
    const mon = startOfWeek(new Date(2026, 9, 5, 8, 0))
    expect(mon.getDate()).toBe(5)
    expect(mon.getHours()).toBe(0)
  })

  it('isSameWeek：周日→周一跨周为 false，同周任意两天为 true', () => {
    expect(isSameWeek(new Date(2026, 9, 4), new Date(2026, 9, 5))).toBe(false) // 周日 → 周一
    expect(isSameWeek(new Date(2026, 9, 5), new Date(2026, 9, 11))).toBe(true) // 周一 → 周日
  })

  it('monthKeyOf / dayKeyOf 补零', () => {
    expect(monthKeyOf(new Date(2026, 9, 11))).toBe('2026-10')
    expect(monthKeyOf(new Date(2026, 0, 3))).toBe('2026-01')
    expect(dayKeyOf(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('daysInMonth 处理大小月', () => {
    expect(daysInMonth(new Date(2026, 9, 11))).toBe(31) // 10 月
    expect(daysInMonth(new Date(2026, 10, 11))).toBe(30) // 11 月
  })

  it('projectMonthEnd 按已过天数比例外推月底', () => {
    const now = new Date(2026, 9, 11) // 31 天的月，已过 11 天
    expect(projectMonthEnd(340, now)).toBeCloseTo(340 * (31 / 11))
    const firstDay = new Date(2026, 9, 1) // 月初第一天：推算 = 本月已花 × 31
    expect(projectMonthEnd(100, firstDay)).toBeCloseTo(3100)
  })

  it('timestampOf：空串 = 现在；日期串 = 该日 + 当前时分（补记场景）', () => {
    const now = new Date(2026, 9, 12, 21, 30, 5)
    expect(timestampOf('', now)).toBe(now.getTime())
    expect(timestampOf('2026-10-11', now)).toBe(new Date(2026, 9, 11, 21, 30, 5).getTime())
    expect(timestampOf('2026-01-03', now)).toBe(new Date(2026, 0, 3, 21, 30, 5).getTime())
  })
})
