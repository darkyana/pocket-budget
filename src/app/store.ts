import { create } from 'zustand'
import { SCHEMA_VERSION, type MoneyEvent, type PersistedState, type Settings } from '../core/types'
import { commitmentPaid, withAccount } from '../core/derive'
import { monthKeyOf } from '../core/time'
import { freshState } from '../storage/migrate'
import { loadState, requestPersistence, saveState } from '../storage/db'
import { parseVoucher } from '../storage/voucher'

/**
 * 应用状态：settings（可变快照） + events（append-only 事实源）。
 * 每次变更后整体落盘 IndexedDB；视图数字不在状态里，用 core/derive 实时推导。
 */

let seq = 0
/** 不依赖 crypto.randomUUID：局域网 http 的 dev 环境不是安全上下文 */
const uid = () => `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function persist(s: { settings: Settings; events: MoneyEvent[] }) {
  const state: PersistedState = { schemaVersion: SCHEMA_VERSION, settings: s.settings, events: s.events }
  saveState(state).catch((err) => console.error('落盘失败', err))
}

interface AppState {
  ready: boolean
  settings: Settings
  events: MoneyEvent[]
  init(): Promise<void>
  addRhythm(category: string, amount: number, note: string): void
  addPoolEntry(pool: string, dir: 'out' | 'in', amount: number, note: string): void
  toggleCommitment(name: string): void
  addTransfer(from: string, to: string, amount: number, note: string): void
  /** 设置就地修改：给一个可变的深拷贝，改完统一落盘 */
  updateSettings(mutate: (draft: Settings) => void): void
  clearEvents(): void
  factoryReset(): void
  importVoucher(text: string): void
}

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  settings: freshState().settings,
  events: [],

  async init() {
    const state = await loadState()
    await requestPersistence()
    set({ ready: true, settings: state.settings, events: state.events })
  },

  addRhythm(category, amount, note) {
    const e: MoneyEvent = { id: uid(), ts: Date.now(), kind: 'rhythm', category, amount, note }
    set((s) => ({ events: [...s.events, e] }))
    persist(get())
  },

  addPoolEntry(pool, dir, amount, note) {
    const e: MoneyEvent = { id: uid(), ts: Date.now(), kind: 'pool', pool, dir, amount, note }
    set((s) => ({ events: [...s.events, e] }))
    persist(get())
  },

  toggleCommitment(name) {
    const c = get().settings.commitments.find((x) => x.name === name)
    if (!c) return
    const paid = !commitmentPaid(get().events, name, new Date())
    const e: MoneyEvent = {
      id: uid(),
      ts: Date.now(),
      kind: 'commitment',
      item: name,
      amount: c.amount,
      monthKey: monthKeyOf(new Date()),
      paid,
    }
    set((s) => ({ events: [...s.events, e] }))
    persist(get())
  },

  addTransfer(from, to, amount, note) {
    const e: MoneyEvent = { id: uid(), ts: Date.now(), kind: 'transfer', from, to, amount, note }
    set((s) => {
      const settings = withAccount(withAccount(s.settings, from), to)
      return { events: [...s.events, e], settings }
    })
    persist(get())
  },

  updateSettings(mutate) {
    set((s) => {
      const draft = structuredClone(s.settings)
      mutate(draft)
      return { settings: draft }
    })
    persist(get())
  },

  clearEvents() {
    set({ events: [] })
    persist(get())
  },

  factoryReset() {
    const fresh = freshState()
    set({ settings: fresh.settings, events: [] })
    persist(get())
  },

  importVoucher(text) {
    const state = parseVoucher(text)
    set({ settings: state.settings, events: state.events })
    persist(get())
  },
}))
