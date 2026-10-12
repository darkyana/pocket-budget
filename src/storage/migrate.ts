import { SCHEMA_VERSION, type PersistedState } from '../core/types'
import { defaultSettings } from '../core/seed'

/**
 * 迁移钩子：schemaVersion 升级时在这里就地升级旧数据。
 * 铁律：事件是 append-only 的事实源，迁移不得删除已有事件，只做字段级搬迁或调整设置结构。
 */
export function migrate(raw: unknown): PersistedState {
  if (!isValidState(raw)) return freshState()
  const data = raw as PersistedState & { schemaVersion: number }

  // v1 → v2：义务事件 monthKey → periodKey（语义泛化为周期键，值不变）
  if (data.schemaVersion === 1) {
    data.events = data.events.map((e) => {
      if (e.kind !== 'commitment' || !('monthKey' in e)) return e
      const { monthKey, ...rest } = e as typeof e & { monthKey: string }
      return { ...rest, periodKey: monthKey }
    })
    data.schemaVersion = 2
  }

  if (data.schemaVersion > SCHEMA_VERSION) {
    // 来自更新版本的数据，不冒险解析，回退出厂（凭证文件里应有同版本导出）
    return freshState()
  }
  return data
}

function isValidState(raw: unknown): raw is PersistedState {
  if (!raw || typeof raw !== 'object') return false
  const d = raw as PersistedState
  return typeof d.schemaVersion === 'number' && Array.isArray(d.events) && !!d.settings && typeof d.settings === 'object'
}

export function freshState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, settings: defaultSettings(new Date()), events: [] }
}
