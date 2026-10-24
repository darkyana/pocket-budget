import { create } from 'zustand'
import { SCHEMA_VERSION, type ExpenseCycle, type MoneyRecord, type PersistedState, type Settings } from '../core/types'
import { effectiveRecords, fixedExpensePaid, expensePeriodKey, renameRecordAnchor, syncedDayType, withAccount } from '../core/derive'
import { timestampOf, validateRecordDate } from '../core/time'
import { freshState } from '../storage/migrate'
import { loadState, requestPersistence, saveState } from '../storage/db'
import { parseVoucher } from '../storage/voucher'

export type Tab = 'today' | 'records' | 'settings'

export type Overlay = 'quickRetro'

let seq = 0
const uid = () => `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function persist(s: { settings: Settings; records: MoneyRecord[] }) {
  const state: PersistedState = { schemaVersion: SCHEMA_VERSION, settings: s.settings, records: s.records }
  saveState(state).catch((err) => console.error('落盘失败', err))
}

function withUsedAccount(settings: Settings, account: string): Settings {
  const next = withAccount(settings, account)
  return account && next.lastAccount !== account ? { ...next, lastAccount: account } : next
}

function withTransferTo(settings: Settings, to: string): Settings {
  return to && settings.lastTransferTo !== to ? { ...settings, lastTransferTo: to } : settings
}

function validateNames(previous: { name: string }[], next: { name: string }[], scope: string) {
  const remaining = new Map<string, number>()
  const counts = new Map<string, number>()
  for (const item of previous) {
    remaining.set(item.name, (remaining.get(item.name) ?? 0) + 1)
    const name = item.name.trim()
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const nextCounts = new Map<string, number>()
  for (const item of next) {
    const unchanged = remaining.get(item.name) ?? 0
    if (unchanged > 0) remaining.set(item.name, unchanged - 1)
    else {
      item.name = item.name.trim()
      if (!item.name) throw new Error('名称不能为空')
    }
    const name = item.name.trim()
    const count = (nextCounts.get(name) ?? 0) + 1
    nextCounts.set(name, count)
    if (count > Math.max(1, counts.get(name) ?? 0)) {
      throw new Error(`「${name}」在${scope}中已存在，请使用其他名称`)
    }
  }
}

function validateSettings(previous: Settings, next: Settings) {
  for (const [dayType, buckets] of Object.entries(next.dayPlans)) {
    if (!Object.hasOwn(previous.dayPlans, dayType) && !['工作日', '周末日'].includes(dayType)) {
      throw new Error('新日型仅支持工作日和周末日')
    }
    validateNames(previous.dayPlans[dayType] ?? [], buckets, dayType)
  }
  validateNames(previous.budgets, next.budgets, '预算')
}

interface AppState {
  ready: boolean
  settings: Settings
  records: MoneyRecord[]
  tab: Tab
  overlay: Overlay | null
  pendingCatTokens: string[]
  init(): Promise<void>
  addRhythm(category: string, amount: number, note: string, account: string, date: string): void
  addBudgetEntry(budget: string, dir: 'out' | 'in', amount: number, note: string, account: string, date: string): void
  toggleFixedExpense(name: string): void
  addTransfer(from: string, to: string, amount: number, note: string, date: string): void
  editRecord(id: string, patch: { amount: number; note: string; account: string; date: string; from?: string; to?: string }): void
  saveEntryRecord(
    id: string,
    next: {
      kind: 'routine' | 'budget'
      category?: string
      budget?: string
      dir: 'out' | 'in'
      amount: number
      note: string
      account: string
      date: string
    },
  ): void
  editFixedExpense(id: string, patch: { account: string; date: string }): void
  deleteRecord(id: string): void
  renameAnchor(kind: 'routine' | 'budget' | 'fixed', from: string, to: string): void
  goTab(tab: Tab): void
  openQuickRetro(): void
  closeOverlay(): void
  jumpToRecords(tokens: string[]): void
  clearPendingCats(): void
  updateSettings(mutate: (draft: Settings) => void): void
  saveRoutine(dayType: string, index: number, next: Settings['dayPlans'][string][number]): void
  saveBudget(index: number, next: Settings['budgets'][number]): void
  clearRecords(): void
  factoryReset(): void
  importVoucher(text: string): void
}

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  settings: freshState().settings,
  records: [],
  tab: 'today',
  overlay: null,
  pendingCatTokens: [],

  async init() {
    const state = await loadState()
    await requestPersistence()
    set({ ready: true, settings: syncedDayType(state.settings, new Date()), records: state.records })
  },

  addRhythm(category, amount, note, account, date) {
    validateRecordDate(date)
    const acct = account.trim()
    const e: MoneyRecord = {
      id: uid(),
      ts: timestampOf(date),
      kind: 'routine',
      category,
      amount,
      note,
      ...(acct ? { account: acct } : {}),
    }
    set((s) => ({ records: [...s.records, e], settings: withUsedAccount(s.settings, acct) }))
    persist(get())
  },

  addBudgetEntry(budget, dir, amount, note, account, date) {
    validateRecordDate(date)
    const acct = account.trim()
    const e: MoneyRecord = {
      id: uid(),
      ts: timestampOf(date),
      kind: 'budget',
      budget,
      dir,
      amount,
      note,
      ...(acct ? { account: acct } : {}),
    }
    set((s) => ({ records: [...s.records, e], settings: withUsedAccount(s.settings, acct) }))
    persist(get())
  },

  toggleFixedExpense(name) {
    const c = get().settings.fixedExpenses.find((x) => x.name === name)
    if (!c) return
    const cycle: ExpenseCycle = c.cycle ?? 'monthly'
    const now = new Date()
    const paid = !fixedExpensePaid(get().records, name, cycle, now)
    const e: MoneyRecord = {
      id: uid(),
      ts: Date.now(),
      kind: 'fixed',
      item: name,
      amount: c.amount,
      periodKey: expensePeriodKey(now, cycle),
      paid,
    }
    set((s) => {
      const records = s.records.filter((r) => r.kind !== 'fixed' || r.item !== name || r.periodKey !== e.periodKey)
      return { records: paid ? [...records, e] : records }
    })
    persist(get())
  },

  addTransfer(from, to, amount, note, date) {
    validateRecordDate(date)
    const e: MoneyRecord = { id: uid(), ts: timestampOf(date), kind: 'transfer', from, to, amount, note }
    set((s) => ({
      records: [...s.records, e],
      settings: withTransferTo(withUsedAccount(withAccount(s.settings, to), from), to),
    }))
    persist(get())
  },

  editRecord(id, patch) {
    validateRecordDate(patch.date)
    set((s) => ({
      records: s.records.map((e): MoneyRecord => {
        if (e.id !== id || e.kind === 'fixed') return e
        const acct = patch.account.trim()
        return {
          ...e,
          amount: patch.amount,
          note: patch.note,
          ts: timestampOf(patch.date, new Date(e.ts)),
          ...(e.kind === 'transfer'
            ? { from: patch.from?.trim() ?? e.from, to: patch.to?.trim() ?? e.to }
            : { account: acct || undefined }),
        }
      }),
    }))
    persist(get())
  },

  saveEntryRecord(id, next) {
    validateRecordDate(next.date)
    set((s) => ({
      records: s.records.map((e): MoneyRecord => {
        if (e.id !== id || (e.kind !== 'routine' && e.kind !== 'budget')) return e
        const ts = timestampOf(next.date, new Date(e.ts))
        const acct = next.account.trim()
        return next.kind === 'routine'
          ? { id: e.id, ts, kind: 'routine', category: next.category ?? '', amount: next.amount, note: next.note, ...(acct ? { account: acct } : {}) }
          : { id: e.id, ts, kind: 'budget', budget: next.budget ?? '', dir: next.dir, amount: next.amount, note: next.note, ...(acct ? { account: acct } : {}) }
      }),
    }))
    persist(get())
  },

  editFixedExpense(id, patch) {
    validateRecordDate(patch.date)
    const s = get()
    const payment = effectiveRecords(s.records).find((e) => e.id === id)
    if (!payment || payment.kind !== 'fixed') return
    const ts = timestampOf(patch.date, new Date(payment.ts))
    const cycle = s.settings.fixedExpenses.find((c) => c.name === payment.item)?.cycle ?? 'monthly'
    const periodKey = expensePeriodKey(new Date(ts), cycle)
    if (effectiveRecords(s.records).some((e) => e.kind === 'fixed' && e.id !== id && e.item === payment.item && e.periodKey === periodKey)) {
      throw new Error('该期间已有付款，请选择其他付款日期')
    }
    const records = s.records.filter((e) => e.kind !== 'fixed' || e.item !== payment.item || (e.periodKey !== payment.periodKey && e.periodKey !== periodKey))
    records.push({ ...payment, ts, periodKey, account: patch.account.trim() || undefined })
    set({ records })
    persist(get())
  },

  deleteRecord(id) {
    set((s) => {
      const payment = effectiveRecords(s.records).find((e) => e.id === id && e.kind === 'fixed')
      return { records: s.records.filter((e) => payment?.kind === 'fixed'
        ? e.kind !== 'fixed' || e.item !== payment.item || e.periodKey !== payment.periodKey
        : e.id !== id) }
    })
    persist(get())
  },

  renameAnchor(kind, from, to) {
    set((s) => {
      const amount = kind === 'fixed' ? s.settings.fixedExpenses.find((e) => e.name === to)?.amount : undefined
      const records = renameRecordAnchor(s.records, kind, from, to).map((e) =>
        amount !== undefined && e.kind === 'fixed' && e.item === to && e.paid ? { ...e, amount } : e)
      return { records }
    })
    persist(get())
  },

  goTab(tab) {
    set({ tab, overlay: null })
  },

  openQuickRetro() {
    set({ overlay: 'quickRetro' })
  },

  closeOverlay() {
    set({ overlay: null })
  },

  jumpToRecords(tokens) {
    set({ tab: 'records', pendingCatTokens: tokens })
  },

  clearPendingCats() {
    set({ pendingCatTokens: [] })
  },

  saveRoutine(dayType, index, next) {
    const s = get()
    const previous = s.settings.dayPlans[dayType]?.[index]
    if (!previous) throw new Error('日常不存在')
    const settings = structuredClone(s.settings)
    const name = next.name.trim()
    settings.dayPlans[dayType][index] = { ...next, name }
    validateSettings(s.settings, settings)
    set({ settings, records: renameRecordAnchor(s.records, 'routine', previous.name, name) })
    persist(get())
  },

  saveBudget(index, next) {
    const s = get()
    const previous = s.settings.budgets[index]
    if (!previous) throw new Error('预算不存在')
    const settings = structuredClone(s.settings)
    const name = next.name.trim()
    settings.budgets[index] = { ...next, name }
    validateSettings(s.settings, settings)
    set({ settings, records: renameRecordAnchor(s.records, 'budget', previous.name, name) })
    persist(get())
  },

  updateSettings(mutate) {
    set((s) => {
      const draft = structuredClone(s.settings)
      mutate(draft)
      validateSettings(s.settings, draft)
      const changedAmounts = new Map(draft.fixedExpenses
        .filter((item) => s.settings.fixedExpenses.some((old) => old.name === item.name && old.amount !== item.amount))
        .map((item) => [item.name, item.amount]))
      const records = s.records.map((e) => e.kind === 'fixed' && e.paid && changedAmounts.has(e.item)
        ? { ...e, amount: changedAmounts.get(e.item)! }
        : e)
      return { settings: draft, records }
    })
    persist(get())
  },

  clearRecords() {
    set({ records: [] })
    persist(get())
  },

  factoryReset() {
    const fresh = freshState()
    set({ settings: fresh.settings, records: [] })
    persist(get())
  },

  importVoucher(text) {
    const state = parseVoucher(text)
    set({ settings: state.settings, records: state.records })
    persist(get())
  },
}))
