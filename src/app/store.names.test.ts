import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersistedState } from '../core/types'
import { freshState } from '../storage/migrate'

const storage = vi.hoisted(() => ({ saved: undefined as PersistedState | undefined }))
vi.mock('../storage/db', () => ({
  saveState: async (state: PersistedState) => { storage.saved = structuredClone(state) },
  loadState: async () => structuredClone(storage.saved),
  requestPersistence: async () => {},
}))

import { useApp } from './store'

beforeEach(() => {
  const state = freshState()
  state.settings.dayPlans = { 工作日: [{ name: '宠物粮', expect: 20 }], 周末日: [] }
  state.settings.budgets = [{ name: '物业费', month: 100 }]
  useApp.setState({ settings: state.settings, records: [] })
  storage.saved = structuredClone(state)
})

describe('configuration names', () => {
  it('trims accepted names while allowing cross-day-type, cross-kind and case-distinct names', async () => {
    useApp.getState().updateSettings((s) => {
      s.dayPlans.周末日.push({ name: ' 宠物粮 ', expect: 30 })
      s.budgets.push({ name: ' 宠物粮 ', month: 200 })
      s.budgets.push({ name: ' Sample ', month: 300 }, { name: 'sample', month: 400 })
    })
    useApp.getState().saveRoutine('工作日', 0, { name: ' 家政服务 ', expect: 50 })
    useApp.getState().saveBudget(0, { name: ' 会员年费 ', month: 500 })
    await useApp.getState().init()
    expect(useApp.getState().settings.dayPlans).toEqual({
      工作日: [{ name: '家政服务', expect: 50 }], 周末日: [{ name: '宠物粮', expect: 30 }],
    })
    expect(useApp.getState().settings.budgets.map((b) => b.name)).toEqual(['会员年费', '宠物粮', 'Sample', 'sample'])
  })

  it('preserves legacy duplicates on load and unrelated edits but rejects new collisions', async () => {
    const state = freshState()
    state.settings.dayPlans = { 工作日: [{ name: ' 宠物粮 ', expect: 20 }, { name: '宠物粮', expect: 30 }] }
    state.settings.budgets = [{ name: '物业费', month: 100 }, { name: '物业费', month: 200 }]
    storage.saved = structuredClone(state)
    await useApp.getState().init()
    expect(useApp.getState().settings.dayPlans).toEqual(state.settings.dayPlans)
    useApp.getState().updateSettings((s) => { s.routineSpendRatio = 0.5 })
    useApp.getState().saveBudget(1, { name: '物业费', month: 300 })
    expect(useApp.getState().settings.dayPlans).toEqual(state.settings.dayPlans)
    expect(useApp.getState().settings.budgets).toEqual([{ name: '物业费', month: 100 }, { name: '物业费', month: 300 }])
    expect(() => useApp.getState().updateSettings((s) => {
      s.budgets.push({ name: ' 物业费 ', month: 400 })
    })).toThrow('已存在')
    useApp.getState().saveBudget(1, { name: '会员年费', month: 300 })
    expect(useApp.getState().settings.budgets.map((b) => b.name)).toEqual(['物业费', '会员年费'])
  })

  it('keeps custom day types usable without allowing new custom day types', async () => {
    const state = freshState()
    state.settings.dayPlans['示例日'] = [{ name: '宠物粮', expect: 20 }]
    storage.saved = structuredClone(state)
    await useApp.getState().init()
    useApp.getState().updateSettings((s) => { s.dayType = '示例日' })
    useApp.getState().saveRoutine('示例日', 0, { name: '家政服务', expect: 30 })
    expect(useApp.getState().settings.dayPlans['示例日']).toEqual([{ name: '家政服务', expect: 30 }])
    expect(useApp.getState().settings.dayType).toBe('示例日')
    const before = structuredClone(storage.saved)
    expect(() => useApp.getState().updateSettings((s) => { s.dayPlans['另一个示例日'] = [] })).toThrow('仅支持')
    expect(storage.saved).toEqual(before)
    expect(useApp.getState().settings).toEqual(before?.settings)
  })

  it('renames same-name historical routines without adding day-type attribution', async () => {
    useApp.getState().updateSettings((s) => { s.dayPlans.周末日.push({ name: '宠物粮', expect: 30 }) })
    useApp.getState().addRhythm('宠物粮', 10, '', '', '2026-01-01')
    useApp.getState().addRhythm('宠物粮', 20, '', '', '2026-01-03')
    const records = useApp.getState().records
    useApp.getState().saveRoutine('工作日', 0, { name: '家政服务', expect: 40 })
    await useApp.getState().init()
    expect(useApp.getState().records).toEqual(records.map((record) => ({ ...record, category: '家政服务' })))
    expect(useApp.getState().settings.dayPlans.周末日).toEqual([{ name: '宠物粮', expect: 30 }])
  })

  it('rejects conflicting edits repeatedly without merging configurations or histories', () => {
    useApp.getState().updateSettings((s) => {
      s.dayPlans.工作日.push({ name: '家政服务', expect: 40 })
      s.budgets.push({ name: '会员年费', month: 200 })
    })
    useApp.getState().addRhythm('家政服务', 10, '', '', '2026-01-01')
    useApp.getState().addBudgetEntry('会员年费', 'out', 10, '', '', '2026-01-01')
    const before = structuredClone(storage.saved)
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(() => useApp.getState().saveRoutine('工作日', 1, { name: ' 宠物粮 ', expect: 50 })).toThrow('已存在')
      expect(() => useApp.getState().saveBudget(1, { name: ' 物业费 ', month: 300 })).toThrow('已存在')
    }
    expect(useApp.getState().settings).toEqual(before?.settings)
    expect(useApp.getState().records).toEqual(before?.records)
    expect(storage.saved).toEqual(before)
  })

  it('rejects trimmed creation collisions within each naming scope without saving changes', () => {
    const before = structuredClone(storage.saved)
    expect(() => useApp.getState().updateSettings((s) => {
      s.dayPlans.工作日.push({ name: ' 宠物粮 ', expect: 30 })
    })).toThrow('已存在')
    expect(() => useApp.getState().updateSettings((s) => {
      s.budgets.push({ name: ' 物业费 ', month: 200 })
    })).toThrow('已存在')
    expect(useApp.getState().settings).toEqual(before?.settings)
    expect(storage.saved).toEqual(before)
  })
})
