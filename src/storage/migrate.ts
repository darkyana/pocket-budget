import { SCHEMA_VERSION, type PersistedState } from '../core/types'
import { defaultSettings } from '../core/seed'

/**
 * 迁移钩子：schemaVersion 升级时在这里就地升级旧数据。
 * 铁律：事件是 append-only 的事实源，迁移不得删改已有事件，只能补字段或调整设置结构。
 * 未来版本链示例：
 *   if (data.schemaVersion === 1) { 做v1→v2的字段搬迁; data.schemaVersion = 2 }
 */
export function migrate(raw: unknown): PersistedState {
  if (!isValidState(raw)) return freshState()
  const data = raw as PersistedState
  // v1 起步，暂无历史版本需要升级
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
