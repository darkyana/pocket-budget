import { describe, expect, it } from 'vitest'
import type { MoneyRecord } from './types'
import { filterRecords } from './recordsFilter'

const records: MoneyRecord[] = [
  { id: 'before', kind: 'routine', category: '宠物粮', amount: 20, note: '', ts: new Date(2026, 9, 20, 23, 59).getTime() },
  { id: 'start', kind: 'routine', category: '宠物粮', amount: 20, note: '', ts: new Date(2026, 9, 21, 0, 0).getTime() },
  { id: 'end', kind: 'transfer', from: '储蓄卡', to: '备用金', amount: 20, note: '', ts: new Date(2026, 9, 22, 23, 59).getTime() },
  { id: 'after', kind: 'budget', budget: '宠物粮', dir: 'in', amount: 20, note: '', ts: new Date(2026, 9, 23, 0, 0).getTime() },
]

describe('流水 filtering', () => {
  it('matches only the selected local day, including its full final minute', () => {
    expect(filterRecords(records, { from: '2026-10-22', to: '2026-10-22' }).map((r) => r.id)).toEqual(['end'])
  })

  it.each([
    { from: '2026-10-21', to: '' },
    { from: '', to: '2026-10-22' },
    { from: '2026-10-22', to: '2026-10-21' },
  ])('rejects incomplete or reversed ranges: %j', (dates) => {
    expect(() => filterRecords(records, dates)).toThrow('请选择完整且有效的日期范围')
  })
  it('shows all dates by default and after clearing an exact inclusive range', () => {
    expect(filterRecords(records).map((r) => r.id)).toEqual(['before', 'start', 'end', 'after'])
    expect(filterRecords(records, { from: '2026-10-21', to: '2026-10-22' }).map((r) => r.id)).toEqual(['start', 'end'])
    expect(filterRecords(records, { from: '', to: '' })).toEqual(records)
  })
})
