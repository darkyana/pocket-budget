/**
 * 数据结构版本：事件/设置结构有破坏性变更时 +1，并在 storage/migrate.ts 补迁移。
 * v1 起步。
 * v2：义务支持年付——事件 monthKey → periodKey（月付存 'YYYY-MM'，年付存 'YYYY'）。
 */
export const SCHEMA_VERSION = 2

export type DayTypeName = string

/** 节律类别（按日型各存一套）：单日期望金额。今日已花不入库，由事件推导 */
export interface RhythmBucket {
  name: string
  expect: number
}

/** 预算池：月预算摊到周 */
export interface Pool {
  name: string
  month: number
  weekAllow: number
}

/** 义务周期：每月 / 每年 */
export type CommitmentCycle = 'monthly' | 'yearly'

/** 义务：固定项。付/未付不在这里存，由本周期事件推导（周期更替自动回到未付） */
export interface Commitment {
  name: string
  amount: number
  /** 周期。旧数据无此字段 = 每月 */
  cycle?: CommitmentCycle
}

export interface Settings {
  dayType: DayTypeName
  dayPlans: Record<DayTypeName, RhythmBucket[]>
  pools: Pool[]
  commitments: Commitment[]
  /** 走账账户名：自由输入、自动记忆 */
  accounts: string[]
  /** 最近一次记账用的账户：作为下次弹层的默认值（便利性字段，可空） */
  lastAccount?: string
  /** 最近一次走账转入的账户：走账弹层「转到哪个账户」的默认值 */
  lastTransferTo?: string
}

/**
 * 事件：append-only，唯一事实源。
 * 所有视图数字（今日已花、周剩余、月底推算、义务状态）都从事件流实时推导，永远不落库。
 * account 是事实属性（钱从哪个账户出的），不参与任何额度计算——不做账户余额台账。
 */
export type MoneyEvent =
  | { id: string; ts: number; kind: 'rhythm'; category: string; amount: number; note: string; account?: string }
  | { id: string; ts: number; kind: 'pool'; pool: string; dir: 'out' | 'in'; amount: number; note: string; account?: string }
  | { id: string; ts: number; kind: 'commitment'; item: string; amount: number; periodKey: string; paid: boolean; account?: string }
  | { id: string; ts: number; kind: 'transfer'; from: string; to: string; amount: number; note: string }

export interface PersistedState {
  schemaVersion: number
  settings: Settings
  events: MoneyEvent[]
}
