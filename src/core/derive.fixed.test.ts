import { describe, expect, it } from 'vitest'
import { groupByDay, routineToday, routinePace, fixedExpensePaid } from './derive'
import { freshState } from '../storage/migrate'
import { buildFamilyLedgerVoucher } from '../storage/voucher'
import type { MoneyRecord } from './types'

const now = new Date(2026, 9, 20, 12)
const ts = now.getTime()
const fixed = (id: string, paid: boolean, offset = 0): Extract<MoneyRecord, { kind: 'fixed' }> => ({ id, ts: ts + offset, kind: 'fixed', item: '宠物粮', amount: 40, paid, periodKey: '2026-10', account: '储蓄卡' })

describe('effective fixed payments and signed daily spending', () => {
  it('counts all net spending while keeping routine metrics separate', () => {
    const records: MoneyRecord[] = [
      { id: 'r', ts, kind: 'routine', category: '宠物粮', amount: 20, note: '' },
      { id: 'b', ts, kind: 'budget', budget: '家政服务', dir: 'out', amount: 30, note: '' },
      { id: 'u', ts, kind: 'budget', budget: '', dir: 'out', amount: 10, note: '' },
      { id: 'i', ts, kind: 'budget', budget: '家政服务', dir: 'in', amount: 15, note: '' },
      { id: 'ui', ts, kind: 'budget', budget: '', dir: 'in', amount: 5, note: '' },
      { id: 't', ts, kind: 'transfer', from: '储蓄卡', to: '备用金', amount: 200, note: '' },
      fixed('paid', true),
    ]
    const settings = freshState().settings
    settings.dayPlans = { 工作日: [{ name: '宠物粮', expect: 100 }], 周末日: [{ name: '宠物粮', expect: 100 }] }
    expect(groupByDay(records)[0].outflow).toBe(80)
    expect(routineToday(records, settings, now).totalSpent).toBe(20)
    expect(routinePace(records, settings, now).spent).toBe(20)
    expect(groupByDay([records[0], { ...records[3], amount: 100 }])[0].outflow).toBe(-80)
  })

  it('projects legacy toggles once before grouping by payment date or exporting', () => {
    const records = [fixed('old', true), fixed('cancel', false, 86400000)]
    expect(groupByDay(records)).toEqual([])
    expect(buildFamilyLedgerVoucher(records).voucher.rows).toEqual([])
    records.push(fixed('fresh', true, 172800000))
    expect(groupByDay(records).flatMap((day) => day.records).map((e) => e.id)).toEqual(['fresh'])
    expect(buildFamilyLedgerVoucher(records).voucher.rows.map((e) => e.ref_id)).toEqual(['fresh'])
    expect(fixedExpensePaid(records, '宠物粮', 'monthly', now)).toBe(true)
    records.push({ ...fixed('accountless', true, 172800000), account: undefined })
    expect(buildFamilyLedgerVoucher(records).voucher.rows).toEqual([])
    expect(buildFamilyLedgerVoucher(records).skipped).toBe(1)
  })
})
