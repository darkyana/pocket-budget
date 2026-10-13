/**
 * 数据结构版本：流水/设置结构有破坏性变更时 +1，并在 storage/migrate.ts 补迁移。
 * v1 起步。
 * v2：固定支出支持年付——字段 monthKey → periodKey（月付存 'YYYY-MM'，年付存 'YYYY'）。
 * v3：统一术语——流水 kind 值 rhythm/pool/commitment → routine/budget/fixed（pool 字段改名 budget）；
 *    设置 pools → budgets（周预算改为月÷4 派生，丢弃 weekAllow）、commitments → fixedExpenses；顶层 events → records。
 */
export const SCHEMA_VERSION = 3

export type DayTypeName = string

/** 日常：按日型各存一套，单日期望金额。今日已花不入库，由流水推导 */
export interface RoutineBucket {
  name: string
  expect: number
}

/** 预算：月度额度。周预算 = 月÷4，派生值不落库 */
export interface Budget {
  name: string
  month: number
}

/** 固定支出周期：每月 / 每年 */
export type ExpenseCycle = 'monthly' | 'yearly'

/** 固定支出：固定项。付/未付不在这里存，由本周期流水推导（周期更替自动回到未付） */
export interface FixedExpense {
  name: string
  amount: number
  /** 周期。旧数据无此字段 = 每月 */
  cycle?: ExpenseCycle
}

export interface Settings {
  dayType: DayTypeName
  dayPlans: Record<DayTypeName, RoutineBucket[]>
  budgets: Budget[]
  fixedExpenses: FixedExpense[]
  /** 走账账户名：自由输入、自动记忆 */
  accounts: string[]
  /** 最近一次记账用的账户：作为下次弹层的默认值（便利性字段，可空） */
  lastAccount?: string
  /** 最近一次走账转入的账户：走账弹层「转到哪个账户」的默认值 */
  lastTransferTo?: string
}

/**
 * 流水：唯一事实源，可由用户编辑/删除（显式修正）。
 * 所有视图数字（今日已花、周剩余、月底推算、固定支出状态）都从流水实时推导，永远不落库。
 * account 是事实属性（钱从哪个账户出的），不参与任何额度计算——不做账户余额台账。
 */
export type MoneyRecord =
  | { id: string; ts: number; kind: 'routine'; category: string; amount: number; note: string; account?: string }
  | { id: string; ts: number; kind: 'budget'; budget: string; dir: 'out' | 'in'; amount: number; note: string; account?: string }
  | { id: string; ts: number; kind: 'fixed'; item: string; amount: number; periodKey: string; paid: boolean; account?: string }
  | { id: string; ts: number; kind: 'transfer'; from: string; to: string; amount: number; note: string }

export interface PersistedState {
  schemaVersion: number
  settings: Settings
  records: MoneyRecord[]
}
