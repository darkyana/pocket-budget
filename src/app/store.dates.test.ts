import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApp } from './store'
import { freshState } from '../storage/migrate'
import { dayKeyOf } from '../core/time'
import type { MoneyRecord } from '../core/types'
import { loadState, saveState } from '../storage/db'
import { buildVoucher } from '../storage/voucher'

vi.mock('../storage/db', () => ({
  saveState: vi.fn(async () => {}),
  loadState: vi.fn(async () => freshState()),
  requestPersistence: vi.fn(async () => {}),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 0, 15))
  useApp.setState({ ...freshState() })
})
afterEach(() => vi.useRealTimers())

const existing: MoneyRecord[] = [
  { id: 'routine', kind: 'routine', category: '宠物粮', amount: 20, note: '', ts: new Date(2026, 9, 21, 12).getTime() },
  { id: 'budget', kind: 'budget', budget: '宠物粮', dir: 'out', amount: 20, note: '', ts: new Date(2026, 9, 21, 12).getTime() },
  { id: 'transfer', kind: 'transfer', from: '储蓄卡', to: '备用金', amount: 20, note: '', ts: new Date(2026, 9, 21, 12).getTime() },
  { id: 'fixed', kind: 'fixed', item: '物业费', periodKey: '2026-10', paid: true, amount: 20, ts: new Date(2026, 9, 21, 12).getTime() },
]

describe('record editing dates', () => {
  it('preserves stored and imported future records across loading and other saves', async () => {
    const future = existing.map((r) => ({ ...r, ts: new Date(2026, 10, 1, 12).getTime() }))
    const state = { ...freshState(), records: future }
    vi.mocked(loadState).mockResolvedValueOnce(state)
    await useApp.getState().init()
    expect(useApp.getState().records).toEqual(future)
    useApp.getState().importVoucher(JSON.stringify(buildVoucher(state)))
    expect(useApp.getState().records).toEqual(future)
    useApp.getState().addRhythm('宠物粮', 10, '', '', '2026-10-23')
    expect(useApp.getState().records.slice(0, 4)).toEqual(future)
    expect(vi.mocked(saveState).mock.lastCall?.[0].records.slice(0, 4)).toEqual(future)
  })

  it.each(['', '2026-02-30'])('rejects an invalid date %s rather than silently substituting a day', (date) => {
    expect(() => useApp.getState().addRhythm('宠物粮', 20, '', '', date)).toThrow('请选择有效日期')
    expect(useApp.getState().records).toEqual([])
  })
  it.each(['routine', 'budget', 'transfer', 'fixed'] as const)('validates %s edits without altering rejected records', (kind) => {
    useApp.setState({ records: structuredClone(existing) })
    const edit = (date: string) => {
      const patch = { amount: 30, note: '', account: '储蓄卡', date }
      if (kind === 'fixed') useApp.getState().editFixedExpense(kind, patch)
      else if (kind === 'transfer') useApp.getState().editRecord(kind, patch)
      else useApp.getState().saveEntryRecord(kind, { ...patch, kind, category: '宠物粮', budget: '宠物粮', dir: 'out' })
    }
    for (const date of ['2026-10-22', '2026-10-23']) {
      edit(date)
      expect(dayKeyOf(useApp.getState().records.find((r) => r.id === kind)!.ts)).toBe(date)
    }
    const before = useApp.getState()
    expect(() => edit('2026-10-24')).toThrow('日期不能晚于今天')
    expect(useApp.getState()).toBe(before)
  })
})

describe('record creation dates', () => {
  it('uses the local calendar day at the end of the day', () => {
    vi.setSystemTime(new Date(2026, 9, 23, 23, 45))
    useApp.getState().addRhythm('宠物粮', 20, '', '', '2026-10-23')
    expect(dayKeyOf(useApp.getState().records[0].ts)).toBe('2026-10-23')
    expect(() => useApp.getState().addRhythm('宠物粮', 20, '', '', '2026-10-24')).toThrow('日期不能晚于今天')
  })
  it.each(['budget', 'transfer'] as const)('validates %s creation before changing records or settings', (kind) => {
    const create = (date: string) => kind === 'budget'
      ? useApp.getState().addBudgetEntry('宠物粮', 'in', 20, '', '储蓄卡', date)
      : useApp.getState().addTransfer('储蓄卡', '备用金', 20, '', date)
    create('2026-10-23')
    create('2026-10-22')
    expect(useApp.getState().records.map((r) => dayKeyOf(r.ts))).toEqual(['2026-10-23', '2026-10-22'])
    const before = useApp.getState()
    expect(() => create('2026-10-24')).toThrow('日期不能晚于今天')
    expect(useApp.getState()).toBe(before)
  })
  it('accepts local today and past days but rejects tomorrow without changing state', () => {
    const add = useApp.getState().addRhythm
    add('宠物粮', 20, '', '储蓄卡', '2026-10-23')
    add('宠物粮', 20, '', '储蓄卡', '2026-10-22')
    expect(useApp.getState().records.map((r) => dayKeyOf(r.ts))).toEqual(['2026-10-23', '2026-10-22'])
    const before = useApp.getState()
    expect(() => add('宠物粮', 20, '', '备用金', '2026-10-24')).toThrow('日期不能晚于今天')
    expect(useApp.getState()).toBe(before)
  })
})
