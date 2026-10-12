import { openDB, type IDBPDatabase } from 'idb'
import type { PersistedState } from '../core/types'
import { freshState, migrate } from './migrate'

const DB_NAME = 'pocket-budget'
const STORE = 'state'
const KEY = 'main'

let dbp: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  dbp ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
    },
  })
  return dbp
}

/** 读取并迁移到当前版本；首次启动或数据损坏时给一份出厂状态 */
export async function loadState(): Promise<PersistedState> {
  const raw = await (await db()).get(STORE, KEY)
  const state = migrate(raw)
  if (state !== raw) await saveState(state) // 首次落盘 / 迁移结果落盘
  return state
}

export async function saveState(state: PersistedState): Promise<void> {
  await (await db()).put(STORE, state, KEY)
}

/** 请求持久化存储，降低 iOS WebView 清数据的风险；失败静默（非关键路径） */
export async function requestPersistence(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await navigator.storage.persist()
    }
  } catch {
    /* 非关键路径 */
  }
}

export { freshState }
