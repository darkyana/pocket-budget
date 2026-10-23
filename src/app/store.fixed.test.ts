import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistedState } from '../core/types'
import { freshState } from '../storage/migrate'
import { groupByDay } from '../core/derive'
import { buildFamilyLedgerVoucher } from '../storage/voucher'

const disk = vi.hoisted(() => ({ state: undefined as PersistedState | undefined }))
vi.mock('../storage/db', () => ({
  saveState: async (state: PersistedState) => { disk.state = structuredClone(state) },
  loadState: async () => structuredClone(disk.state),
  requestPersistence: async () => {},
}))
import { useApp } from './store'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 20, 12))
  const state = freshState()
  state.settings.fixedExpenses = [{ name: '宠物粮', amount: 40 }, { name: '会员年费', amount: 100, cycle: 'yearly' }]
  disk.state = state
  useApp.setState({ ...state, ready: true })
})
afterEach(() => vi.useRealTimers())

describe('fixed payment store actions', () => {
  it('keeps an amount edit retrospective when settings also rename the item', async () => {
    useApp.getState().toggleFixedExpense('宠物粮')
    useApp.getState().updateSettings((draft) => { draft.fixedExpenses[0] = { name: '物业费', amount: 60 } })
    useApp.getState().renameAnchor('fixed', '宠物粮', '物业费')
    await useApp.getState().init()
    expect(useApp.getState().records[0]).toMatchObject({ item: '物业费', amount: 60 })
  })

  it('toggles legacy histories without retaining old payments or changing unrelated periods', async () => {
    const payment = { id: 'old', kind: 'fixed' as const, item: '宠物粮', amount: 40, paid: true, periodKey: '2026-10', ts: new Date(2026, 9, 9).getTime(), account: '储蓄卡' }
    const previous = { ...payment, id: 'previous', periodKey: '2026-09' }
    useApp.setState({ records: [previous, payment, { ...payment, id: 'latest', ts: payment.ts + 1 }] })
    useApp.getState().toggleFixedExpense('宠物粮')
    await useApp.getState().init()
    expect(useApp.getState().records).toEqual([previous])
    useApp.getState().toggleFixedExpense('宠物粮')
    useApp.getState().toggleFixedExpense('宠物粮')
    useApp.getState().toggleFixedExpense('宠物粮')
    await useApp.getState().init()
    expect(useApp.getState().records).toHaveLength(2)
    expect(buildFamilyLedgerVoucher(useApp.getState().records).voucher.rows.map((r) => r.ref_id)).toEqual(['previous'])
  })

  it('deletes an effective legacy payment without restoring earlier toggles', async () => {
    const payment = { id: 'old', kind: 'fixed' as const, item: '宠物粮', amount: 40, paid: true, periodKey: '2026-10', ts: new Date(2026, 9, 9).getTime(), account: '储蓄卡' }
    useApp.setState({ records: [payment, { ...payment, id: 'latest', ts: payment.ts + 1 }] })
    useApp.getState().deleteRecord('latest')
    await useApp.getState().init()
    expect(groupByDay(useApp.getState().records)).toEqual([])
    expect(buildFamilyLedgerVoucher(useApp.getState().records).voucher.rows).toEqual([])
  })

  it.each(['monthly', 'yearly'] as const)('rejects occupied %s periods and reassigns into empty periods without reviving history', async (cycle) => {
    const item = cycle === 'monthly' ? '宠物粮' : '会员年费'
    const period = cycle === 'monthly' ? '2026-10' : '2026'
    const occupied = cycle === 'monthly' ? '2026-09' : '2025'
    const destination = cycle === 'monthly' ? '2026-08-10' : '2024-08-10'
    const collisionDate = cycle === 'monthly' ? '2026-09-10' : '2025-09-10'
    const old = { id: 'old', kind: 'fixed' as const, item, amount: 40, paid: true, periodKey: period, ts: new Date(2026, 9, 9).getTime(), account: '储蓄卡' }
    const current = { ...old, id: 'current', ts: new Date(2026, 9, 10).getTime() }
    const other = { ...old, id: 'other', periodKey: occupied, ts: new Date(collisionDate + 'T12:00:00').getTime() }
    useApp.setState({ records: [old, current, other] })
    useApp.getState().updateSettings(() => {})
    const before = structuredClone(disk.state)
    expect(() => useApp.getState().editFixedExpense('current', { date: collisionDate, account: '备用金' })).toThrow('该期间已有付款')
    expect(useApp.getState().records).toEqual(before?.records)
    expect(disk.state).toEqual(before)
    useApp.getState().editFixedExpense('current', { date: destination, account: '备用金' })
    await useApp.getState().init()
    expect(useApp.getState().records).toHaveLength(2)
    expect(useApp.getState().records.find((e) => e.id === 'current')).toMatchObject({ periodKey: cycle === 'monthly' ? '2026-08' : '2024', account: '备用金' })
    expect(groupByDay(useApp.getState().records).flatMap((d) => d.records).map((e) => e.id)).not.toContain('old')
  })

  it('updates historical monthly and yearly amounts in persistence, totals and export', async () => {
    useApp.setState({ records: [
      { id: 'm1', kind: 'fixed', item: '宠物粮', amount: 40, paid: true, periodKey: '2026-09', ts: new Date(2026, 8, 10).getTime(), account: '储蓄卡' },
      { id: 'm2', kind: 'fixed', item: '宠物粮', amount: 40, paid: true, periodKey: '2026-10', ts: new Date(2026, 9, 10).getTime(), account: '储蓄卡' },
      { id: 'y1', kind: 'fixed', item: '会员年费', amount: 100, paid: true, periodKey: '2025', ts: new Date(2025, 0, 10).getTime(), account: '备用金' },
      { id: 'y2', kind: 'fixed', item: '会员年费', amount: 100, paid: true, periodKey: '2026', ts: new Date(2026, 0, 10).getTime(), account: '备用金' },
    ] })
    useApp.getState().updateSettings((draft) => {
      draft.fixedExpenses[0].amount = 60
      draft.fixedExpenses[1].amount = 120
    })
    await useApp.getState().init()
    const records = useApp.getState().records
    expect(records.map((e) => e.amount)).toEqual([60, 60, 120, 120])
    expect(groupByDay(records).map((d) => d.outflow)).toEqual([60, 60, 120, 120])
    expect(buildFamilyLedgerVoucher(records).voucher.rows.map((r) => r.amount)).toEqual([-60, -60, -120, -120])
  })

  it('cancels a payment and pays afresh without restoring its account or identity', async () => {
    useApp.getState().toggleFixedExpense('宠物粮')
    const old = useApp.getState().records[0]
    useApp.getState().editFixedExpense(old.id, { account: '储蓄卡', date: '2026-10-20' })
    useApp.getState().toggleFixedExpense('宠物粮')
    expect(useApp.getState().records).toEqual([])
    await useApp.getState().init()
    expect(groupByDay(useApp.getState().records)).toEqual([])
    expect(buildFamilyLedgerVoucher(useApp.getState().records).voucher.rows).toEqual([])
    vi.setSystemTime(new Date(2026, 9, 21, 12))
    useApp.getState().updateSettings((draft) => { draft.fixedExpenses[0].amount = 60 })
    useApp.getState().toggleFixedExpense('宠物粮')
    await useApp.getState().init()
    const records = useApp.getState().records
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ amount: 60, ts: new Date(2026, 9, 21, 12).getTime(), paid: true })
    expect(records[0].id).not.toBe(old.id)
    expect(records[0]).not.toHaveProperty('account')
    expect(buildFamilyLedgerVoucher(records).skipped).toBe(1)
  })
})
