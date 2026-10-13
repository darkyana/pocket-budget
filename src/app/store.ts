import { create } from 'zustand'
import { SCHEMA_VERSION, type CommitmentCycle, type MoneyEvent, type PersistedState, type Settings } from '../core/types'
import { commitmentPaid, commitmentPeriodKey, withAccount } from '../core/derive'
import { timestampOf } from '../core/time'
import { freshState } from '../storage/migrate'
import { loadState, requestPersistence, saveState } from '../storage/db'
import { parseVoucher } from '../storage/voucher'

/**
 * 应用状态：settings（可变快照） + events（事实源）。
 * 事件由用户显式追加；编辑/删除同样是用户的显式修正——个人账本无下游对账，不做更正事件抵消。
 * 每次变更后整体落盘 IndexedDB；视图数字不在状态里，用 core/derive 实时推导。
 */

let seq = 0
/** 不依赖 crypto.randomUUID：局域网 http 的 dev 环境不是安全上下文 */
const uid = () => `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function persist(s: { settings: Settings; events: MoneyEvent[] }) {
  const state: PersistedState = { schemaVersion: SCHEMA_VERSION, settings: s.settings, events: s.events }
  saveState(state).catch((err) => console.error('落盘失败', err))
}

/** 记账时记住账户：新名字进账户列表，并作为下次弹层的默认账户 */
function withUsedAccount(settings: Settings, account: string): Settings {
  const next = withAccount(settings, account)
  return account && next.lastAccount !== account ? { ...next, lastAccount: account } : next
}

interface AppState {
  ready: boolean
  settings: Settings
  events: MoneyEvent[]
  init(): Promise<void>
  addRhythm(category: string, amount: number, note: string, account: string, date: string): void
  addPoolEntry(pool: string, dir: 'out' | 'in', amount: number, note: string, account: string, date: string): void
  toggleCommitment(name: string): void
  addTransfer(from: string, to: string, amount: number, note: string, date: string): void
  /** 编辑一笔：金额/备注/账户/日期覆盖原事件；日期变化时保留原时分秒。义务事件用 editCommitment */
  editEvent(id: string, patch: { amount: number; note: string; account: string; date: string }): void
  /** 保存节律/池子事件的编辑（含节律↔池子互转与同锚改目标）：整条替换，保留 id */
  saveEntryEvent(
    id: string,
    next: {
      kind: 'rhythm' | 'pool'
      category?: string
      pool?: string
      dir: 'out' | 'in'
      amount: number
      note: string
      account: string
      date: string
    },
  ): void
  /** 编辑义务事件：只开放付款日期与账户（金额随设置走）。日期变化时按该义务当前周期重算 periodKey */
  editCommitment(id: string, patch: { account: string; date: string }): void
  deleteEvent(id: string): void
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

  addRhythm(category, amount, note, account, date) {
    const acct = account.trim()
    const e: MoneyEvent = {
      id: uid(),
      ts: timestampOf(date),
      kind: 'rhythm',
      category,
      amount,
      note,
      ...(acct ? { account: acct } : {}),
    }
    set((s) => ({ events: [...s.events, e], settings: withUsedAccount(s.settings, acct) }))
    persist(get())
  },

  addPoolEntry(pool, dir, amount, note, account, date) {
    const acct = account.trim()
    const e: MoneyEvent = {
      id: uid(),
      ts: timestampOf(date),
      kind: 'pool',
      pool,
      dir,
      amount,
      note,
      ...(acct ? { account: acct } : {}),
    }
    set((s) => ({ events: [...s.events, e], settings: withUsedAccount(s.settings, acct) }))
    persist(get())
  },

  toggleCommitment(name) {
    const c = get().settings.commitments.find((x) => x.name === name)
    if (!c) return
    const cycle: CommitmentCycle = c.cycle ?? 'monthly'
    const now = new Date()
    const paid = !commitmentPaid(get().events, name, cycle, now)
    const e: MoneyEvent = {
      id: uid(),
      ts: Date.now(),
      kind: 'commitment',
      item: name,
      amount: c.amount,
      periodKey: commitmentPeriodKey(now, cycle),
      paid,
    }
    set((s) => ({ events: [...s.events, e] }))
    persist(get())
  },

  addTransfer(from, to, amount, note, date) {
    const e: MoneyEvent = { id: uid(), ts: timestampOf(date), kind: 'transfer', from, to, amount, note }
    set((s) => ({
      events: [...s.events, e],
      settings: withUsedAccount(withAccount(s.settings, to), from),
    }))
    persist(get())
  },

  editEvent(id, patch) {
    set((s) => ({
      events: s.events.map((e): MoneyEvent => {
        if (e.id !== id || e.kind === 'commitment') return e
        const acct = patch.account.trim()
        return {
          ...e,
          amount: patch.amount,
          note: patch.note,
          ts: timestampOf(patch.date, new Date(e.ts)), // 日期变化时保留原时分秒
          ...(e.kind === 'transfer' ? {} : { account: acct || undefined }),
        }
      }),
    }))
    persist(get())
  },

  saveEntryEvent(id, next) {
    set((s) => ({
      events: s.events.map((e): MoneyEvent => {
        if (e.id !== id || (e.kind !== 'rhythm' && e.kind !== 'pool')) return e
        const ts = timestampOf(next.date, new Date(e.ts)) // 日期变化时保留原时分秒
        const acct = next.account.trim()
        return next.kind === 'rhythm'
          ? { id: e.id, ts, kind: 'rhythm', category: next.category ?? '', amount: next.amount, note: next.note, ...(acct ? { account: acct } : {}) }
          : { id: e.id, ts, kind: 'pool', pool: next.pool ?? '', dir: next.dir, amount: next.amount, note: next.note, ...(acct ? { account: acct } : {}) }
      }),
    }))
    persist(get())
  },

  editCommitment(id, patch) {
    set((s) => ({
      events: s.events.map((e): MoneyEvent => {
        if (e.id !== id || e.kind !== 'commitment') return e
        const ts = timestampOf(patch.date, new Date(e.ts)) // 日期变化时保留原时分秒
        // 周期键跟新日期走：补记到上月的付款归上月，本月回到未付
        const cycle = s.settings.commitments.find((c) => c.name === e.item)?.cycle ?? 'monthly'
        const acct = patch.account.trim()
        return {
          ...e,
          ts,
          periodKey: commitmentPeriodKey(new Date(ts), cycle),
          account: acct || undefined,
        }
      }),
    }))
    persist(get())
  },

  deleteEvent(id) {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
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
