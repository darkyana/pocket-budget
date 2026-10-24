import { describe, expect, it } from 'vitest'
import { money, moneyExact } from './format'

describe('money', () => {
  it('整元金额过千分组显示千分位', () => {
    expect(money(1234)).toBe('¥1,234')
    expect(money(1234567)).toBe('¥1,234,567')
  })

  it('整元不足一千不分组', () => {
    expect(money(999)).toBe('¥999')
    expect(money(0)).toBe('¥0')
  })

  it('整元负数保留符号并分组', () => {
    expect(money(-1234)).toBe('¥-1,234')
  })

  it('四舍五入到整元后仍按千分位分组', () => {
    expect(money(1234.6)).toBe('¥1,235')
  })

  it('负数舍入到零时显示 0 而非 -0', () => {
    expect(money(-0.4)).toBe('¥0')
  })
})

describe('moneyExact', () => {
  it('两位小数金额过千分组显示千分位', () => {
    expect(moneyExact(1234.5)).toBe('¥1,234.50')
  })

  it('两位小数不足一千不分组', () => {
    expect(moneyExact(999)).toBe('¥999.00')
  })

  it('零恒显两位小数', () => {
    expect(moneyExact(0)).toBe('¥0.00')
  })

  it('两位小数负数保留符号并分组', () => {
    expect(moneyExact(-1234.5)).toBe('¥-1,234.50')
  })

  it('负数舍入到零时显示 0.00 而非 -0.00', () => {
    expect(moneyExact(-0.001)).toBe('¥0.00')
  })

  it('进位到整元后按千分位分组', () => {
    expect(moneyExact(999.999)).toBe('¥1,000.00')
  })

  it('半分位按十进制最短值进位', () => {
    expect(moneyExact(1.005)).toBe('¥1.01')
    expect(moneyExact(2.675)).toBe('¥2.68')
  })

  it('半分位按四舍五入进位', () => {
    expect(moneyExact(-0.005)).toBe('¥-0.01')
  })
})
