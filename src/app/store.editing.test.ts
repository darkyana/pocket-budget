import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApp } from './store'
import { freshState } from '../storage/migrate'
import { loadState } from '../storage/db'
import type { MoneyRecord } from '../core/types'

const disk = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('idb', () => ({
  openDB: async () => ({
    get: async () => structuredClone(disk.value),
    put: async (_store: string, value: unknown) => { disk.value = structuredClone(value) },
  }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 14, 25, 36))
  disk.value = freshState()
  useApp.setState({ ...freshState(), ready: false })
})

afterEach(() => vi.useRealTimers())

async function expectSavedRecords(records: MoneyRecord[]) {
  expect(useApp.getState().records).toEqual(records)
  expect((await loadState()).records).toEqual(records)
  useApp.setState({ records: [], ready: false })
  await useApp.getState().init()
  expect(useApp.getState().ready).toBe(true)
  expect(useApp.getState().records).toEqual(records)
}

describe('record editing persistence', () => {
  it.each(['routine', 'budget'] as const)('saves every %s edit field and supports conversion in both directions', async (kind) => {
    if (kind === 'routine') useApp.getState().addRhythm('宠物粮', 20, '', '储蓄卡', '2026-10-22')
    else useApp.getState().addBudgetEntry('宠物粮', 'out', 20, '', '储蓄卡', '2026-10-22')
    const id = useApp.getState().records[0].id

    useApp.getState().saveEntryRecord(id, {
      kind, category: '家政服务', budget: '家政服务', dir: 'in', amount: 42,
      note: '备用金', account: ' 电子钱包 ', date: '2026-10-21',
    })

    await expectSavedRecords([{
      id, ts: new Date(2026, 9, 21, 14, 25, 36).getTime(), amount: 42, note: '备用金', account: '电子钱包',
      ...(kind === 'routine' ? { kind, category: '家政服务' } : { kind, budget: '家政服务', dir: 'in' }),
    }])

    const convertedKind = kind === 'routine' ? 'budget' : 'routine'
    useApp.getState().saveEntryRecord(id, {
      kind: convertedKind, category: '物业费', budget: '', dir: 'out', amount: 18,
      note: '', account: '', date: '2026-10-20',
    })

    await expectSavedRecords([{
      id, ts: new Date(2026, 9, 20, 14, 25, 36).getTime(), amount: 18, note: '',
      ...(convertedKind === 'routine'
        ? { kind: convertedKind, category: '物业费' }
        : { kind: convertedKind, budget: '', dir: 'out' }),
    }])
  })

  it('preserves transfer endpoints when omitted and never converts transfers to budget records', async () => {
    useApp.getState().addTransfer('储蓄卡', '备用金', 20, '', '2026-10-22')
    const id = useApp.getState().records[0].id

    useApp.getState().editRecord(id, { account: '', amount: 18, note: '备用金', date: '2026-10-21' })
    useApp.getState().saveEntryRecord(id, {
      kind: 'budget', budget: '家政服务', dir: 'in', amount: 42,
      note: '', account: '电子钱包', date: '2026-10-20',
    })

    await expectSavedRecords([{
      id, kind: 'transfer', from: '储蓄卡', to: '备用金', amount: 18, note: '备用金',
      ts: new Date(2026, 9, 21, 14, 25, 36).getTime(),
    }])
  })

  it('saves fixed payment date and account while preserving its other fields', async () => {
    useApp.getState().updateSettings((settings) => {
      settings.fixedExpenses = [{ name: '会员年费', amount: 120, cycle: 'yearly' }]
    })
    useApp.getState().toggleFixedExpense('会员年费')
    const original = useApp.getState().records[0]

    useApp.getState().editFixedExpense(original.id, { account: ' 电子钱包 ', date: '2026-10-21' })

    await expectSavedRecords([{
      id: original.id, kind: 'fixed', item: '会员年费', amount: 120, periodKey: '2026', paid: true,
      account: '电子钱包', ts: new Date(2026, 9, 21, 14, 25, 36).getTime(),
    }])

    useApp.getState().editFixedExpense(original.id, { account: '', date: '2026-10-20' })

    await expectSavedRecords([{
      id: original.id, kind: 'fixed', item: '会员年费', amount: 120, periodKey: '2026', paid: true,
      account: undefined, ts: new Date(2026, 9, 20, 14, 25, 36).getTime(),
    }])
  })

  it('saves both transfer accounts, date, amount and note without changing identity', async () => {
    useApp.getState().addTransfer('储蓄卡', '备用金', 20, '', '2026-10-22')
    const original = useApp.getState().records[0]
    const patch = { from: ' 电子钱包 ', to: ' 储蓄卡 ', account: '', amount: 42, note: '备用金', date: '2026-10-21' }

    useApp.getState().editRecord(original.id, patch)

    await expectSavedRecords([{
      id: original.id, kind: 'transfer', from: '电子钱包', to: '储蓄卡',
      amount: 42, note: '备用金', ts: new Date(2026, 9, 21, 14, 25, 36).getTime(),
    }])
  })
})
