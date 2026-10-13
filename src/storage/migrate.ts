import { SCHEMA_VERSION, type MoneyRecord, type PersistedState, type Settings } from '../core/types'
import { defaultSettings } from '../core/seed'

/**
 * 迁移钩子：schemaVersion 升级时在这里就地升级旧数据。
 * 铁律：流水是事实源，迁移不得删除已有流水，只做字段级搬迁或调整设置结构。
 */
export function migrate(raw: unknown): PersistedState {
  if (!isValidState(raw)) return freshState()
  const d = raw as { schemaVersion: number; settings: any; records?: unknown[]; events?: unknown[] }

  let records = (d.records ?? d.events ?? []) as any[]
  let settings: any = { ...d.settings }

  // v1 → v2：固定支出流水字段 monthKey → periodKey（语义泛化为周期键，值不变）
  if (d.schemaVersion === 1) {
    records = records.map((e) => {
      if (e.kind !== 'commitment' || !('monthKey' in e)) return e
      const { monthKey, ...rest } = e
      return { ...rest, periodKey: monthKey }
    })
  }

  // v2 → v3：统一术语——kind 值 rhythm/pool/commitment → routine/budget/fixed（pool 字段改名 budget）；
  // 设置 pools → budgets（周预算改为月÷4 派生，丢弃 weekAllow）、commitments → fixedExpenses；顶层 events → records
  if (d.schemaVersion <= 2) {
    records = records.map((e) => {
      if (e.kind === 'routine') return e
      if (e.kind === 'rhythm') return { ...e, kind: 'routine' }
      if (e.kind === 'budget') return e
      if (e.kind === 'pool') {
        const { pool, ...rest } = e
        return { ...rest, kind: 'budget', budget: pool }
      }
      if (e.kind === 'fixed') return e
      if (e.kind === 'commitment') return { ...e, kind: 'fixed' }
      return e
    })
    settings = {
      ...settings,
      budgets: (settings.pools ?? []).map(({ weekAllow: _drop, ...b }: any) => b),
      fixedExpenses: settings.fixedExpenses ?? settings.commitments ?? [],
    }
    delete settings.pools
    delete settings.commitments
  }

  return { schemaVersion: SCHEMA_VERSION, settings: settings as Settings, records: records as MoneyRecord[] }
}

function isValidState(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const d = raw as { schemaVersion: unknown; settings: unknown; records: unknown; events: unknown }
  return (
    typeof d.schemaVersion === 'number' &&
    (Array.isArray(d.records) || Array.isArray(d.events)) &&
    !!d.settings &&
    typeof d.settings === 'object'
  )
}

export function freshState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, settings: defaultSettings(new Date()), records: [] }
}
