import { create } from 'zustand'
import { SCHEMA_VERSION, type ExpenseCycle, type MoneyRecord, type PersistedState, type Settings } from '../core/types'
import { fixedExpensePaid, expensePeriodKey, renameRecordAnchor, syncedDayType, withAccount } from '../core/derive'
import { timestampOf, validateRecordDate } from '../core/time'
import { freshState } from '../storage/migrate'
import { loadState, requestPersistence, saveState } from '../storage/db'
import { parseVoucher } from '../storage/voucher'

/** 底部页签 */
export type Tab = 'today' | 'records' | 'settings'

/** 覆盖页：tab 之上的解释页（目前仅快速回顾）；null = 无，切 tab 自动关闭 */
export type Overlay = 'quickRetro'

/**
 * 应用状态：settings（可变快照） + records（事实源）。
 * 流水由用户显式追加；编辑/删除同样是用户的显式修正——个人账本无下游对账，不做反向流水抵消。
 * 每次变更后整体落盘 IndexedDB；视图数字不在状态里，用 core/derive 实时推导。
 */

let seq = 0
/** 不依赖 crypto.randomUUID：局域网 http 的 dev 环境不是安全上下文 */
const uid = () => `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function persist(s: { settings: Settings; records: MoneyRecord[] }) {
  const state: PersistedState = { schemaVersion: SCHEMA_VERSION, settings: s.settings, records: s.records }
  saveState(state).catch((err) => console.error('落盘失败', err))
}

/** 记账时记住账户：新名字进账户列表，并作为下次弹层的默认账户 */
function withUsedAccount(settings: Settings, account: string): Settings {
  const next = withAccount(settings, account)
  return account && next.lastAccount !== account ? { ...next, lastAccount: account } : next
}

/** 走账时记住转入账户：下次走账弹层的「转到哪个账户」默认值 */
function withTransferTo(settings: Settings, to: string): Settings {
  return to && settings.lastTransferTo !== to ? { ...settings, lastTransferTo: to } : settings
}

interface AppState {
  ready: boolean
  settings: Settings
  records: MoneyRecord[]
  /** 当前页签（跨页跳转需要，如今日页长按预算跳流水） */
  tab: Tab
  /** 覆盖页（快速回顾等解释页）；入口在今日页，切 tab 自动关闭 */
  overlay: Overlay | null
  /** 跨页跳转预置的分类筛选 tokens（'budget:购物' 等）；Records 挂载时消费并清空 */
  pendingCatTokens: string[]
  init(): Promise<void>
  addRhythm(category: string, amount: number, note: string, account: string, date: string): void
  addBudgetEntry(budget: string, dir: 'out' | 'in', amount: number, note: string, account: string, date: string): void
  toggleFixedExpense(name: string): void
  addTransfer(from: string, to: string, amount: number, note: string, date: string): void
  /** 编辑一笔：金额/备注/账户/日期覆盖原流水；日期变化时保留原时分秒。固定支出流水用 editFixedExpense */
  editRecord(id: string, patch: { amount: number; note: string; account: string; date: string }): void
  /** 保存日常/预算流水的编辑（含日常↔预算互转与同锚改目标）：整条替换，保留 id */
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
  /** 编辑固定支出流水：只开放付款日期与账户（金额随设置走）。日期变化时按该固定支出当前周期重算 periodKey */
  editFixedExpense(id: string, patch: { account: string; date: string }): void
  deleteRecord(id: string): void
  /** 显式修正：锚改名联动，把同名流水的锚字段一并改写（日常/预算/固定支出共用） */
  renameAnchor(kind: 'routine' | 'budget' | 'fixed', from: string, to: string): void
  goTab(tab: Tab): void
  /** 从今日页消费力标签进入快速回顾 */
  openQuickRetro(): void
  /** 关闭覆盖页，回到原页签 */
  closeOverlay(): void
  /** 跨页跳转：去流水页并预置分类筛选（Records 挂载时消费） */
  jumpToRecords(tokens: string[]): void
  clearPendingCats(): void
  /** 设置就地修改：给一个可变的深拷贝，改完统一落盘 */
  updateSettings(mutate: (draft: Settings) => void): void
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
    // 启动对齐日型：清掉过期的手动指定，跨天/跨假期后「今天」自动回到日历推断
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
    set((s) => ({ records: [...s.records, e] }))
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
          ts: timestampOf(patch.date, new Date(e.ts)), // 日期变化时保留原时分秒
          ...(e.kind === 'transfer' ? {} : { account: acct || undefined }),
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
        const ts = timestampOf(next.date, new Date(e.ts)) // 日期变化时保留原时分秒
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
    set((s) => ({
      records: s.records.map((e): MoneyRecord => {
        if (e.id !== id || e.kind !== 'fixed') return e
        const ts = timestampOf(patch.date, new Date(e.ts)) // 日期变化时保留原时分秒
        // 周期键跟新日期走：补记到上月的付款归上月，本月回到未付
        const cycle = s.settings.fixedExpenses.find((c) => c.name === e.item)?.cycle ?? 'monthly'
        const acct = patch.account.trim()
        return {
          ...e,
          ts,
          periodKey: expensePeriodKey(new Date(ts), cycle),
          account: acct || undefined,
        }
      }),
    }))
    persist(get())
  },

  deleteRecord(id) {
    set((s) => ({ records: s.records.filter((e) => e.id !== id) }))
    persist(get())
  },

  renameAnchor(kind, from, to) {
    set((s) => ({ records: renameRecordAnchor(s.records, kind, from, to) }))
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

  /** 跨页跳转：去流水页并预置分类筛选（Records 挂载时消费） */
  jumpToRecords(tokens) {
    set({ tab: 'records', pendingCatTokens: tokens })
  },

  clearPendingCats() {
    set({ pendingCatTokens: [] })
  },

  updateSettings(mutate) {
    set((s) => {
      const draft = structuredClone(s.settings)
      mutate(draft)
      return { settings: draft }
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
