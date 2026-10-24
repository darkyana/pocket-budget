export const SCHEMA_VERSION = 3

export type DayTypeName = string

export interface RoutineBucket {
  name: string
  expect: number
}

export interface Budget {
  name: string
  month: number
}

export type ExpenseCycle = 'monthly' | 'yearly'

export interface FixedExpense {
  name: string
  amount: number
  cycle?: ExpenseCycle
}

export interface Settings {
  dayType: DayTypeName
  dayTypeSetFor?: string
  routineSpendRatio?: number
  dayPlans: Record<DayTypeName, RoutineBucket[]>
  budgets: Budget[]
  fixedExpenses: FixedExpense[]
  accounts: string[]
  lastAccount?: string
  lastTransferTo?: string
}

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
