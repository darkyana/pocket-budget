import { SCHEMA_VERSION, type MoneyRecord, type PersistedState, type Settings } from '../core/types'
import { defaultSettings } from '../core/seed'

export function migrate(raw: unknown): PersistedState {
  if (!isValidState(raw)) return freshState()
  const d = raw as { schemaVersion: number; settings: any; records?: unknown[]; events?: unknown[] }

  let records = (d.records ?? d.events ?? []) as any[]
  let settings: any = { ...d.settings }

  if (d.schemaVersion === 1) {
    records = records.map((e) => {
      if (e.kind !== 'commitment' || !('monthKey' in e)) return e
      const { monthKey, ...rest } = e
      return { ...rest, periodKey: monthKey }
    })
  }

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
