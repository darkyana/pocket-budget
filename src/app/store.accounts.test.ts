import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApp } from './store'
import { freshState } from '../storage/migrate'
import { loadState } from '../storage/db'

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

describe('removeAccount 账户删除', () => {
  it('删除未被使用的账户，并清理指向它的记忆', async () => {
    useApp.setState((s) => ({
      settings: { ...s.settings, accounts: [...s.settings.accounts, '公积金卡'], lastAccount: '公积金卡', lastTransferTo: '公积金卡' },
    }))

    useApp.getState().removeAccount('公积金卡')

    const { settings } = useApp.getState()
    expect(settings.accounts).not.toContain('公积金卡')
    expect(settings.lastAccount).toBeUndefined()
    expect(settings.lastTransferTo).toBeUndefined()
    expect((await loadState()).settings.accounts).not.toContain('公积金卡')
  })

  it('还有流水引用的账户拒绝删除，报出笔数', () => {
    useApp.getState().addRhythm('三餐', 30, '', '公交卡', '2026-10-22')
    useApp.getState().addTransfer('公交卡', '现金', 100, '', '2026-10-22')
    useApp.setState((s) => ({ settings: { ...s.settings, accounts: [...s.settings.accounts, '公交卡'] } }))

    expect(() => useApp.getState().removeAccount('公交卡')).toThrow('「公交卡」还有 2 笔流水')
    expect(useApp.getState().settings.accounts).toContain('公交卡')
  })

  it('不存在的账户名不做任何事', () => {
    const before = useApp.getState().settings
    useApp.getState().removeAccount('不存在的账户')
    expect(useApp.getState().settings).toBe(before)
  })

  it('长按账户跳转流水并带上该账户筛选，清除后复位', () => {
    useApp.getState().jumpToRecords([], '公交卡')
    expect(useApp.getState().tab).toBe('records')
    expect(useApp.getState().pendingAccount).toBe('公交卡')

    useApp.getState().clearPendingCats()
    expect(useApp.getState().pendingAccount).toBe('')
  })
})
